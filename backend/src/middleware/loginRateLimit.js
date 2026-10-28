const intentos = new Map();
let solicitudesDesdeLimpieza = 0;

function depurarIntentos(ahora, ventanaMs, maxClaves) {
  solicitudesDesdeLimpieza += 1;
  if (solicitudesDesdeLimpieza % 100 === 0) {
    for (const [clave, registro] of intentos) {
      if (ahora - registro.inicio >= ventanaMs) intentos.delete(clave);
    }
  }
  while (intentos.size >= maxClaves) {
    const claveMasAntigua = intentos.keys().next().value;
    if (claveMasAntigua === undefined) break;
    intentos.delete(claveMasAntigua);
  }
}

function crearLimitadorLogin({ maxIntentos = 10, ventanaMs = 15 * 60 * 1000, maxClaves = 10000 } = {}) {
  return (req, res, next) => {
    const ahora = Date.now();
    const clave = `${req.ip || req.socket?.remoteAddress || 'desconocida'}:${String(req.body?.email || '').toLowerCase()}`;
    const registro = intentos.get(clave);
    if (!registro || ahora - registro.inicio >= ventanaMs) {
      if (!registro) depurarIntentos(ahora, ventanaMs, maxClaves);
      intentos.set(clave, { inicio: ahora, cantidad: 1 });
      return next();
    }
    registro.cantidad += 1;
    if (registro.cantidad > maxIntentos) {
      const esperaSegundos = Math.ceil((ventanaMs - (ahora - registro.inicio)) / 1000);
      res.set('Retry-After', String(esperaSegundos));
      return res.status(429).json({ error: 'Demasiados intentos. Intenta nuevamente más tarde.' });
    }
    next();
  };
}

function limpiarIntentos() {
  intentos.clear();
  solicitudesDesdeLimpieza = 0;
}

module.exports = { crearLimitadorLogin, limpiarIntentos };
