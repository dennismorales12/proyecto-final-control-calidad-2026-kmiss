const express=require('express');
const request=require('supertest');

jest.mock('../db',()=>({query:jest.fn()}));
jest.mock('../middleware/auth',()=>({
  autenticar:(req,res,next)=>{req.usuario={id:9,rol:'administrador'};next();},
  permitirRoles:()=>(req,res,next)=>next(),
}));

const pool=require('../db');
const pacientes=require('./pacientes');
const app=express();
app.use(express.json());
app.use('/pacientes',pacientes);

beforeEach(()=>pool.query.mockReset());

test('lista pacientes ordenados',async()=>{
  pool.query.mockResolvedValue({rows:[{id:1,nombre_completo:'Ana'}]});
  const r=await request(app).get('/pacientes');
  expect(r.status).toBe(200); expect(r.body[0].nombre_completo).toBe('Ana');
});

test('busca pacientes con el mismo término en cuatro campos',async()=>{
  pool.query.mockResolvedValue({rows:[]});
  await request(app).get('/pacientes?q=ana');
  expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('ILIKE $1'),['%ana%']);
});

test('devuelve un paciente existente',async()=>{
  pool.query.mockResolvedValue({rows:[{id:1,nombre_completo:'Ana'}]});
  expect((await request(app).get('/pacientes/1')).status).toBe(200);
});

test('crea paciente y normaliza NIT',async()=>{
  pool.query.mockResolvedValue({rows:[{id:1,nit:'1234567K',nombre_completo:'Ana'}]});
  const r=await request(app).post('/pacientes').send({nit:'1-234567-K',nombre_completo:'Ana'});
  expect(r.status).toBe(201);
  expect(pool.query.mock.calls[0][1][0]).toBe('1234567K');
});

test('rechaza paciente sin nombre',async()=>{
  expect((await request(app).post('/pacientes').send({nit:'123'})).status).toBe(400);
  expect(pool.query).not.toHaveBeenCalled();
});

test('informa conflicto de NIT duplicado',async()=>{
  pool.query.mockRejectedValue({code:'23505'});
  expect((await request(app).post('/pacientes').send({nit:'123',nombre_completo:'Ana'})).status).toBe(409);
});

test('actualiza un paciente existente',async()=>{
  pool.query.mockResolvedValueOnce({rows:[{id:1,nit:'123',nombre_completo:'Ana'}]}).mockResolvedValueOnce({rows:[]});
  expect((await request(app).put('/pacientes/1').send({nit:'123',nombre_completo:'Ana'})).status).toBe(200);
});

test('elimina un paciente existente',async()=>{
  pool.query.mockResolvedValue({rows:[{id:1}]});
  expect((await request(app).delete('/pacientes/1')).status).toBe(200);
});
