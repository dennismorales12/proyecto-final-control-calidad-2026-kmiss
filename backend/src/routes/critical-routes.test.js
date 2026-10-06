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

test('crea un producto válido normalizando nombre y valores numéricos', async () => {
  pool.query.mockResolvedValue({ rows: [{ id: 4, nombre: 'Gel' }] });
  const r = await request(app).post('/productos').send({ nombre: ' Gel ', precio: '40', costo: '10', stock_actual: '5', stock_minimo: 0 });
  expect(r.status).toBe(201);
  expect(pool.query.mock.calls[0][1]).toEqual(['Gel', null, null, 40, 10, 5, 0, 'unidad']);
});
test('no permite reducir existencias por debajo de las unidades reservadas', async () => {
  pool.query.mockResolvedValue({ rows: [{ stock_reservado: 3 }] });
  const r = await request(app).put('/productos/4').send({ nombre: 'Gel', precio: 40, stock_actual: 2 });
  expect(r.status).toBe(400);
  expect(r.body.error).toContain('3 unidades reservadas');
  expect(pool.query).toHaveBeenCalledTimes(1);
});
test('actualiza un producto manteniendo el stock reservado', async () => {
  pool.query.mockResolvedValueOnce({ rows: [{ stock_reservado: 2 }] }).mockResolvedValueOnce({ rows: [{ id: 4, stock_actual: 5 }] });
  const r = await request(app).put('/productos/4').send({ nombre: 'Gel', precio: 40, stock_actual: 5, activo: false });
  expect(r.status).toBe(200);
  expect(pool.query.mock.calls[1][1]).toEqual(['Gel', null, null, 40, 0, 5, 0, 'unidad', false, '4']);
});
test('devuelve 404 al editar un producto que no existe', async () => {
  pool.query.mockResolvedValue({ rows: [] });
  expect((await request(app).put('/productos/999').send({ nombre: 'Gel' })).status).toBe(404);
  expect(pool.query).toHaveBeenCalledTimes(1);
});
test('no consulta la base al editar producto con precio negativo', async () => {
  expect((await request(app).put('/productos/4').send({ nombre: 'Gel', precio: -1 })).status).toBe(400);
  expect(pool.query).not.toHaveBeenCalled();
});
test('crea servicio con duración y precio válidos', async () => {
  pool.query.mockResolvedValue({ rows: [{ id: 3, nombre: 'Consulta' }] });
  const r = await request(app).post('/servicios').send({ nombre: ' Consulta ', duracion_minutos: 45, precio: 100 });
  expect(r.status).toBe(201);
  expect(pool.query.mock.calls[0][1]).toEqual(['Consulta', null, 45, 100, null]);
});
test('actualiza servicio con precio cero y estado inactivo', async () => {
  pool.query.mockResolvedValue({ rows: [{ id: 3 }] });
  const r = await request(app).put('/servicios/3').send({ nombre: 'Consulta', duracion_minutos: 30, precio: 0, activo: false });
  expect(r.status).toBe(200);
  expect(pool.query.mock.calls[0][1]).toEqual(['Consulta', null, 30, 0, null, false, '3']);
});
test('rechaza edición de servicio con duración cero sin consultar la base', async () => {
  expect((await request(app).put('/servicios/3').send({ nombre: 'Consulta', duracion_minutos: 0 })).status).toBe(400);
  expect(pool.query).not.toHaveBeenCalled();
});
