const fs = require('fs');
const path = require('path');
const multer = require('multer');

const carpeta = path.join(__dirname, '..', '..', 'uploads', 'servicios');
fs.mkdirSync(carpeta, { recursive: true });
const extensiones = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

module.exports = multer({
  storage: multer.diskStorage({
    destination: carpeta,
    filename: (req, file, cb) => cb(null, `${req.params.id}-${Date.now()}${extensiones[file.mimetype] || ''}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => extensiones[file.mimetype]
    ? cb(null, true)
    : cb(new Error('Solo se permiten imagenes JPG, PNG o WEBP')),
});
