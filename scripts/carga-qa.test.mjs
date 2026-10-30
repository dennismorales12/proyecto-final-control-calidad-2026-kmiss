import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { configurarCarga } from '../load/configuracion-qa.mjs';
import { verificarQa } from './verificar-qa.mjs';
import { resumirCarga } from './resumir-carga.mjs';

const ahora = new Date('2026-10-23T12:00:00Z');
const entorno = { AMBIENTE: 'QA', QA_HOST: 'kmiss-calidad-qa.azurewebsites.net', BASE_URL: 'https://kmiss-calidad-qa.azurewebsites.net', PROD_HOST: 'kmiss-produccion.azurewebsites.net', MEDICO_ID: '7', SEDE_ID: '2', SERVICIO_ID: '3', FECHA: '2026-10-30' };
const configurar = cambios => configurarCarga({ ...entorno, ...cambios }, ahora);
describe('Controles de preparación QA KMISS', () => {
test('carga selecciona catálogo y disponibilidad con referencias', () => {
  assert.match(configurar({}).disponibilidad, /medico_id=7&sede_id=2&servicio_id=3&fecha=2026-10-30$/);
  assert.match(configurar({}).catalogo, /\/api\/tienda\/productos$/);
});
test('carga admite dominio Azure con identificador y región verificados', () => {
  const host = 'kmiss-calidad-qa-1234.centralus-01.azurewebsites.net';
  assert.equal(configurar({ QA_HOST: host, BASE_URL: `https://${host}` }).baseUrl, `https://${host}`);
});
for (const [nombre, cambios] of [
  ['sin ambiente QA', { AMBIENTE: 'PROD' }],
  ['URL HTTP', { BASE_URL: 'http://kmiss-calidad-qa.azurewebsites.net' }],
  ['host distinto', { BASE_URL: 'https://otra-qa.azurewebsites.net' }],
  ['ruta en la URL base', { BASE_URL: entorno.BASE_URL + '/api' }],
  ['credenciales en URL', { BASE_URL: 'https://usuario:clave@kmiss-calidad-qa.azurewebsites.net' }],
  ['host de producción', { PROD_HOST: entorno.QA_HOST }],
  ['producción sin identificar', { PROD_HOST: '' }],
  ['variable productiva sin resolver', { PROD_HOST: '$(PROD_HOST_VERIFICADO)' }],
  ['nombre de ambiente ambiguo', { QA_HOST: 'produccion.azurewebsites.net' }],
  ['ID de médico sin configurar', { MEDICO_ID: '$(CARGA_MEDICO_ID)' }],
  ['ID de sede no positivo', { SEDE_ID: '0' }],
  ['ID de servicio no entero', { SERVICIO_ID: '1.5' }],
  ['fecha imposible', { FECHA: '2026-02-30' }],
  ['fecha anterior', { FECHA: '2026-10-22' }],
  ['fecha actual', { FECHA: '2026-10-23' }],
]) test(`se rechaza ${nombre}`, () => assert.throws(() => configurar(cambios)));

function respuesta(datos, status = 200, tipo = 'application/json') {
  return { status, headers: { get: () => tipo }, json: async () => datos };
}
test('preflight comprueba ambos contratos sin exponer datos ni credenciales', async () => {
  const urls = [];
  const solicitar = async (url, opciones) => {
    urls.push(url); assert.equal(opciones.redirect, 'error');
    return respuesta(url.includes('/productos') ? [{ id: 1, precio_final: '25.00' }] : ['10:00']);
  };
  const resultado = await verificarQa(entorno, solicitar, ahora);
  assert.equal(urls.length, 2); assert.equal(resultado.comprobados.length, 2);
  assert.equal(JSON.stringify(resultado).includes('precio_final'), false);
});
for (const [nombre, r] of [
  ['HTTP 500', respuesta({}, 500)], ['HTML en lugar de JSON', respuesta([], 200, 'text/html')],
  ['catálogo vacío', respuesta([])], ['esquema de producto incorrecto', respuesta([{ nombre: 'sin id' }])],
]) test(`preflight detiene carga por ${nombre}`, async () => {
  await assert.rejects(verificarQa(entorno, async () => r, ahora));
});
test('preflight rechaza horarios con esquema incorrecto', async () => {
  await assert.rejects(verificarQa(entorno, async url => respuesta(url.includes('/productos') ? [{ id: 1, precio_final: 25 }] : [{ hora: '10:00' }]), ahora));
});
test('preflight propaga falla de red sin iniciar la carga', async () => {
  await assert.rejects(verificarQa(entorno, async () => { throw new Error('sin conexión'); }, ahora), /sin conexión/);
});

function resumen() {
  const metrics = { checks: { values: { rate: 1 } } };
  for (const endpoint of ['catalogo', 'disponibilidad']) {
    metrics[`http_req_duration{endpoint:${endpoint}}`] = { values: { avg: 100, 'p(95)': 200 }, thresholds: { 'p(95)<=2500': { ok: true } } };
    metrics[`http_req_failed{endpoint:${endpoint}}`] = { values: { rate: 0 } };
    metrics[`http_reqs{endpoint:${endpoint}}`] = { values: { count: 100, rate: 5 } };
  }
  return { metrics };
}
test('reporte calcula unidades y limita conclusión a endpoints medidos', () => {
  const r = resumirCarga(resumen()); assert.equal(r.cumple, true);
  assert.match(r.markdown, /evaluado parcialmente/); assert.equal(r.filas.length, 2);
});
test('reporte admite exactamente p95 de 2500 ms', () => {
  const r = resumen(); r.metrics['http_req_duration{endpoint:catalogo}'].values['p(95)'] = 2500;
  assert.equal(resumirCarga(r).cumple, true);
});
test('reporte falla con error exactamente de uno por ciento', () => {
  const r = resumen(); r.metrics['http_req_failed{endpoint:catalogo}'].values.rate = 0.01;
  assert.equal(resumirCarga(r).cumple, false);
});
test('reporte falla si p95 excede el RNF', () => {
  const r = resumen(); r.metrics['http_req_duration{endpoint:disponibilidad}'].values['p(95)'] = 2501;
  assert.equal(resumirCarga(r).cumple, false);
});
test('reporte no convierte métrica ausente en cero', () => {
  const r = resumen(); delete r.metrics['http_req_duration{endpoint:catalogo}'];
  assert.throws(() => resumirCarga(r), /Falta métrica/);
});
test('reporte rechaza ejecución sin solicitudes', () => {
  const r = resumen(); r.metrics['http_reqs{endpoint:catalogo}'].values.count = 0;
  assert.throws(() => resumirCarga(r), /fuera de rango/);
});
test('reporte no oculta fallos de contrato con HTTP 200', () => {
  const r = resumen(); r.metrics.checks.values.rate = 0.99;
  assert.equal(resumirCarga(r).cumple, false);
});
test('reporte conserva el fallo de un umbral global', () => {
  const r = resumen(); r.metrics.global = { thresholds: { limite: { ok: false } } };
  assert.equal(resumirCarga(r).cumple, false);
});

test('escenario mantiene rampa y cinco minutos sostenidos y tolera JSON inválido', async () => {
  const archivo = await readFile(new URL('../load/kmiss-load.js', import.meta.url), 'utf8');
  const script = archivo.replace(/^import .*;\r?\n/gm, '').replace('export const options', 'const options')
    .replace('export default function', 'function').replace('export function handleSummary', 'function handleSummary');
  const comprobaciones = []; const urls = [];
  const contexto = vm.createContext({ __ENV: entorno, configurarCarga: () => configurar({}),
    http: { get(url, opciones) { urls.push(url); assert.equal(opciones.redirects, 0); return { status: 500, headers: {}, json() { throw new Error('No JSON'); } }; } },
    check(res, checks) { for (const c of Object.values(checks)) comprobaciones.push(c(res)); }, sleep() {},
  });
  new vm.Script(script + '\nthis.opciones = options; this.ejecutar = ejecutarEscenarioCarga; this.resumenFinal = handleSummary;').runInContext(contexto);
  assert.equal(JSON.stringify(contexto.opciones.stages), JSON.stringify([{ duration: '30s', target: 50 }, { duration: '5m', target: 50 }, { duration: '30s', target: 0 }]));
  contexto.ejecutar(); assert.equal(urls.length, 2); assert.equal(comprobaciones.every(c => c === false), true);
  const salida = contexto.resumenFinal(resumen());
  assert.equal(JSON.parse(salida['load/resultados/resumen-k6.json']).metrics.checks.values.rate, 1);
});
});
