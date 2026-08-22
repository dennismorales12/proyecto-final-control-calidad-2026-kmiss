const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { autenticar, permitirRoles } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);
router.use(permitirRoles('administrador')); // Todo este módulo es exclusivo del administrador

const ROLES_VALIDOS = ['administrador', 'recepcion', 'medico'];

// GET /api/usuarios — lista sin exponer password_hash
router.get('/', async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT id, nombre, email, telefono, rol, activo, creado_en FROM usuarios ORDER BY nombre ASC'
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// POST /api/usuarios — crear usuario nuevo
router.post('/', async (req, res) => {
  const { nombre, email, telefono, password, rol } = req.body;

  if (!nombre || !email || !password || !rol) {
    return res.status(400).json({ error: 'Nombre, email, contraseña y rol son requeridos' });
  }
  if (!ROLES_VALIDOS.includes(rol)) {
    return res.status(400).json({ error: `Rol inválido. Debe ser uno de: ${ROLES_VALIDOS.join(', ')}` });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const resultado = await pool.query(
      `INSERT INTO usuarios (nombre, email, telefono, password_hash, rol)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nombre, email, telefono, rol, activo, creado_en`,
      [nombre, email, telefono || null, passwordHash, rol]
    );
    if (rol === 'medico') {
      await pool.query(
        `INSERT INTO horarios_semanales (medico_id,sede_id,semana)
         SELECT $1, s.id, '{"0":[],"1":[{"inicio":"08:00","fin":"12:00"},{"inicio":"13:00","fin":"17:00"}],"2":[{"inicio":"08:00","fin":"12:00"},{"inicio":"13:00","fin":"17:00"}],"3":[{"inicio":"08:00","fin":"12:00"},{"inicio":"13:00","fin":"17:00"}],"4":[{"inicio":"08:00","fin":"12:00"},{"inicio":"13:00","fin":"17:00"}],"5":[{"inicio":"08:00","fin":"12:00"},{"inicio":"13:00","fin":"17:00"}],"6":[{"inicio":"08:00","fin":"12:00"},{"inicio":"13:00","fin":"17:00"}]}'::jsonb
         FROM (SELECT id FROM sedes WHERE activo = TRUE ORDER BY id LIMIT 1) s
         ON CONFLICT DO NOTHING`, [resultado.rows[0].id]
      );
    }
    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }
    console.error('Error al crear usuario:', error);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// PUT /api/usuarios/:id — editar nombre, rol o estado activo
router.put('/:id', async (req, res) => {
  const { nombre, telefono, rol, activo } = req.body;

  if (rol && !ROLES_VALIDOS.includes(rol)) {
    return res.status(400).json({ error: `Rol inválido. Debe ser uno de: ${ROLES_VALIDOS.join(', ')}` });
  }

  // Evitar que el admin se desactive o se quite el rol a sí mismo por accidente
  if (Number(req.params.id) === req.usuario.id && (activo === false || (rol && rol !== 'administrador'))) {
    return res.status(400).json({ error: 'No puedes desactivarte ni cambiar tu propio rol' });
  }

  try {
    const resultado = await pool.query(
      `UPDATE usuarios SET nombre = $1, telefono = $2, rol = $3, activo = $4 WHERE id = $5
       RETURNING id, nombre, email, telefono, rol, activo, creado_en`,
      [nombre, telefono || null, rol, activo !== undefined ? activo : true, req.params.id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// PUT /api/usuarios/:id/password — restablecer contraseña
router.put('/:id/password', async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const resultado = await pool.query(
      'UPDATE usuarios SET password_hash = $1 WHERE id = $2 RETURNING id',
      [passwordHash, req.params.id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('Error al restablecer contraseña:', error);
    res.status(500).json({ error: 'Error al restablecer contraseña' });
  }
});

// DELETE /api/usuarios/:id — eliminar (no permite auto-eliminación)
router.delete('/:id', async (req, res) => {
  if (Number(req.params.id) === req.usuario.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
  }
  try {
    const resultado = await pool.query('DELETE FROM usuarios WHERE id = $1 RETURNING id', [req.params.id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ mensaje: 'Usuario eliminado correctamente' });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(409).json({ error: 'No se puede eliminar porque este usuario tiene citas o registros asociados. Desactivalo para conservar el historial.' });
    }
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

module.exports = router;
