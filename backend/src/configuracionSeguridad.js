function crearOpcionesCors(origenes = '') {
  const permitidos = new Set(origenes.split(',').map((origen) => origen.trim()).filter(Boolean));
  return { origin(origen, callback) {
    // Sin Origin (Newman/servidor) no se conceden cabeceras CORS.
    callback(null, permitidos.has(origen));
  } };
}

function obtenerClaveDemo(entorno = process.env) {
  const clave = entorno.DEMO_PASSWORD;
  if (!clave || clave.length < 8) throw new Error('Configura DEMO_PASSWORD con al menos 8 caracteres antes de crear datos de prueba');
  return clave;
}

module.exports = { crearOpcionesCors, obtenerClaveDemo };
