export function configurarCarga(entorno, ahora = new Date()) {
  if (entorno.AMBIENTE !== 'QA') throw new Error('La carga requiere AMBIENTE=QA.');
  const host = String(entorno.QA_HOST || '').toLowerCase();
  if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)?\.azurewebsites\.net$/.test(host) || !host.split('.')[0].split('-').includes('qa')) {
    throw new Error('QA_HOST debe identificar el App Service de QA verificado.');
  }
  const baseUrl = String(entorno.BASE_URL || '').replace(/\/$/, '');
  if (baseUrl.toLowerCase() !== `https://${host}`) {
    throw new Error('BASE_URL debe coincidir exactamente con el host HTTPS de QA, sin ruta ni credenciales.');
  }
  const hostProduccion = String(entorno.PROD_HOST || '').toLowerCase();
  if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(hostProduccion)) throw new Error('Configura PROD_HOST verificado antes de habilitar la carga.');
  if (host === hostProduccion) throw new Error('No se permite cargar producción.');
  for (const campo of ['MEDICO_ID', 'SEDE_ID', 'SERVICIO_ID']) {
    if (!/^[1-9]\d*$/.test(String(entorno[campo] || ''))) throw new Error(`Configura ${campo} con un ID válido de QA.`);
  }
  const fecha = String(entorno.FECHA || '');
  const dia = new Date(`${fecha}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Number.isFinite(dia.getTime()) || dia.toISOString().slice(0, 10) !== fecha) {
    throw new Error('FECHA debe ser una fecha real YYYY-MM-DD.');
  }
  if (fecha <= ahora.toISOString().slice(0, 10)) throw new Error('FECHA debe ser posterior al día actual UTC.');
  return {
    baseUrl,
    catalogo: `${baseUrl}/api/tienda/productos`,
    disponibilidad: `${baseUrl}/api/tienda/disponibilidad?medico_id=${entorno.MEDICO_ID}&sede_id=${entorno.SEDE_ID}&servicio_id=${entorno.SERVICIO_ID}&fecha=${fecha}`,
  };
}
