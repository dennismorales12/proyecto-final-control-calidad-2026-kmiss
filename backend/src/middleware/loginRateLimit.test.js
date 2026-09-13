const express = require('express');
const request = require('supertest');
const { crearLimitadorLogin, limpiarIntentos } = require('./loginRateLimit');

function crearApp(config) {
  const app = express();
  app.use(express.json());
  app.post('/login', crearLimitadorLogin(config), (req,res)=>res.json({ok:true}));
  return app;
}

beforeEach(limpiarIntentos);

test('permite intentos dentro del límite', async () => {
  const app=crearApp({maxIntentos:2,ventanaMs:60000});
  expect((await request(app).post('/login').send({email:'a@b.com'})).status).toBe(200);
  expect((await request(app).post('/login').send({email:'a@b.com'})).status).toBe(200);
});

test('responde 429 al superar el límite', async () => {
  const app=crearApp({maxIntentos:1,ventanaMs:60000});
  await request(app).post('/login').send({email:'a@b.com'});
  const respuesta=await request(app).post('/login').send({email:'a@b.com'});
  expect(respuesta.status).toBe(429);
  expect(respuesta.headers['retry-after']).toBeDefined();
});

test('separa el conteo por correo', async () => {
  const app=crearApp({maxIntentos:1,ventanaMs:60000});
  await request(app).post('/login').send({email:'a@b.com'});
  expect((await request(app).post('/login').send({email:'c@d.com'})).status).toBe(200);
});
