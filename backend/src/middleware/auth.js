const jwt = require('jsonwebtoken');

/**
 * Verifica que la petición traiga un token JWT válido.
 * Si es válido, adjunta los datos del usuario a req.usuario.
 */
function autenticar(req, res, next) {
  const encabezado = req.headers['authorization'];
  const token = encabezado && encabezado.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No se proporcionó un token de acceso' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido o expirado' });
    }
    req.usuario = payload;
    next();
  });
}

/**
 * Restringe el acceso a una ruta según el rol del usuario autenticado.
 * Uso: permitirRoles('administrador', 'recepcion')
 */
function permitirRoles(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tienes permisos para realizar esta acción' });
    }
    next();
  };
}

module.exports = { autenticar, permitirRoles };
