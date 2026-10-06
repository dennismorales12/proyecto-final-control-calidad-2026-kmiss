const express = require('express');
const request = require('supertest');

jest.mock('../db', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../middleware/auth', () => ({
  autenticar:(req,res,next)=>{req.usuario={id:9,rol:req.headers['x-role']||'administrador'};next();},
  permitirRoles:(...roles)=>(req,res,next)=>roles.includes(req.usuario.rol)?next():res.status(403).json({error:'sin permiso'}),
}));
jest.mock('../reservas', () => ({
  ESTADOS_CON_RESERVA:['nuevo','contactado','esperando_pago'],
  liberarReservasVencidas:jest.fn().mockResolvedValue(undefined),
}));

const pool=require('../db');
const pedidos=require('./pedidos');
const app=express();
app.use(express.json());
app.use('/pedidos',pedidos);

beforeEach(()=>{pool.query.mockReset();pool.connect.mockReset();});

test('rechaza filtro de estado desconocido',async()=>{
  expect((await request(app).get('/pedidos?estado=desconocido')).status).toBe(400);
});

test('lista pedidos con filtro válido',async()=>{
  pool.query.mockResolvedValue({rows:[{id:1,estado:'nuevo'}]});
  const r=await request(app).get('/pedidos?estado=nuevo');
  expect(r.status).toBe(200); expect(r.body).toHaveLength(1);
});

test('devuelve resumen de pedidos',async()=>{
  pool.query.mockResolvedValue({rows:[{nuevos:2,reservados:3,pagos_confirmados:1}]});
  const r=await request(app).get('/pedidos/resumen');
  expect(r.status).toBe(200); expect(r.body.nuevos).toBe(2);
});

test('devuelve 404 para pedido inexistente',async()=>{
  pool.query.mockResolvedValue({rows:[]});
  expect((await request(app).get('/pedidos/999')).status).toBe(404);
});

test('permite marcar un pedido como contactado',async()=>{
  pool.query.mockResolvedValue({rows:[{id:1,estado:'contactado'}]});
  expect((await request(app).put('/pedidos/1/contactar')).body.estado).toBe('contactado');
});

test('rechaza contacto si el estado no lo permite',async()=>{
  pool.query.mockResolvedValue({rows:[]});
  expect((await request(app).put('/pedidos/1/contactar')).status).toBe(400);
});

test('permite preparar un pedido pagado',async()=>{
  pool.query.mockResolvedValue({rows:[{id:1,estado:'preparando'}]});
  const r=await request(app).put('/pedidos/1/preparar');
  expect(r.status).toBe(200); expect(r.body.estado).toBe('preparando');
});

test('rechaza despacho fuera de secuencia',async()=>{
  pool.query.mockResolvedValue({rows:[]});
  expect((await request(app).put('/pedidos/1/entregar')).status).toBe(400);
});

test('médico no puede acceder a pedidos',async()=>{
  expect((await request(app).get('/pedidos').set('x-role','medico')).status).toBe(403);
});

test('cancela pedido con reserva y libera unidades',async()=>{
  const client={
    query:jest.fn(async(sql)=>{
      if(sql.startsWith('SELECT estado')) return {rows:[{estado:'nuevo'}]};
      if(sql.startsWith('SELECT producto_id')) return {rows:[{producto_id:4,cantidad:2}]};
      return {rows:[]};
    }),
    release:jest.fn(),
  };
  pool.connect.mockResolvedValue(client);
  const r=await request(app).put('/pedidos/1/cancelar').send({motivo:'Cliente desistió'});
  expect(r.status).toBe(200);
  expect(client.query).toHaveBeenCalledWith('COMMIT');
});
