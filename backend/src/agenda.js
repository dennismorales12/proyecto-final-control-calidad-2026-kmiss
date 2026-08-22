async function validarDisponibilidad(client, { medicoId, sedeId, servicioId, fechaHora, excluirCitaId = null }) {
  if (!medicoId) throw new Error('Debes seleccionar un medico');
  if (!sedeId) throw new Error('Debes seleccionar una sede');
  await client.query('SELECT pg_advisory_xact_lock($1)', [Number(medicoId)]);

  const servicio = await client.query('SELECT duracion_minutos FROM servicios WHERE id=$1 AND activo=TRUE', [servicioId]);
  if (!servicio.rows[0]) throw new Error('Servicio no disponible');
  const duracion = servicio.rows[0].duracion_minutos;

  const horario = await client.query(
    `SELECT 1 FROM horarios_semanales hs
     CROSS JOIN LATERAL jsonb_array_elements(
       COALESCE(hs.semana -> (EXTRACT(DOW FROM $2::timestamp)::integer)::text, '[]'::jsonb)
     ) bloque
     WHERE hs.medico_id=$1 AND hs.activo=TRUE AND hs.sede_id=$4
       AND $2::timestamp::time >= (bloque->>'inicio')::time
       AND ($2::timestamp + ($3 || ' minutes')::interval)::time <= (bloque->>'fin')::time`,
    [medicoId, fechaHora, duracion, sedeId]
  );
  if (!horario.rows[0]) throw new Error('El medico no atiende en esa sede, dia u horario');

  const bloqueo = await client.query(
    `SELECT motivo FROM bloqueos_medicos
     WHERE medico_id=$1 AND sede_id=$2 AND fecha=$3::timestamp::date AND activo=TRUE
       AND hora_inicio < ($3::timestamp + ($4 || ' minutes')::interval)::time
       AND hora_fin > $3::timestamp::time LIMIT 1`,
    [medicoId, sedeId, fechaHora, duracion]
  );
  if (bloqueo.rows[0]) throw new Error(`El medico no esta disponible: ${bloqueo.rows[0].motivo}`);

  const conflicto = await client.query(
    `SELECT 1 FROM citas c JOIN servicios s ON s.id=c.servicio_id
     WHERE c.medico_id=$1 AND c.estado NOT IN ('cancelada','no_asistio')
       AND ($4::integer IS NULL OR c.id <> $4)
       AND c.fecha_hora < $2::timestamp + ($3 || ' minutes')::interval
       AND c.fecha_hora + (s.duracion_minutos || ' minutes')::interval > $2::timestamp
     LIMIT 1`,
    [medicoId, fechaHora, duracion, excluirCitaId]
  );
  if (conflicto.rows[0]) throw new Error('Ese horario ya esta ocupado. Selecciona otro.');
  return duracion;
}

module.exports = { validarDisponibilidad };
