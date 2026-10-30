import http from 'k6/http';
import { check, sleep } from 'k6';
import { configurarCarga } from './configuracion-qa.mjs';

const destino = configurarCarga(__ENV);
function listaNoVacia(respuesta) {
  try { const datos = respuesta.json(); return Array.isArray(datos) && datos.length > 0; }
  catch (_) { return false; }
}

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '5m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<=2500'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    'http_req_duration{endpoint:catalogo}': ['p(95)<=2500'],
    'http_req_duration{endpoint:disponibilidad}': ['p(95)<=2500'],
    'http_req_failed{endpoint:catalogo}': ['rate<0.01'],
    'http_req_failed{endpoint:disponibilidad}': ['rate<0.01'],
    'http_reqs{endpoint:catalogo}': ['count>0'],
    'http_reqs{endpoint:disponibilidad}': ['count>0'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(95)'],
};

export default function ejecutarEscenarioCarga() {
  const catalog = http.get(destino.catalogo, { tags: { endpoint: 'catalogo' }, timeout: '15s', redirects: 0 });
  check(catalog, {
    'catálogo responde 200': (r) => r.status === 200,
    'catálogo devuelve JSON': (r) => String(r.headers['Content-Type'] || '').includes('application/json'),
    'catálogo contiene productos de prueba': listaNoVacia,
  });
  const agenda = http.get(destino.disponibilidad, { tags: { endpoint: 'disponibilidad' }, timeout: '15s', redirects: 0 });
  check(agenda, {
    'disponibilidad responde 200': (r) => r.status === 200,
    'disponibilidad contiene horarios de prueba': listaNoVacia,
  });
  sleep(1);
}

export function handleSummary(datos) {
  return {
    [__ENV.RESUMEN_JSON || 'load/resultados/resumen-k6.json']: JSON.stringify(datos, null, 2),
    stdout: '\nCarga terminada. Revisar resumen JSON, serie temporal y reporte de umbrales.\n',
  };
}

