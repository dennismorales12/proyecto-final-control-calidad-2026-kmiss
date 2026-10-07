const express = require('express');
const XLSX = require('xlsx');
const pool = require('../db');
const { autenticar, permitirRoles } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { obtenerCelda: obtener } = require('../importacionExcel');

const router = express.Router();
router.use(autenticar);

const COLUMNAS_PACIENTE = `id, nit, nombre_completo, fecha_nacimiento, telefono, email,
  direccion, tipo_sangre, alergias, contacto_emergencia_nombre,
  contacto_emergencia_telefono, creado_por, creado_en, actualizado_en`;

// GET /api/pacientes — lista con búsqueda opcional (?q=texto)
router.get('/', async (req, res) => {
  const { q } = req.query;
  try {
    let resultado;
    if (q) {
      resultado = await pool.query(
        `SELECT ${COLUMNAS_PACIENTE} FROM pacientes
         WHERE nombre_completo ILIKE $1 OR nit ILIKE $1 OR telefono ILIKE $1 OR email ILIKE $1
         ORDER BY nombre_completo ASC`,
        [`%${q}%`]
      );
    } else {
      resultado = await pool.query(`SELECT ${COLUMNAS_PACIENTE} FROM pacientes ORDER BY nombre_completo ASC`);
    }
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al listar pacientes:', error);
    res.status(500).json({ error: 'Error al obtener pacientes' });
  }
});

// GET /api/pacientes/:id/historial — ficha comercial y clínica del paciente
router.get('/:id/historial', async (req, res) => {
  try {
    const paciente = await pool.query(`SELECT ${COLUMNAS_PACIENTE} FROM pacientes WHERE id = $1`, [req.params.id]);
    if (paciente.rows.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }
    const [citas, ventas, pedidos] = await Promise.all([
      pool.query(
        `SELECT c.id, c.fecha_hora, c.estado, c.motivo_consulta, c.notas_medico,
                s.nombre AS servicio, s.precio, u.nombre AS medico, se.nombre AS sede
         FROM citas c JOIN servicios s ON s.id=c.servicio_id
         LEFT JOIN usuarios u ON u.id=c.medico_id
         JOIN sedes se ON se.id=c.sede_id
         WHERE c.paciente_id=$1 ORDER BY c.fecha_hora DESC`,
        [req.params.id]
      ),
      pool.query(
        `SELECT v.id, v.creado_en, v.estado, v.total, v.metodo_pago,
                COALESCE(json_agg(json_build_object('descripcion',d.descripcion,'cantidad',d.cantidad,
                  'precio_unitario',d.precio_unitario,'subtotal',d.subtotal)
                  ORDER BY d.id) FILTER (WHERE d.id IS NOT NULL), '[]') AS detalles
         FROM ventas v LEFT JOIN venta_detalles d ON d.venta_id=v.id
         WHERE v.paciente_id=$1 GROUP BY v.id ORDER BY v.creado_en DESC`,
        [req.params.id]
      ),
      pool.query(
        `SELECT p.id, p.creado_en, p.estado, p.total,
                COALESCE(json_agg(json_build_object('descripcion',d.descripcion,'cantidad',d.cantidad,
                  'precio_unitario',d.precio_unitario,'subtotal',d.subtotal)
                  ORDER BY d.id) FILTER (WHERE d.id IS NOT NULL), '[]') AS detalles
         FROM pedidos_publicos p LEFT JOIN pedido_detalles d ON d.pedido_id=p.id
         WHERE p.paciente_id=$1 GROUP BY p.id ORDER BY p.creado_en DESC`,
        [req.params.id]
      ),
    ]);
    res.json({ paciente: paciente.rows[0], citas: citas.rows, ventas: ventas.rows, pedidos: pedidos.rows });
  } catch (error) {
    console.error('Error al obtener historial del paciente:', error);
    res.status(500).json({ error: 'Error al obtener el historial del paciente' });
  }
});

// GET /api/pacientes/:id
router.get('/:id', async (req, res) => {
  try {
    const resultado = await pool.query(`SELECT ${COLUMNAS_PACIENTE} FROM pacientes WHERE id = $1`, [req.params.id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }
    res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al obtener paciente:', error);
    res.status(500).json({ error: 'Error al obtener paciente' });
  }
});

// POST /api/pacientes — crear (admin y recepción)
router.post('/', permitirRoles('administrador', 'recepcion'), async (req, res) => {
  const {
    nit, nombre_completo, fecha_nacimiento, telefono,
    email, direccion, tipo_sangre, alergias,
    contacto_emergencia_nombre, contacto_emergencia_telefono,
  } = req.body;

  if (!nombre_completo) {
    return res.status(400).json({ error: 'El nombre completo es requerido' });
  }

  try {
    const resultado = await pool.query(
      `INSERT INTO pacientes
        (nit, nombre_completo, fecha_nacimiento, telefono, email,
         direccion, tipo_sangre, alergias, contacto_emergencia_nombre,
         contacto_emergencia_telefono, creado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING ${COLUMNAS_PACIENTE}`,
      [nit ? String(nit).toUpperCase().replace(/[^0-9A-Z]/g, '') : null,
        nombre_completo, fecha_nacimiento || null, telefono || null,
        email || null, direccion || null, tipo_sangre || null, alergias || null,
        contacto_emergencia_nombre || null, contacto_emergencia_telefono || null,
        req.usuario.id]
    );
    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un paciente con ese NIT' });
    }
    console.error('Error al crear paciente:', error);
    res.status(500).json({ error: 'Error al crear paciente' });
  }
});

// PUT /api/pacientes/:id — actualizar (admin y recepción)
router.put('/:id', permitirRoles('administrador', 'recepcion'), async (req, res) => {
  const {
    nit, nombre_completo, fecha_nacimiento, telefono,
    email, direccion, tipo_sangre, alergias,
    contacto_emergencia_nombre, contacto_emergencia_telefono,
  } = req.body;

  try {
    const resultado = await pool.query(
      `UPDATE pacientes SET
        nit = $1, nombre_completo = $2, fecha_nacimiento = $3,
        telefono = $4, email = $5, direccion = $6, tipo_sangre = $7, alergias = $8,
        contacto_emergencia_nombre = $9, contacto_emergencia_telefono = $10,
        actualizado_en = NOW()
       WHERE id = $11
       RETURNING ${COLUMNAS_PACIENTE}`,
      [nit ? String(nit).toUpperCase().replace(/[^0-9A-Z]/g, '') : null,
        nombre_completo, fecha_nacimiento || null, telefono || null,
        email || null, direccion || null, tipo_sangre || null, alergias || null,
        contacto_emergencia_nombre || null, contacto_emergencia_telefono || null,
        req.params.id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }
    await pool.query(
      'UPDATE pedidos_publicos SET nit_cliente=$1 WHERE paciente_id=$2',
      [resultado.rows[0].nit, req.params.id]
    );
    res.json(resultado.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un paciente con ese NIT' });
    }
    console.error('Error al actualizar paciente:', error);
    res.status(500).json({ error: 'Error al actualizar paciente' });
  }
});

// DELETE /api/pacientes/:id — solo administrador
router.delete('/:id', permitirRoles('administrador'), async (req, res) => {
  try {
    const resultado = await pool.query('DELETE FROM pacientes WHERE id = $1 RETURNING id', [req.params.id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }
    res.json({ mensaje: 'Paciente eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar paciente:', error);
    res.status(500).json({ error: 'Error al eliminar paciente' });
  }
});


async function guardarPacienteImportado(fila, nombre_completo, usuarioId) {
    const nit = obtener(fila, 'nit');
    const telefono = obtener(fila, 'telefono', 'teléfono');
    const email = obtener(fila, 'email', 'correo');
    const fechaNacRaw = obtener(fila, 'fecha_nacimiento', 'fecha nacimiento');
    const fecha_nacimiento = fechaNacRaw instanceof Date ? fechaNacRaw.toISOString().split('T')[0] : fechaNacRaw;
    const direccion = obtener(fila, 'direccion', 'dirección');
    const tipo_sangre = obtener(fila, 'tipo_sangre', 'tipo de sangre');
    const alergias = obtener(fila, 'alergias');
    const contacto_emergencia_nombre = obtener(fila, 'contacto_emergencia_nombre', 'contacto de emergencia');
    const contacto_emergencia_telefono = obtener(fila, 'contacto_emergencia_telefono', 'telefono de emergencia', 'teléfono de emergencia');

      let existenteId = null;
      if (nit) {
        const existente = await pool.query(
          'SELECT id FROM pacientes WHERE UPPER(nit)=UPPER($1) LIMIT 1',
          [nit]
        );
        if (existente.rows.length > 0) existenteId = existente.rows[0].id;
      }

      if (existenteId) {
        await pool.query(
          `UPDATE pacientes SET nit=COALESCE($1,nit), nombre_completo=$2, telefono=$3, email=$4, fecha_nacimiento=$5,
            direccion=$6, tipo_sangre=$7, alergias=$8, contacto_emergencia_nombre=$9,
            contacto_emergencia_telefono=$10, actualizado_en=NOW() WHERE id=$11`,
          [nit ? String(nit).toUpperCase().replace(/[^0-9A-Z]/g, '') : null, nombre_completo, telefono, email, fecha_nacimiento, direccion, tipo_sangre, alergias, contacto_emergencia_nombre, contacto_emergencia_telefono, existenteId]
        );
        return 'actualizados';
      } else {
        await pool.query(
          `INSERT INTO pacientes (nit, nombre_completo, telefono, email, fecha_nacimiento, direccion,
            tipo_sangre, alergias, contacto_emergencia_nombre, contacto_emergencia_telefono, creado_por)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [nit ? String(nit).toUpperCase().replace(/[^0-9A-Z]/g, '') : null, nombre_completo, telefono, email, fecha_nacimiento, direccion, tipo_sangre, alergias, contacto_emergencia_nombre, contacto_emergencia_telefono, usuarioId]
        );
        return 'creados';
      }
}

// POST /api/pacientes/importar — carga masiva desde Excel (solo administrador)
// Columnas esperadas: nombre_completo, nit, fecha_nacimiento, telefono, email, direccion,
// tipo_sangre, alergias, contacto_emergencia_nombre y contacto_emergencia_telefono.
// Si el NIT ya existe, se actualiza el registro; si no, se crea uno nuevo.
router.post('/importar', permitirRoles('administrador'), upload.single('archivo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ningún archivo' });
  }

  let filas;
  try {
    const libro = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const hoja = libro.Sheets[libro.SheetNames[0]];
    filas = XLSX.utils.sheet_to_json(hoja, { defval: null });
  } catch (error) {
    return res.status(400).json({ error: 'No se pudo leer el archivo. Verifica que sea un Excel válido (.xlsx o .xls).' });
  }

  if (filas.length === 0) {
    return res.status(400).json({ error: 'El archivo no contiene filas de datos' });
  }


  let creados = 0, actualizados = 0;
  const errores = [];

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i];
    const numeroFila = i + 2; // +2 porque la fila 1 es el encabezado

    const nombre_completo = obtener(fila, 'nombre_completo', 'nombre', 'nombre completo');
    if (!nombre_completo) {
      errores.push(`Fila ${numeroFila}: falta el nombre completo, se omitió`);
      continue;
    }

    try {
      const resultado = await guardarPacienteImportado(fila, nombre_completo, req.usuario.id);
      if (resultado === 'actualizados') actualizados++;
      else creados++;
    } catch (error) {
      errores.push(`Fila ${numeroFila} (${nombre_completo}): ${error.message}`);
    }
  }

  res.json({ total: filas.length, creados, actualizados, errores });
});

module.exports = router;
