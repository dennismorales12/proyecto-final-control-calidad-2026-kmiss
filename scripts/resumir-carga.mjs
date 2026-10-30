import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

function valor(resumen, nombre, propiedad) {
  const resultado = resumen.metrics?.[nombre]?.values?.[propiedad];
  if (typeof resultado !== 'number' || !Number.isFinite(resultado)) throw new Error(`Falta métrica válida ${nombre}.${propiedad}.`);
  return resultado;
}
export function resumirCarga(resumen) {
  const filas = ['catalogo', 'disponibilidad'].map(endpoint => {
    const promedio = valor(resumen, `http_req_duration{endpoint:${endpoint}}`, 'avg');
    const p95 = valor(resumen, `http_req_duration{endpoint:${endpoint}}`, 'p(95)');
    const errores = valor(resumen, `http_req_failed{endpoint:${endpoint}}`, 'rate');
    const solicitudes = valor(resumen, `http_reqs{endpoint:${endpoint}}`, 'count');
    const throughput = valor(resumen, `http_reqs{endpoint:${endpoint}}`, 'rate');
    if (solicitudes <= 0 || throughput <= 0 || promedio < 0 || p95 < 0 || errores < 0 || errores > 1) throw new Error(`Métricas fuera de rango en ${endpoint}.`);
    return { endpoint, promedio, p95, errores, solicitudes, throughput, cumple: p95 <= 2500 && errores < 0.01 };
  });
  const checks = valor(resumen, 'checks', 'rate');
  if (checks < 0 || checks > 1) throw new Error('Tasa de comprobaciones fuera de rango.');
  const umbrales = Object.values(resumen.metrics || {}).flatMap(m => Object.values(m.thresholds || {}));
  const fallos = umbrales.filter(t => t.ok === false).length;
  const cumple = filas.every(f => f.cumple) && checks > 0.99 && fallos === 0;
  return { filas, checks, fallos, cumple, markdown: [
    '# Resultados de carga QA', '',
    '| Endpoint | Promedio ms | p95 ms | Solicitudes por segundo | Error HTTP | Solicitudes | Umbral |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...filas.map(f => `| ${f.endpoint} | ${f.promedio.toFixed(2)} | ${f.p95.toFixed(2)} | ${f.throughput.toFixed(2)} | ${(f.errores * 100).toFixed(2)} % | ${f.solicitudes} | ${f.cumple ? 'Cumple' : 'No cumple'} |`), '',
    `Comprobaciones correctas: ${(checks * 100).toFixed(2)} %. Umbrales fallidos: ${fallos}.`,
    `Resultado de umbrales del escenario: ${cumple ? 'APROBADO' : 'FALLIDO'}.`, '',
    'RNF-01 queda evaluado parcialmente: falta autenticación. Este resumen no acredita por sí solo 50 usuarios sostenidos cinco minutos; contrastar la serie temporal y el log con la configuración versionada.',
  ].join('\n') };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.argv[2] || !process.argv[3]) throw new Error('Uso: node scripts/resumir-carga.mjs resumen.json informe.md');
    const resultado = resumirCarga(JSON.parse(await readFile(process.argv[2], 'utf8')));
    await writeFile(process.argv[3], resultado.markdown + '\n');
    console.log(resultado.markdown);
    if (!resultado.cumple) process.exitCode = 1;
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
