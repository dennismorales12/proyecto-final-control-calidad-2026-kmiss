const express = require('express');
const request = require('supertest');

jest.mock('../db', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../middleware/auth', () => ({
  autenticar: (req, res, next) => {
    req.usuario = { id: Number(req.headers['x-user-id'] || 9), rol: req.headers['x-role'] || 'administrador' };
    next();
  },
  permitirRoles: (...roles) => (req, res, next) => roles.includes(req.usuario?.rol)
    ? next()
    : res.status(403).json({ error: 'No tienes permisos para realizar esta acción' }),
}));
jest.mock('../agenda', () => ({ validarDisponibilidad: jest.fn().mockResolvedValue(30) }));

const pool = require('../db');
const pacientes = require('./pacientes');
const servicios = require('./servicios');
const productos = require('./productos');
const ventas = require('./ventas');
const citas = require('./citas');

const app = express();
app.use(express.json());
app.use('/pacientes', pacientes);
app.use('/servicios', servicios);
app.use('/productos', productos);
app.use('/ventas', ventas);
app.use('/citas', citas);

beforeEach(() => {
  pool.query.mockReset();
  pool.connect.mockReset();
});

test('historial inexistente responde 404 antes de consultar movimientos', async () => {
  pool.query.mockResolvedValueOnce({ rows: [] });
  const respuesta = await request(app).get('/pacientes/2147483647/historial');
  expect(respuesta.status).toBe(404);
  expect(pool.query).toHaveBeenCalledTimes(1);
});

test('rechaza servicio con duración negativa sin consultar la base', async () => {
  const respuesta = await request(app).post('/servicios').send({nombre:'Inválido',duracion_minutos:-1,precio:100});
  expect(respuesta.status).toBe(400);
  expect(pool.query).not.toHaveBeenCalled();
});

test('rechaza producto con precio negativo sin consultar la base', async () => {
  const respuesta = await request(app).post('/productos').send({nombre:'Inválido',precio:-1,costo:0,stock_actual:1,stock_minimo:0});
  expect(respuesta.status).toBe(400);
  expect(pool.query).not.toHaveBeenCalled();
});

test('médico no puede consultar ventas', async () => {
  const respuesta = await request(app).get('/ventas').set('x-role','medico');
  expect(respuesta.status).toBe(403);
  expect(pool.query).not.toHaveBeenCalled();
});

test('rechaza cantidad negativa y revierte la venta', async () => {
  const client = { query: jest.fn().mockResolvedValue({rows:[]}), release: jest.fn() };
  pool.connect.mockResolvedValue(client);
  const respuesta = await request(app).post('/ventas').send({
    metodo_pago:'efectivo', items:[{producto_id:1,cantidad:-1,precio_unitario:1}],
  });
  expect(respuesta.status).toBe(400);
  expect(client.query).toHaveBeenCalledWith('ROLLBACK');
});

test('médico no puede editar una cita ajena', async () => {
  const client = {
    query: jest.fn(async (sql) => {
      if (sql === 'SELECT 1 FROM citas WHERE id=$1 AND medico_id=$2') return {rows:[]};
      return {rows:[]};
    }),
    release: jest.fn(),
  };
  pool.connect.mockResolvedValue(client);
  const respuesta = await request(app).put('/citas/55').set('x-role','medico').set('x-user-id','7').send({
    paciente_id:1,servicio_id:1,medico_id:8,sede_id:1,fecha_hora:'2026-10-01T10:00:00',
  });
  expect(respuesta.status).toBe(403);
  expect(client.query).toHaveBeenCalledWith('ROLLBACK');
});

test('rechaza transición desde una cita atendida', async () => {
  const client = {
    query: jest.fn(async (sql) => {
      if (sql.startsWith('SELECT estado, medico_id')) return {rows:[{estado:'atendida',medico_id:7}]};
      return {rows:[]};
    }),
    release: jest.fn(),
  };
  pool.connect.mockResolvedValue(client);
  const respuesta = await request(app).put('/citas/55/estado').set('x-role','medico').set('x-user-id','7').send({estado:'programada'});
  expect(respuesta.status).toBe(400);
  expect(respuesta.body.error).toMatch(/No se permite/);
});
