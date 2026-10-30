const express=require('express');
const request=require('supertest');

jest.mock('../db',()=>({query:jest.fn()}));
jest.mock('../middleware/upload',()=>({single:()=>(req,res,next)=>{
  if (!req.headers['x-sin-archivo']) req.file={buffer:Buffer.from('Excel simulado')};
  next();
}}));
jest.mock('xlsx',()=>({read:jest.fn(),utils:{sheet_to_json:jest.fn()}}));
jest.mock('../middleware/auth',()=>({
  autenticar:(req,res,next)=>{req.usuario={id:9,rol:'administrador'};next();},
  permitirRoles:()=>(req,res,next)=>next(),
}));

const pool=require('../db');
const XLSX=require('xlsx');
const pacientes=require('./pacientes');
const app=express();
app.use(express.json());
app.use('/pacientes',pacientes);

beforeEach(()=>{
  pool.query.mockReset();
  XLSX.read.mockReset().mockReturnValue({SheetNames:['Datos'],Sheets:{Datos:{}}});
  XLSX.utils.sheet_to_json.mockReset().mockReturnValue([]);
});

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

test('importación sin archivo no consulta la base',async()=>{
  expect((await request(app).post('/pacientes/importar').set('x-sin-archivo','1')).status).toBe(400);
  expect(pool.query).not.toHaveBeenCalled();
});
test('un Excel ilegible devuelve un error controlado',async()=>{
  XLSX.read.mockImplementation(()=>{throw new Error('Archivo inválido');});
  expect((await request(app).post('/pacientes/importar')).status).toBe(400);
});
test('un Excel sin filas se rechaza',async()=>{
  expect((await request(app).post('/pacientes/importar')).status).toBe(400);
});
test('una fila sin nombre se omite y conserva su número',async()=>{
  XLSX.utils.sheet_to_json.mockReturnValue([{nit:'123'}]);
  const r=await request(app).post('/pacientes/importar');
  expect(r.body).toEqual({total:1,creados:0,actualizados:0,errores:['Fila 2: falta el nombre completo, se omitió']});
  expect(pool.query).not.toHaveBeenCalled();
});
test('importa un paciente nuevo usando alias y fecha Excel',async()=>{
  XLSX.utils.sheet_to_json.mockReturnValue([{'Nombre completo':'Ana',NIT:'1-23k','Teléfono':'55550000','Fecha nacimiento':new Date('2000-01-02T00:00:00Z')}]);
  pool.query.mockResolvedValue({rows:[]});
  const r=await request(app).post('/pacientes/importar');
  expect(r.body).toEqual({total:1,creados:1,actualizados:0,errores:[]});
  expect(pool.query.mock.calls[1][1]).toEqual(['123K','Ana','55550000',null,'2000-01-02',null,null,null,null,null,9]);
});
test('un NIT existente actualiza en lugar de duplicar',async()=>{
  XLSX.utils.sheet_to_json.mockReturnValue([{nombre:'Ana',nit:'123',fecha_nacimiento:'2001-02-03'}]);
  pool.query.mockResolvedValueOnce({rows:[{id:12}]}).mockResolvedValueOnce({rows:[]});
  const r=await request(app).post('/pacientes/importar');
  expect(r.body.actualizados).toBe(1);
  expect(r.body.creados).toBe(0);
  expect(pool.query.mock.calls[1][0]).toContain('UPDATE pacientes');
  expect(pool.query.mock.calls[1][1][10]).toBe(12);
});
test('importar sin NIT crea sin buscar coincidencias',async()=>{
  XLSX.utils.sheet_to_json.mockReturnValue([{nombre:'Ana'}]);
  pool.query.mockResolvedValue({rows:[]});
  expect((await request(app).post('/pacientes/importar')).body.creados).toBe(1);
  expect(pool.query).toHaveBeenCalledTimes(1);
  expect(pool.query.mock.calls[0][1][0]).toBeNull();
});
test('un error por fila no impide importar la siguiente',async()=>{
  XLSX.utils.sheet_to_json.mockReturnValue([{nombre:'Ana'},{nombre:'Luis'}]);
  pool.query.mockRejectedValueOnce(new Error('Fallo de base')).mockResolvedValueOnce({rows:[]});
  const r=await request(app).post('/pacientes/importar');
  expect(r.body.creados).toBe(1);
  expect(r.body.errores).toEqual(['Fila 2 (Ana): Fallo de base']);
});
