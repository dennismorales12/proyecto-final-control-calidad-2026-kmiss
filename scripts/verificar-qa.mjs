import { configurarCarga } from '../load/configuracion-qa.mjs';
import { pathToFileURL } from 'node:url';

export async function verificarQa(entorno, solicitar = fetch, ahora = new Date()) {
  const destino = configurarCarga(entorno, ahora);
  const comprobados = [];
  for (const campo of ['catalogo', 'disponibilidad']) {
    const respuesta = await solicitar(destino[campo], { redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (respuesta.status !== 200) throw new Error(`${campo}: se esperaba HTTP 200, recibido ${respuesta.status}.`);
    if (!String(respuesta.headers.get('content-type') || '').includes('application/json')) throw new Error(`${campo}: no devolvió JSON.`);
    const datos = await respuesta.json();
    if (!Array.isArray(datos) || datos.length === 0) throw new Error(`${campo}: faltan datos u horarios; revisar las referencias en QA.`);
    if (campo === 'catalogo' && !datos.every(p => p && Number.isInteger(p.id) && p.id > 0 && p.precio_final != null && Number.isFinite(Number(p.precio_final)) && Number(p.precio_final) >= 0)) {
      throw new Error('catalogo: estructura de producto no válida.');
    }
    if (campo === 'disponibilidad' && !datos.every(h => typeof h === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(h))) {
      throw new Error('disponibilidad: estructura de horarios no válida.');
    }
    comprobados.push({ endpoint: campo, estado: respuesta.status, registros: datos.length });
  }
  return { ambiente: 'QA', host: new URL(destino.baseUrl).hostname, comprobados };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verificarQa(process.env).then(r => console.log(JSON.stringify(r, null, 2))).catch(e => { console.error(e.message); process.exitCode = 1; });
}
