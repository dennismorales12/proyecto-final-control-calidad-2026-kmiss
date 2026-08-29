const express = require('express');
const request = require('supertest');

jest.mock('../db', () => ({ query: jest.fn() }));
jest.mock('../middleware/auth', () => ({
  autenticar: (req, res, next) => { req.usuario = { id: 9, rol: 'administrador' }; next(); },
  permitirRoles: () => (req, res, next) => next(),
}));
jest.mock('../reservas', () => ({ liberarReservasVencidas: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../agenda', () => ({ validarDisponibilidad: jest.fn() }));

const pool = require('../db');
const ajustesRoutes = require('./ajustes');
const productosRoutes = require('./productos');
const tiendaRoutes = require('./tienda');

const app = express();
app.use(express.json());
app.use('/ajustes', ajustesRoutes);
app.use('/productos', productosRoutes);
app.use('/tienda', tiendaRoutes);

beforeEach(() => {
  pool.query.mockReset();
});

test('crea una promoción para una categoría sin exigir un artículo', async () => {
  pool.query.mockResolvedValue({ rows: [{ id: 31, categoria_id: 7 }] });

  const respuesta = await request(app).post('/ajustes/promociones').send({
    producto_id: null,
    categoria_id: 7,
    descuento_porcentaje: 15,
    fecha_inicio: '2026-08-29',
    fecha_fin: '',
  });

  expect(respuesta.status).toBe(201);
  expect(pool.query).toHaveBeenCalledWith(
    expect.stringContaining('producto_id, categoria_id'),
    [null, 7, 15, '2026-08-29', null, 9]
  );
});

test('rechaza una promoción que mezcla artículo y categoría', async () => {
  const respuesta = await request(app).post('/ajustes/promociones').send({
    producto_id: 2,
    categoria_id: 7,
    descuento_porcentaje: 15,
  });

  expect(respuesta.status).toBe(400);
  expect(pool.query).not.toHaveBeenCalled();
});

test('el catálogo considera promociones del artículo o de su categoría', async () => {
  pool.query.mockResolvedValue({ rows: [] });

  const respuesta = await request(app).get('/tienda/productos');

  expect(respuesta.status).toBe(200);
  const consulta = pool.query.mock.calls[0][0];
  expect(consulta).toContain('pr.producto_id=p.id OR pr.categoria_id=p.categoria_id');
});

test('limita el buscador de artículos y prioriza coincidencias iniciales', async () => {
  pool.query.mockResolvedValue({ rows: [] });

  const respuesta = await request(app).get('/productos?q=gel&limit=8');

  expect(respuesta.status).toBe(200);
  expect(pool.query).toHaveBeenCalledWith(
    expect.stringContaining('ORDER BY CASE WHEN p.nombre ILIKE $2'),
    ['%gel%', 'gel%', 8]
  );
});
