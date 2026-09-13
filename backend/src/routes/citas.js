const express = require('express');
const XLSX = require('xlsx');
const pool = require('../db');
const { autenticar, permitirRoles } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { validarDisponibilidad } = require('../agenda');
const { validarTransicionCita } = require('../domain/stateMachines');

const router = express.Router();
router.use(autenticar);

// Consulta base con joins para traer datos legibles, no solo IDs
const SELECT_BASE = `
  SELECT c.*,
         p.nombre_completo AS paciente_nombre,
         s.nombre AS servicio_nombre, s.duracion_minutos, s.precio,
         m.nombre AS medico_nombre, m.telefono AS medico_telefono,
         se.nombre AS sede_nombre, se.direccion AS sede_direccion
  FROM citas c
  JOIN pacientes p ON p.id = c.paciente_id
  JOIN servicios s ON s.id = c.servicio_id
  LEFT JOIN usuarios m ON m.id = c.medico_id
  JOIN sedes se ON se.id = c.sede_id
`;

// GET /api/citas — soporta ?fecha=YYYY-MM-DD y ?estado=
router.get('/', async (req, res) => {
  const { fecha, desde, hasta, estado, sede_id } = req.query;
  const condiciones = [];
  const valores = [];

  if (fecha) {
    valores.push(fecha);
    condiciones.push(`DATE(c.fecha_hora) = $${valores.length}`);
  }
  if (estado) {
    valores.push(estado);
    condiciones.push(`c.estado = $${valores.length}`);
  }
  if (sede_id) {
    valores.push(sede_id);
    condiciones.push(`c.sede_id = $${valores.length}`);
  }
  if (desde) {
    valores.push(desde);
    condiciones.push(`c.fecha_hora >= $${valores.length}::date`);
  }
  if (hasta) {
    valores.push(hasta);
    condiciones.push(`c.fecha_hora < $${valores.length}::date + INTERVAL '1 day'`);
  }
  if (req.usuario.rol === 'medico') {
    valores.push(req.usuario.id);
    condiciones.push(`c.medico_id = $${valores.length}`);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  try {
    const resultado = await pool.query(
      `${SELECT_BASE} ${where} ORDER BY c.fecha_hora ASC`,
      valores
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al listar citas:', error);
    res.status(500).json({ error: 'Error al obtener citas' });
  }
});

router.get('/medicos/lista', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT DISTINCT u.id,u.nombre,u.telefono FROM usuarios u
       LEFT JOIN horarios_semanales h ON h.medico_id=u.id AND h.activo=TRUE
       WHERE u.rol='medico' AND u.activo=TRUE AND ($1::integer IS NULL OR h.sede_id=$1)
       ORDER BY u.nombre`, [req.query.sede_id || null]
    );
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: 'No se pudieron obtener los medicos' });
  }
});

router.get('/sedes/lista', async (req, res) => {
  try { res.json((await pool.query('SELECT id,nombre,direccion,telefono FROM sedes WHERE activo=TRUE ORDER BY nombre')).rows); }
  catch (error) { res.status(500).json({ error: 'No se pudieron obtener las sedes' }); }
});

router.get('/disponibilidad', async (req, res) => {
  const { medico_id,sede_id,servicio_id,fecha }=req.query;
  if (!medico_id || !sede_id || !servicio_id || !/^\d{4}-\d{2}-\d{2}$/.test(fecha||'')) return res.status(400).json({ error: 'Medico, sede, servicio y fecha son requeridos' });
  try {
    const resultado=await pool.query(`WITH datos AS (
      SELECT s.duracion_minutos,(bloque->>'inicio')::time hora_inicio,(bloque->>'fin')::time hora_fin FROM servicios s
      JOIN horarios_semanales h ON h.medico_id=$1 AND h.sede_id=$2 AND h.activo=TRUE
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(h.semana -> (EXTRACT(DOW FROM $4::date)::integer)::text,'[]'::jsonb)) bloque
      WHERE s.id=$3 AND s.activo=TRUE
    ), slots AS (
      SELECT generate_series($4::date+d.hora_inicio,$4::date+d.hora_fin-(d.duracion_minutos||' minutes')::interval,INTERVAL '30 minutes') inicio,d.duracion_minutos FROM datos d
    ) SELECT DISTINCT TO_CHAR(sl.inicio,'HH24:MI') hora FROM slots sl WHERE sl.inicio>NOW()
      AND NOT EXISTS (SELECT 1 FROM bloqueos_medicos b WHERE b.medico_id=$1 AND b.sede_id=$2 AND b.fecha=$4::date AND b.activo=TRUE AND b.hora_inicio<(sl.inicio+(sl.duracion_minutos||' minutes')::interval)::time AND b.hora_fin>sl.inicio::time)
      AND NOT EXISTS (SELECT 1 FROM citas c JOIN servicios cs ON cs.id=c.servicio_id WHERE c.medico_id=$1 AND c.estado NOT IN ('cancelada','no_asistio') AND c.fecha_hora<sl.inicio+(sl.duracion_minutos||' minutes')::interval AND c.fecha_hora+(cs.duracion_minutos||' minutes')::interval>sl.inicio)
      ORDER BY hora`,[medico_id,sede_id,servicio_id,fecha]);
    res.json(resultado.rows.map((r)=>r.hora));
  } catch (error) { console.error('Error al consultar disponibilidad interna:',error); res.status(500).json({ error: 'No se pudo consultar la disponibilidad' }); }
});

// POST /api/citas — crear (admin y recepción)
router.post('/', permitirRoles('administrador', 'recepcion', 'medico'), async (req, res) => {
  const { paciente_id, servicio_id, medico_id, sede_id, fecha_hora, motivo_consulta } = req.body;
  const medicoFinal = req.usuario.rol === 'medico' ? req.usuario.id : medico_id;

  if (!paciente_id || !servicio_id || !medicoFinal || !sede_id || !fecha_hora) {
    return res.status(400).json({ error: 'Paciente, servicio, medico, sede y fecha/hora son requeridos' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await validarDisponibilidad(client, { medicoId: medicoFinal, sedeId: sede_id, servicioId: servicio_id, fechaHora: fecha_hora });
    const resultado = await client.query(
      `INSERT INTO citas (paciente_id, servicio_id, medico_id, sede_id, fecha_hora, motivo_consulta, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [paciente_id, servicio_id, medicoFinal, sede_id, fecha_hora, motivo_consulta || null, req.usuario.id]
    );
    const citaCompleta = await client.query(`${SELECT_BASE} WHERE c.id = $1`, [resultado.rows[0].id]);
    await client.query('COMMIT');
    res.status(201).json(citaCompleta.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear cita:', error);
    res.status(400).json({ error: error.message || 'Error al crear cita' });
  } finally {
    client.release();
  }
});

// PUT /api/citas/:id/estado — cambiar estado (cualquier rol autenticado)
router.put('/:id/estado', async (req, res) => {
  const { estado } = req.body;
  const estadosValidos = ['solicitada', 'programada', 'confirmada', 'atendida', 'cancelada', 'no_asistio'];

  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  if (estado === 'confirmada' && !['administrador', 'recepcion'].includes(req.usuario.rol)) {
    return res.status(403).json({ error: 'Solo recepcion puede confirmar una solicitud' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const actual = await client.query('SELECT estado, medico_id FROM citas WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!actual.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cita no encontrada' });
    }
    if (req.usuario.rol === 'medico' && Number(actual.rows[0].medico_id) !== Number(req.usuario.id)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'No puedes modificar una cita asignada a otro médico' });
    }
    validarTransicionCita(actual.rows[0].estado, estado);
    await client.query('UPDATE citas SET estado=$1, actualizado_en=NOW() WHERE id=$2', [estado, req.params.id]);
    const citaCompleta = await client.query(`${SELECT_BASE} WHERE c.id = $1`, [req.params.id]);
    await client.query('COMMIT');
    res.json(citaCompleta.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al actualizar estado de cita:', error);
    res.status(400).json({ error: error.message || 'Error al actualizar cita' });
  } finally {
    client.release();
  }
});

// PUT /api/citas/:id — editar cita completa (admin y recepción)
router.put('/:id', permitirRoles('administrador', 'recepcion', 'medico'), async (req, res) => {
  const { paciente_id, servicio_id, medico_id, sede_id, fecha_hora, motivo_consulta, notas_medico } = req.body;

  const medicoFinal = req.usuario.rol === 'medico' ? req.usuario.id : medico_id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (req.usuario.rol === 'medico') {
      const propia = await client.query('SELECT 1 FROM citas WHERE id=$1 AND medico_id=$2', [req.params.id, req.usuario.id]);
      if (!propia.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'No puedes modificar una cita asignada a otro médico' });
      }
    }
    await validarDisponibilidad(client, { medicoId: medicoFinal, sedeId: sede_id, servicioId: servicio_id, fechaHora: fecha_hora, excluirCitaId: req.params.id });
    const resultado = await client.query(
      `UPDATE citas SET
        paciente_id = $1, servicio_id = $2, medico_id = $3, sede_id=$4, fecha_hora = $5,
        motivo_consulta = $6, notas_medico = $7, actualizado_en = NOW()
       WHERE id = $8 RETURNING id`,
      [paciente_id, servicio_id, medicoFinal, sede_id, fecha_hora,
        motivo_consulta || null, notas_medico || null, req.params.id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }
    const citaCompleta = await client.query(`${SELECT_BASE} WHERE c.id = $1`, [req.params.id]);
    await client.query('COMMIT');
    res.json(citaCompleta.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al actualizar cita:', error);
    res.status(400).json({ error: error.message || 'Error al actualizar cita' });
  } finally {
    client.release();
  }
});

// DELETE /api/citas/:id — solo administrador
router.delete('/:id', permitirRoles('administrador'), async (req, res) => {
  try {
    const resultado = await pool.query('DELETE FROM citas WHERE id = $1 RETURNING id', [req.params.id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }
    res.json({ mensaje: 'Cita eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar cita:', error);
    res.status(500).json({ error: 'Error al eliminar cita' });
  }
});

// POST /api/citas/importar — carga masiva desde Excel (solo administrador)
// Columnas esperadas: paciente (nombre completo o documento), servicio (nombre), sede, fecha_hora,
// medico (nombre, opcional), motivo_consulta (opcional), estado (opcional)
// El paciente y el servicio deben existir previamente en el sistema (impórtalos primero).
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

  const obtener = (fila, ...claves) => {
    for (const clave of claves) {
      const encontrada = Object.keys(fila).find((k) => k.toLowerCase().trim() === clave);
      if (encontrada && fila[encontrada] !== null && fila[encontrada] !== '') return fila[encontrada];
    }
    return null;
  };

  const estadosValidos = ['solicitada', 'programada', 'confirmada', 'atendida', 'cancelada', 'no_asistio'];
  let creadas = 0;
  const errores = [];

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i];
    const numeroFila = i + 2;

    const pacienteRef = obtener(fila, 'paciente', 'nombre_paciente', 'nit_paciente', 'nit');
    const servicioRef = obtener(fila, 'servicio', 'nombre_servicio');
    const sedeRef = obtener(fila, 'sede', 'establecimiento');
    const fechaHoraRaw = obtener(fila, 'fecha_hora', 'fecha', 'fecha y hora');
    const medicoRef = obtener(fila, 'medico', 'médico');
    const motivo_consulta = obtener(fila, 'motivo_consulta', 'motivo');
    const estadoRaw = (obtener(fila, 'estado') || 'programada').toString().toLowerCase().trim();
    const estado = estadosValidos.includes(estadoRaw) ? estadoRaw : 'programada';

    if (!pacienteRef || !servicioRef || !fechaHoraRaw) {
      errores.push(`Fila ${numeroFila}: faltan datos requeridos (paciente, servicio o fecha_hora)`);
      continue;
    }

    const fecha_hora = fechaHoraRaw instanceof Date ? fechaHoraRaw.toISOString() : fechaHoraRaw;

    try {
      const paciente = await pool.query(
        `SELECT id FROM pacientes WHERE UPPER(nit) = UPPER($1) OR LOWER(nombre_completo) = LOWER($1) LIMIT 1`,
        [pacienteRef]
      );
      if (paciente.rows.length === 0) {
        errores.push(`Fila ${numeroFila}: no se encontró el paciente "${pacienteRef}" (impórtalo primero)`);
        continue;
      }

      const servicio = await pool.query('SELECT id FROM servicios WHERE LOWER(nombre) = LOWER($1) LIMIT 1', [servicioRef]);
      if (servicio.rows.length === 0) {
        errores.push(`Fila ${numeroFila}: no se encontró el servicio "${servicioRef}"`);
        continue;
      }

      const sede = sedeRef
        ? await pool.query('SELECT id FROM sedes WHERE LOWER(nombre) = LOWER($1) LIMIT 1', [sedeRef])
        : await pool.query('SELECT id FROM sedes WHERE activo=TRUE ORDER BY id LIMIT 1');
      if (sede.rows.length === 0) {
        errores.push(`Fila ${numeroFila}: no se encontró la sede${sedeRef ? ` "${sedeRef}"` : ' activa'}`);
        continue;
      }

      let medico_id = null;
      if (medicoRef) {
        const medico = await pool.query(
          `SELECT id FROM usuarios WHERE LOWER(nombre) = LOWER($1) AND rol = 'medico' LIMIT 1`,
          [medicoRef]
        );
        if (medico.rows.length > 0) medico_id = medico.rows[0].id;
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await validarDisponibilidad(client, {
          medicoId: medico_id,
          sedeId: sede.rows[0].id,
          servicioId: servicio.rows[0].id,
          fechaHora: fecha_hora,
        });
        await client.query(
          `INSERT INTO citas (paciente_id, servicio_id, medico_id, sede_id, fecha_hora, motivo_consulta, estado, creado_por)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [paciente.rows[0].id, servicio.rows[0].id, medico_id, sede.rows[0].id, fecha_hora, motivo_consulta, estado, req.usuario.id]
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      creadas++;
    } catch (error) {
      errores.push(`Fila ${numeroFila}: ${error.message}`);
    }
  }

  res.json({ total: filas.length, creadas, errores });
});

module.exports = router;
