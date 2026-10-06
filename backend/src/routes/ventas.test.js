const express = require('express');
const request = require('supertest');
jest.mock('../db', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../middleware/auth', () => ({
  autenticar: (req, res, next) => { req.usuario = { id: 9, rol: 'administrador' }; next(); },
  permitirRoles: () => (req, res, next) => next(),
}));
const pool = require('../db');
const app = express();
app.use(express.json());
app.use('/ventas', require('./ventas'));

function transaccion({ stock = 5, activo = true, fallaDetalle = false, estado = 'completada' } = {}) {
  return { release: jest.fn(), query: jest.fn(async (sql) => {
    if (sql.startsWith('SELECT stock_actual')) return { rows: [{ stock_actual: stock, nombre: 'Gel', precio: 40, activo }] };
    if (sql.startsWith('SELECT nombre, precio')) return { rows: [{ nombre: 'Consulta', precio: 100, activo: true }] };
    if (sql.startsWith('INSERT INTO ventas')) return { rows: [{ id: 21 }] };
    if (sql.startsWith('INSERT INTO venta_detalles') && fallaDetalle) throw new Error('No se guardó el detalle');
    if (sql.startsWith('SELECT estado')) return { rows: [{ estado }] };
    if (sql.startsWith('SELECT * FROM venta_detalles')) return { rows: [{ producto_id: 4, cantidad: 2 }, { servicio_id: 3, cantidad: 1 }] };
    return { rows: [] };
  }) };
}
beforeEach(() => { pool.query.mockReset(); pool.connect.mockReset(); });

test('usa el precio del servidor aunque el cliente mande otro', async () => {
  const cliente = transaccion();
  pool.connect.mockResolvedValue(cliente);
  pool.query.mockResolvedValueOnce({ rows: [{ id: 21, total: 80 }] }).mockResolvedValueOnce({ rows: [] });
  const res = await request(app).post('/ventas').send({ items: [{ producto_id: 4, cantidad: 2, precio_unitario: 1 }] });
  expect(res.status).toBe(201);
  const cabecera = cliente.query.mock.calls.find(([sql]) => sql.startsWith('INSERT INTO ventas'));
  expect(cabecera[1]).toEqual([null, 9, 80, 0, 80, 'efectivo']);
  expect(cliente.query).toHaveBeenCalledWith('UPDATE productos SET stock_actual = stock_actual - $1 WHERE id = $2', [2, 4]);
  expect(cliente.query).toHaveBeenCalledWith('COMMIT');
  expect(cliente.release).toHaveBeenCalledTimes(1);
});
test('una venta de servicio no descuenta inventario', async () => {
  const cliente = transaccion();
  pool.connect.mockResolvedValue(cliente);
  pool.query.mockResolvedValue({ rows: [{ id: 21 }] });
  const res = await request(app).post('/ventas').send({ descuento: 20, items: [{ servicio_id: 3, cantidad: 1 }] });
  expect(res.status).toBe(201);
  expect(cliente.query.mock.calls.some(([sql]) => sql.startsWith('UPDATE productos'))).toBe(false);
  expect(cliente.query.mock.calls.find(([sql]) => sql.startsWith('INSERT INTO ventas'))[1][4]).toBe(80);
});
test('stock insuficiente revierte la venta antes de guardar su cabecera', async () => {
  const cliente = transaccion({ stock: 1 });
  pool.connect.mockResolvedValue(cliente);
  const res = await request(app).post('/ventas').send({ items: [{ producto_id: 4, cantidad: 2 }] });
  expect(res.status).toBe(400);
  expect(res.body.error).toContain('Stock insuficiente');
  expect(cliente.query).toHaveBeenCalledWith('ROLLBACK');
  expect(cliente.query.mock.calls.some(([sql]) => sql.startsWith('INSERT INTO ventas'))).toBe(false);
});
test('si falla el detalle revierte y no confirma la venta', async () => {
  const cliente = transaccion({ fallaDetalle: true });
  pool.connect.mockResolvedValue(cliente);
  expect((await request(app).post('/ventas').send({ items: [{ producto_id: 4, cantidad: 1 }] })).status).toBe(400);
  expect(cliente.query).toHaveBeenCalledWith('ROLLBACK');
  expect(cliente.query).not.toHaveBeenCalledWith('COMMIT');
  expect(cliente.release).toHaveBeenCalledTimes(1);
});
test('anular una venta devuelve únicamente las unidades de productos', async () => {
  const cliente = transaccion();
  pool.connect.mockResolvedValue(cliente);
  expect((await request(app).put('/ventas/21/anular')).status).toBe(200);
  expect(cliente.query).toHaveBeenCalledWith('UPDATE productos SET stock_actual = stock_actual + $1 WHERE id = $2', [2, 4]);
  expect(cliente.query).toHaveBeenCalledWith('COMMIT');
});
test('no devuelve stock por segunda vez al anular', async () => {
  const cliente = transaccion({ estado: 'anulada' });
  pool.connect.mockResolvedValue(cliente);
  expect((await request(app).put('/ventas/21/anular')).status).toBe(400);
  expect(cliente.query.mock.calls.some(([sql]) => sql.startsWith('UPDATE productos'))).toBe(false);
  expect(cliente.query).toHaveBeenCalledWith('ROLLBACK');
});

test('no vende productos inactivos y libera la conexión', async () => {
  const cliente = transaccion({ activo: false });
  pool.connect.mockResolvedValue(cliente);
  const r = await request(app).post('/ventas').send({ items: [{ producto_id: 4, cantidad: 1 }] });
  expect(r.status).toBe(400);
  expect(r.body.error).toContain('inactivo');
  expect(cliente.query).toHaveBeenCalledWith('ROLLBACK');
  expect(cliente.release).toHaveBeenCalledTimes(1);
});
test('no vende un producto inexistente', async () => {
  const cliente = { query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() };
  pool.connect.mockResolvedValue(cliente);
  const r = await request(app).post('/ventas').send({ items: [{ producto_id: 999, cantidad: 1 }] });
  expect(r.status).toBe(400);
  expect(r.body.error).toContain('Producto no encontrado');
});
test('rechaza una línea que identifica producto y servicio a la vez', async () => {
  const cliente = transaccion();
  pool.connect.mockResolvedValue(cliente);
  const r = await request(app).post('/ventas').send({ items: [{ producto_id: 4, servicio_id: 3, cantidad: 1 }] });
  expect(r.status).toBe(400);
  expect(r.body.error).toContain('un producto o un servicio');
});
test('no vende un servicio inexistente', async () => {
  const cliente = { query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() };
  pool.connect.mockResolvedValue(cliente);
  const r = await request(app).post('/ventas').send({ items: [{ servicio_id: 999, cantidad: 1 }] });
  expect(r.status).toBe(400);
  expect(r.body.error).toContain('Servicio no disponible');
});
