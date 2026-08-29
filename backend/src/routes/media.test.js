const express = require('express');
const request = require('supertest');

jest.mock('../db', () => ({ query: jest.fn() }));

const pool = require('../db');
const mediaRoutes = require('./media');

const app = express();
app.use('/media', mediaRoutes);

beforeEach(() => {
  pool.query.mockReset();
});

test('entrega una imagen persistida con su tipo MIME', async () => {
  const datos = Buffer.from([137, 80, 78, 71]);
  pool.query.mockResolvedValue({ rows: [{ imagen_datos: datos, imagen_mime: 'image/png' }] });

  const respuesta = await request(app).get('/media/productos/12');

  expect(respuesta.status).toBe(200);
  expect(respuesta.headers['content-type']).toMatch(/^image\/png/);
  expect(respuesta.body).toEqual(datos);
  expect(pool.query).toHaveBeenCalledWith(
    'SELECT imagen_datos, imagen_mime FROM productos WHERE id=$1',
    [12]
  );
});

test('rechaza recursos no permitidos sin consultar la base de datos', async () => {
  const respuesta = await request(app).get('/media/usuarios/1');

  expect(respuesta.status).toBe(404);
  expect(pool.query).not.toHaveBeenCalled();
});

test('responde 404 cuando el registro no tiene una imagen persistida', async () => {
  pool.query.mockResolvedValue({ rows: [{ imagen_datos: null, imagen_mime: null }] });

  const respuesta = await request(app).get('/media/servicios/4');

  expect(respuesta.status).toBe(404);
});
