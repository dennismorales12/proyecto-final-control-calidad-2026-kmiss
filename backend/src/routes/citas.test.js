const express = require('express');
const request = require('supertest');
jest.mock('../db', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../agenda', () => ({ validarDisponibilidad: jest.fn() }));
jest.mock('../middleware/auth', () => ({
  autenticar: (req, res, next) => { req.usuario = { id: 7, rol: req.headers['x-role'] || 'administrador' }; next(); },
  permitirRoles: () => (req, res, next) => next(),
}));
jest.mock('../middleware/upload', () => ({ single: () => (req, res, next) => { req.file = { buffer: Buffer.from('archivo simulado') }; next(); } }));
jest.mock('xlsx', () => ({ read: jest.fn(), utils: { sheet_to_json: jest.fn() } }));
const pool = require('../db');
const XLSX = require('xlsx');
const { validarDisponibilidad } = require('../agenda');
const app = express();
app.use(express.json());
app.use('/citas', require('./citas'));
const cita = { paciente_id: 1, servicio_id: 3, medico_id: 8, sede_id: 2, fecha_hora: '2035-10-20T10:00:00' };
let cliente;
beforeEach(() => {
  pool.query.mockReset();
  pool.connect.mockReset();
  validarDisponibilidad.mockReset().mockResolvedValue(30);
  XLSX.read.mockReset().mockReturnValue({ SheetNames: ['Datos'], Sheets: { Datos: {} } });
  XLSX.utils.sheet_to_json.mockReset();
  cliente = { release: jest.fn(), query: jest.fn(async (sql) => {
    if (sql.startsWith('SELECT estado, medico_id')) return { rows: [{ estado: 'programada', medico_id: 7 }] };
    return { rows: [{ id: 55 }] };
  }) };
  pool.connect.mockResolvedValue(cliente);
});

test('al crear una cita el médico se asigna a sí mismo', async () => {
  const r = await request(app).post('/citas').set('x-role', 'medico').send(cita);
  expect(r.status).toBe(201);
  expect(validarDisponibilidad.mock.calls[0][1].medicoId).toBe(7);
  expect(cliente.query).toHaveBeenCalledWith('COMMIT');
  expect(cliente.release).toHaveBeenCalledTimes(1);
});
test('una cita sin médico no abre una transacción', async () => {
  expect((await request(app).post('/citas').send({ ...cita, medico_id: null })).status).toBe(400);
  expect(pool.connect).not.toHaveBeenCalled();
});
test('al editar cita propia se excluye su identificador de conflictos', async () => {
  expect((await request(app).put('/citas/55').set('x-role', 'medico').send(cita)).status).toBe(200);
  expect(validarDisponibilidad.mock.calls[0][1]).toEqual(expect.objectContaining({ medicoId: 7, excluirCitaId: '55' }));
  expect(cliente.query).toHaveBeenCalledWith('COMMIT');
});
test('un conflicto al editar revierte y libera la conexión', async () => {
  validarDisponibilidad.mockRejectedValue(new Error('Horario ocupado'));
  expect((await request(app).put('/citas/55').send(cita)).status).toBe(400);
  expect(cliente.query).toHaveBeenCalledWith('ROLLBACK');
  expect(cliente.release).toHaveBeenCalledTimes(1);
});
test('un médico no puede confirmar una solicitud', async () => {
  expect((await request(app).put('/citas/55/estado').set('x-role', 'medico').send({ estado: 'confirmada' })).status).toBe(403);
  expect(pool.connect).not.toHaveBeenCalled();
});
test('devuelve 404 si no existe la cita al cambiar su estado', async () => {
  cliente.query.mockResolvedValue({ rows: [] });
  expect((await request(app).put('/citas/999/estado').send({ estado: 'atendida' })).status).toBe(404);
  expect(cliente.query).toHaveBeenCalledWith('ROLLBACK');
  expect(cliente.release).toHaveBeenCalledTimes(1);
});
test('un médico no puede cambiar el estado de una cita ajena', async () => {
  cliente.query.mockResolvedValue({ rows: [{ estado: 'programada', medico_id: 8 }] });
  expect((await request(app).put('/citas/55/estado').set('x-role', 'medico').send({ estado: 'atendida' })).status).toBe(403);
  expect(cliente.query).toHaveBeenCalledWith('ROLLBACK');
});
test('una transición permitida se confirma y libera la conexión', async () => {
  expect((await request(app).put('/citas/55/estado').send({ estado: 'atendida' })).status).toBe(200);
  expect(cliente.query).toHaveBeenCalledWith('UPDATE citas SET estado=$1, actualizado_en=NOW() WHERE id=$2', ['atendida', '55']);
  expect(cliente.query).toHaveBeenCalledWith('COMMIT');
});
test('importa una cita con médico usando disponibilidad y transacción', async () => {
  XLSX.utils.sheet_to_json.mockReturnValue([{ Paciente: 'Ana', Servicio: 'Consulta', Sede: 'Central', Medico: 'Luis', Fecha_Hora: new Date('2035-10-20T10:00:00Z') }]);
  pool.query.mockResolvedValue({ rows: [{ id: 2 }] });
  const r = await request(app).post('/citas/importar');
  expect(r.status).toBe(200);
  expect(r.body).toEqual({ total: 1, creadas: 1, errores: [] });
  expect(validarDisponibilidad).toHaveBeenCalledTimes(1);
  expect(cliente.query).toHaveBeenCalledWith('COMMIT');
});
test('importar horario ocupado revierte solo la fila y registra el error', async () => {
  XLSX.utils.sheet_to_json.mockReturnValue([{ paciente: 'Ana', servicio: 'Consulta', medico: 'Luis', fecha: '2035-10-20T10:00:00' }]);
  pool.query.mockResolvedValue({ rows: [{ id: 2 }] });
  validarDisponibilidad.mockRejectedValue(new Error('Horario ocupado'));
  const r = await request(app).post('/citas/importar');
  expect(r.body.creadas).toBe(0);
  expect(r.body.errores[0]).toContain('Fila 2: Horario ocupado');
  expect(cliente.query).toHaveBeenCalledWith('ROLLBACK');
  expect(cliente.release).toHaveBeenCalledTimes(1);
});
test('una fila incompleta no consulta pacientes ni abre transacciones', async () => {
  XLSX.utils.sheet_to_json.mockReturnValue([{ paciente: 'Ana' }]);
  const r = await request(app).post('/citas/importar');
  expect(r.body.errores[0]).toContain('faltan datos requeridos');
  expect(pool.query).not.toHaveBeenCalled();
  expect(pool.connect).not.toHaveBeenCalled();
});
