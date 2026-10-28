const fs = require('node:fs');
const path = require('node:path');

// Alcance fijo derivado de los cinco módulos de E2. Se usan los mismos archivos
// existentes en la línea base y en el candidato; no se inflan resultados con archivos nuevos.
const modulos = {
  'Autenticación y autorización': ['middleware/auth.js', 'routes/auth.js'],
  'Agenda y citas': ['agenda.js', 'routes/citas.js'],
  'Ventas e inventario': ['routes/ventas.js', 'routes/productos.js'],
  'Pedidos y pagos': ['reservas.js', 'routes/pedidos.js', 'routes/tienda.js'],
  'Pacientes e historial': ['routes/pacientes.js'],
};
const [baseArchivo, finalArchivo, directorio = 'test-results/cobertura-critica'] = process.argv.slice(2);
if (!baseArchivo || !finalArchivo) throw new Error('Indicar JSON de cobertura base y final');
const base = JSON.parse(fs.readFileSync(baseArchivo, 'utf8'));
const final = JSON.parse(fs.readFileSync(finalArchivo, 'utf8'));
function cobertura(reporte, archivos) {
  let total = 0;
  let cubiertas = 0;
  for (const archivo of archivos) {
    const entrada = Object.entries(reporte).find(([nombre]) => nombre.replaceAll('\\', '/').endsWith(`/src/${archivo}`));
    if (!entrada) throw new Error(`Falta cobertura de ${archivo}; no se asume cero`);
    total += entrada[1].lines.total;
    cubiertas += entrada[1].lines.covered;
  }
  return { total, cubiertas, porcentaje: total ? cubiertas * 100 / total : 0 };
}
const resultados = Object.entries(modulos).map(([modulo, archivos]) => {
  const inicial = cobertura(base, archivos);
  const actual = cobertura(final, archivos);
  const incremento = actual.porcentaje - inicial.porcentaje;
  return { modulo, archivos, inicial, actual, incremento, cumple: incremento >= 20 };
});
const archivos = Object.values(modulos).flat();
const inicial = cobertura(base, archivos);
const actual = cobertura(final, archivos);
const incremento = actual.porcentaje - inicial.porcentaje;
const reporte = {
  creadoEn: new Date().toISOString(),
  revisionBase: '55c90b29d479102c6de16448dd2bd6d77845f148',
  notaBase: 'Línea base reconstruida de la versión original de DEV; no sustituye una medición histórica registrada en sección 2.4.',
  revisionFinal: process.env.BUILD_SOURCEVERSION || 'ejecución local',
  criterio: 'Incremento mínimo de 20 puntos porcentuales de cobertura de líneas en alcance fijo de E2',
  resultados,
  consolidado: { inicial, actual, incremento, cumple: incremento >= 20 },
};
fs.mkdirSync(directorio, { recursive: true });
fs.writeFileSync(path.join(directorio, 'comparativa.json'), JSON.stringify(reporte, null, 2));
const porcentaje = (n) => n.toFixed(2);
const filas = resultados.map((r) => `| ${r.modulo} | ${r.inicial.cubiertas}/${r.inicial.total} (${porcentaje(r.inicial.porcentaje)} %) | ${r.actual.cubiertas}/${r.actual.total} (${porcentaje(r.actual.porcentaje)} %) | ${porcentaje(r.incremento)} | ${r.cumple ? 'Cumple' : 'Pendiente'} |`);
const texto = [
  '# Cobertura de módulos críticos', '',
  `Revisión base: ${reporte.revisionBase}. Revisión final: ${reporte.revisionFinal}.`, '',
  reporte.notaBase, '',
  '| Módulo E2 | Línea base | Candidato | Incremento (puntos) | Resultado |',
  '| --- | --- | --- | --- | --- |', ...filas,
  `| Consolidado del alcance | ${porcentaje(inicial.porcentaje)} % | ${porcentaje(actual.porcentaje)} % | ${porcentaje(incremento)} | ${incremento >= 20 ? 'Cumple' : 'Pendiente'} |`, '',
  'Los porcentajes se calculan por líneas cubiertas / líneas ejecutables, no por promedio de porcentajes. Los módulos se reportan individualmente además del consolidado. No se cambia el alcance entre mediciones.', '',
].join('\n');
fs.writeFileSync(path.join(directorio, 'comparativa.md'), texto);
console.log(texto);
if (incremento < 20) process.exitCode = 1;
