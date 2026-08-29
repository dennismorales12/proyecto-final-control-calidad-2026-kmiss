const express = require('express');
const pool = require('../db');

const router = express.Router();

const recursos = {
  productos: 'productos',
  servicios: 'servicios',
  noticias: 'noticias',
};

router.get('/:recurso/:id', async (req, res) => {
  const tabla = recursos[req.params.recurso];
  const id = Number(req.params.id);
  if (!tabla || !Number.isInteger(id) || id <= 0) {
    return res.status(404).json({ error: 'Imagen no encontrada' });
  }

  try {
    const resultado = await pool.query(
      `SELECT imagen_datos, imagen_mime FROM ${tabla} WHERE id=$1`,
      [id]
    );
    const imagen = resultado.rows[0];
    if (!imagen?.imagen_datos) return res.status(404).json({ error: 'Imagen no encontrada' });

    res.set('Content-Type', imagen.imagen_mime || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=86400');
    return res.send(imagen.imagen_datos);
  } catch (error) {
    console.error('Error al entregar imagen:', error);
    return res.status(500).json({ error: 'No se pudo obtener la imagen' });
  }
});

module.exports = router;
