const multer = require('multer');

const tiposPermitidos = new Set(['image/jpeg', 'image/png', 'image/webp']);

module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => tiposPermitidos.has(file.mimetype)
    ? cb(null, true)
    : cb(new Error('Solo se permiten imagenes JPG, PNG o WEBP')),
});
