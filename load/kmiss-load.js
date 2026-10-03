import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = __ENV.BASE_URL || 'http://localhost:4000';

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
  },
};

export default function ejecutarEscenarioCarga() {
  const health = http.get(`${baseUrl}/health`, { tags: { endpoint: 'health' } });
  check(health, {
    'health responde 200': (r) => r.status === 200,
    'health declara estado ok': (r) => r.json('estado') === 'ok',
  });

  const catalog = http.get(`${baseUrl}/api/tienda/productos`, { tags: { endpoint: 'catalogo' } });
  check(catalog, {
    'catálogo responde 200': (r) => r.status === 200,
    'catálogo devuelve JSON': (r) => String(r.headers['Content-Type'] || '').includes('application/json'),
  });
  sleep(1);
}

