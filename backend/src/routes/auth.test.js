const express = require('express');
const request = require('supertest');

jest.mock('../db', () => ({ query: jest.fn() }));
jest.mock('bcryptjs', () => ({ compare: jest.fn() }));
jest.mock('jsonwebtoken', () => ({ sign: jest.fn(()=>'token-firmado'), verify: jest.fn() }));

const pool = require('../db');
const bcrypt = require('bcryptjs');
const { limpiarIntentos } = require('../middleware/loginRateLimit');
const auth = require('./auth');
const app = express();
app.use(express.json());
app.use('/auth', auth);

beforeEach(() => { pool.query.mockReset(); bcrypt.compare.mockReset(); limpiarIntentos(); });

test('requiere correo y contraseña', async () => {
  const respuesta=await request(app).post('/auth/login').send({email:'a@b.com'});
  expect(respuesta.status).toBe(400);
  expect(pool.query).not.toHaveBeenCalled();
});

test('rechaza usuario inexistente', async () => {
  pool.query.mockResolvedValue({rows:[]});
  expect((await request(app).post('/auth/login').send({email:'no@kmiss.test',password:'secreto'})).status).toBe(401);
});

test('rechaza usuario inactivo', async () => {
  pool.query.mockResolvedValue({rows:[{activo:false}]});
  expect((await request(app).post('/auth/login').send({email:'a@b.com',password:'secreto'})).status).toBe(401);
});

test('rechaza contraseña incorrecta', async () => {
  pool.query.mockResolvedValue({rows:[{activo:true,password_hash:'hash'}]});
  bcrypt.compare.mockResolvedValue(false);
  expect((await request(app).post('/auth/login').send({email:'a@b.com',password:'mala'})).status).toBe(401);
});

test('entrega token y perfil con credenciales válidas', async () => {
  pool.query.mockResolvedValue({rows:[{id:1,nombre:'Admin',email:'a@b.com',activo:true,rol:'administrador',password_hash:'hash'}]});
  bcrypt.compare.mockResolvedValue(true);
  const respuesta=await request(app).post('/auth/login').send({email:'a@b.com',password:'correcta'});
  expect(respuesta.status).toBe(200);
  expect(respuesta.body.token).toBe('token-firmado');
  expect(respuesta.body.usuario).not.toHaveProperty('password_hash');
});

test('responde 500 si falla la consulta', async () => {
  pool.query.mockRejectedValue(new Error('db'));
  expect((await request(app).post('/auth/login').send({email:'a@b.com',password:'correcta'})).status).toBe(500);
});
