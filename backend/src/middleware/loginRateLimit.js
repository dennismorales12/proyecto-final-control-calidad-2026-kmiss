const intentos = new Map();

function crearLimitadorLogin({ maxIntentos = 10, ventanaMs = 15 * 60 * 1000 } = {}) {
  return (req, res, next) => {
    const ahora = Date.now();
    const clave = `${req.ip || req.socket?.remoteAddress || 'desconocida'}:${String(req.body?.email || '').toLowerCase()}`;
    const registro = intentos.get(clave);
    if (!registro || ahora - registro.inicio >= ventanaMs) {
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
}

module.exports = { crearLimitadorLogin, limpiarIntentos };
