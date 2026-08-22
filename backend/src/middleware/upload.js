const multer = require('multer');

const almacenamiento = multer.memoryStorage();

function filtroArchivo(req, file, cb) {
  const nombreValido = /\.(xlsx|xls)$/i.test(file.originalname);
  if (nombreValido) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos Excel (.xlsx o .xls)'));
  }
}

const upload = multer({
  storage: almacenamiento,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: filtroArchivo,
});

module.exports = upload;
