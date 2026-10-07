const express = require('express');
const pool = require('../db');
const { autenticar, permitirRoles } = require('../middleware/auth');
const uploadImagenServicio = require('../middleware/uploadImagenServicio');
const { validarServicio } = require('../domain/validation');

const router = express.Router();
router.use(autenticar);

// GET /api/servicios
router.get('/', async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT id,nombre,descripcion,duracion_minutos,precio,especialidad,imagen_url,activo,creado_en FROM servicios ORDER BY nombre ASC'
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al listar servicios:', error);
    res.status(500).json({ error: 'Error al obtener servicios' });
  }
});

// POST /api/servicios — solo administrador
router.post('/', permitirRoles('administrador'), async (req, res) => {
  const { nombre, descripcion, duracion_minutos, precio, especialidad } = req.body;

  let valores;
  try { valores = validarServicio({ nombre, duracion_minutos, precio }); }
  catch (error) { return res.status(400).json({ error: error.message }); }

  try {
    const resultado = await pool.query(
      `INSERT INTO servicios (nombre, descripcion, duracion_minutos, precio, especialidad)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id,nombre,descripcion,duracion_minutos,precio,especialidad,imagen_url,activo,creado_en`,
      [String(nombre).trim(), descripcion || null, valores.duracion, valores.precio, especialidad || null]
    );
    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al crear servicio:', error);
    res.status(500).json({ error: 'Error al crear servicio' });
  }
});

router.post('/:id/imagen', permitirRoles('administrador'), uploadImagenServicio.single('imagen'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibio ninguna imagen' });
  try {
    const imagenUrl = `/api/media/servicios/${req.params.id}?v=${Date.now()}`;
    const resultado = await pool.query(
      'UPDATE servicios SET imagen_url=$1, imagen_datos=$2, imagen_mime=$3 WHERE id=$4 RETURNING id,nombre,imagen_url',
      [imagenUrl, req.file.buffer, req.file.mimetype, req.params.id]
    );
    if (!resultado.rows[0]) return res.status(404).json({ error: 'Servicio no encontrado' });
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'No se pudo guardar la imagen del servicio' });
  }
});

// PUT /api/servicios/:id — solo administrador
router.put('/:id', permitirRoles('administrador'), async (req, res) => {
  const { nombre, descripcion, duracion_minutos, precio, especialidad, activo } = req.body;
  let valores;
  try { valores = validarServicio({ nombre, duracion_minutos, precio }); }
  catch (error) { return res.status(400).json({ error: error.message }); }

  try {
    const resultado = await pool.query(
      `UPDATE servicios SET
        nombre = $1, descripcion = $2, duracion_minutos = $3,
        precio = $4, especialidad = $5, activo = $6
       WHERE id = $7
       RETURNING id,nombre,descripcion,duracion_minutos,precio,especialidad,imagen_url,activo,creado_en`,
      [String(nombre).trim(), descripcion || null, valores.duracion, valores.precio,
        especialidad || null, activo !== undefined ? activo : true, req.params.id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }
    res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al actualizar servicio:', error);
    res.status(500).json({ error: 'Error al actualizar servicio' });
  }
});

// DELETE /api/servicios/:id — solo administrador
router.delete('/:id', permitirRoles('administrador'), async (req, res) => {
  try {
    const resultado = await pool.query('DELETE FROM servicios WHERE id = $1 RETURNING id', [req.params.id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }
    res.json({ mensaje: 'Servicio eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar servicio:', error);
    res.status(500).json({ error: 'Error al eliminar servicio' });
  }
});

module.exports = router;
