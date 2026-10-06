const fs = require('node:fs');
const path = require('node:path');

const proyecto = 'dennismorales12_proyecto-final-control-calidad-2026-kmiss';
const [directorio = 'test-results/sonar', pullRequest] = process.argv.slice(2);
const filtros = pullRequest ? { pullRequest } : {};
async function obtener(endpoint, parametros) {
  const url = new URL(`https://sonarcloud.io/api/${endpoint}`);
  for (const [clave, valor] of Object.entries(parametros)) url.searchParams.set(clave, valor);
  const respuesta = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!respuesta.ok) throw new Error(`${endpoint}: HTTP ${respuesta.status}`);
  return respuesta.json();
}
async function ejecutar() {
  const metricas = await obtener('measures/component', {
    component: proyecto, ...filtros,
    metricKeys: 'bugs,vulnerabilities,code_smells,duplicated_lines_density,sqale_index,coverage,ncloc',
  });
  const puerta = await obtener('qualitygates/project_status', { projectKey: proyecto, ...filtros });
  const hallazgos = [];
  let pagina = 1;
  let total;
  do {
    const resultado = await obtener('issues/search', { componentKeys: proyecto, ...filtros, resolved: 'false', ps: 500, p: pagina });
    hallazgos.push(...resultado.issues);
    total = resultado.paging.total;
    pagina++;
  } while (hallazgos.length < total);
  const severidades = {};
  for (const hallazgo of hallazgos) severidades[hallazgo.severity] = (severidades[hallazgo.severity] || 0) + 1;
  const reporte = { capturadoEn: new Date().toISOString(), proyecto, pullRequest: pullRequest || null, metricas: metricas.component.measures, puerta: puerta.projectStatus, severidades, hallazgos };
  fs.mkdirSync(directorio, { recursive: true });
  fs.writeFileSync(path.join(directorio, 'sonar.json'), JSON.stringify(reporte, null, 2));
  console.log(JSON.stringify({ capturadoEn: reporte.capturadoEn, metricas: reporte.metricas, puerta: reporte.puerta.status, severidades, prioritarios: hallazgos.filter(i => ['BLOCKER', 'CRITICAL'].includes(i.severity)).map(i => ({ key: i.key, regla: i.rule, archivo: i.component, linea: i.line, severidad: i.severity, mensaje: i.message })) }, null, 2));
}
ejecutar().catch(error => { console.error(error.message); process.exitCode = 1; });
