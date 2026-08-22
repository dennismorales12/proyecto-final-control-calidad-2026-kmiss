const express = require('express');
const pool = require('../db');
const { liberarReservasVencidas } = require('../reservas');
const { validarDisponibilidad } = require('../agenda');

const router = express.Router();

function normalizarNit(valor) {
  return String(valor || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

async function asegurarPaciente(client, { nit, nombre, telefono, email, direccion, origen }) {
  const nitNormalizado = normalizarNit(nit);
  let paciente = await client.query(
    `SELECT id FROM pacientes
     WHERE UPPER(nit)=$1 OR ((nit IS NULL OR TRIM(nit)='') AND
       (telefono=$2 OR ($3::varchar IS NOT NULL AND LOWER(email)=LOWER($3))))
     ORDER BY CASE WHEN UPPER(nit)=$1 THEN 0 ELSE 1 END, id LIMIT 1`,
    [nitNormalizado, telefono, email || null]
  );
  if (!paciente.rows[0]) {
    paciente = await client.query(
      `INSERT INTO pacientes (nit, nombre_completo, telefono, email, direccion, notas)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [nitNormalizado, nombre, telefono, email || null, direccion || null, `Registro creado desde ${origen}`]
    );
  } else {
    await client.query(
      `UPDATE pacientes SET nit=$1, nombre_completo=$2, telefono=$3,
       email=COALESCE($4,email), direccion=COALESCE($5,direccion), actualizado_en=NOW()
       WHERE id=$6`,
      [nitNormalizado, nombre, telefono, email || null, direccion || null, paciente.rows[0].id]
    );
    await client.query(
      'UPDATE pedidos_publicos SET nit_cliente=COALESCE(nit_cliente,$1) WHERE paciente_id=$2',
      [nitNormalizado, paciente.rows[0].id]
    );
  }
  return paciente.rows[0].id;
}

router.get('/servicios', async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT id, nombre, descripcion, duracion_minutos, precio, especialidad, imagen_url FROM servicios WHERE activo=TRUE ORDER BY nombre'
    );
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: 'No se pudieron obtener los servicios' });
  }
});

router.get('/medicos', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT DISTINCT u.id, u.nombre FROM usuarios u
       JOIN horarios_semanales h ON h.medico_id=u.id AND h.activo=TRUE
       WHERE u.rol='medico' AND u.activo=TRUE AND ($1::integer IS NULL OR h.sede_id=$1) ORDER BY u.nombre`,
      [req.query.sede_id || null]
    );
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: 'No se pudieron obtener los medicos' });
  }
});

router.get('/sedes', async (req, res) => {
  try { res.json((await pool.query('SELECT id,nombre,direccion,telefono FROM sedes WHERE activo=TRUE ORDER BY nombre')).rows); }
  catch (error) { res.status(500).json({ error: 'No se pudieron obtener las sedes' }); }
});

router.get('/noticias', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT id,titulo,resumen,contenido,fecha_evento,enlace_url,imagen_url,creado_en
       FROM noticias WHERE activo=TRUE
       ORDER BY COALESCE(fecha_evento,creado_en::date) DESC, creado_en DESC`
    );
    res.json(resultado.rows);
  } catch (error) { res.status(500).json({ error: 'No se pudieron obtener las noticias' }); }
});

router.get('/disponibilidad', async (req, res) => {
  const { medico_id, sede_id, servicio_id, fecha } = req.query;
  if (!medico_id || !sede_id || !servicio_id || !/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) {
    return res.status(400).json({ error: 'Sede, medico, servicio y fecha son requeridos' });
  }
  try {
    const resultado = await pool.query(
      `WITH datos AS (
         SELECT s.duracion_minutos, (bloque->>'inicio')::time hora_inicio, (bloque->>'fin')::time hora_fin
         FROM servicios s JOIN horarios_semanales h ON h.medico_id=$1 AND h.sede_id=$2 AND h.activo=TRUE
         CROSS JOIN LATERAL jsonb_array_elements(COALESCE(h.semana -> (EXTRACT(DOW FROM $4::date)::integer)::text,'[]'::jsonb)) bloque
         WHERE s.id=$3 AND s.activo=TRUE
       ), slots AS (
         SELECT generate_series($4::date + d.hora_inicio,
           $4::date + d.hora_fin - (d.duracion_minutos || ' minutes')::interval,
           INTERVAL '30 minutes') AS inicio, d.duracion_minutos FROM datos d
       )
       SELECT TO_CHAR(sl.inicio, 'HH24:MI') AS hora
       FROM slots sl
       WHERE sl.inicio > NOW()
         AND NOT EXISTS (
           SELECT 1 FROM bloqueos_medicos b WHERE b.medico_id=$1 AND b.sede_id=$2
             AND b.fecha=$4::date AND b.activo=TRUE
             AND b.hora_inicio < (sl.inicio + (sl.duracion_minutos || ' minutes')::interval)::time
             AND b.hora_fin > sl.inicio::time
         )
         AND NOT EXISTS (
           SELECT 1 FROM citas c JOIN servicios cs ON cs.id=c.servicio_id
           WHERE c.medico_id=$1 AND c.estado NOT IN ('cancelada','no_asistio')
             AND c.fecha_hora < sl.inicio + (sl.duracion_minutos || ' minutes')::interval
             AND c.fecha_hora + (cs.duracion_minutos || ' minutes')::interval > sl.inicio
         )
       ORDER BY sl.inicio`,
      [medico_id, sede_id, servicio_id, fecha]
    );
    res.json(resultado.rows.map((fila) => fila.hora));
  } catch (error) {
    console.error('Error al consultar disponibilidad:', error);
    res.status(500).json({ error: 'No se pudo consultar la disponibilidad' });
  }
});

router.post('/citas', async (req, res) => {
  const { nit, nombre, telefono, email, servicio_id, medico_id, sede_id, fecha, hora, motivo_consulta } = req.body;
  if (!nit || !nombre || !telefono || !servicio_id || !medico_id || !sede_id || !fecha || !hora) {
    return res.status(400).json({ error: 'Completa NIT, datos de contacto, sede, servicio, medico, fecha y hora' });
  }
  const fechaHora = `${fecha}T${hora}:00`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await validarDisponibilidad(client, { medicoId: medico_id, sedeId: sede_id, servicioId: servicio_id, fechaHora });
    const pacienteId = await asegurarPaciente(client, {
      nit, nombre, telefono, email, origen: 'una reserva publica',
    });
    const cita = await client.query(
      `INSERT INTO citas (paciente_id, servicio_id, medico_id, sede_id, fecha_hora, motivo_consulta, estado)
       VALUES ($1,$2,$3,$4,$5,$6,'solicitada') RETURNING id, fecha_hora`,
      [pacienteId, servicio_id, medico_id, sede_id, fechaHora, motivo_consulta || null]
    );
    await client.query('COMMIT');
    res.status(201).json({ id: cita.rows[0].id, fecha_hora: cita.rows[0].fecha_hora, mensaje: 'Solicitud recibida. Recepcion confirmara tu cita.' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: error.message || 'No se pudo solicitar la cita' });
  } finally {
    client.release();
  }
});

// GET /api/tienda/productos — catálogo público (solo activos y con stock)
router.get('/productos', async (req, res) => {
  try {
    await liberarReservasVencidas();
    const resultado = await pool.query(
      `SELECT p.id, p.nombre, p.descripcion, COALESCE(c.nombre, p.categoria) AS categoria,
              p.precio, promo.descuento_porcentaje,
              ROUND(p.precio * (1 - COALESCE(promo.descuento_porcentaje, 0) / 100), 2) AS precio_final,
              p.imagen_url, (p.stock_actual - p.stock_reservado) AS stock_actual, p.unidad_medida
       FROM productos p LEFT JOIN categorias_productos c ON c.id = p.categoria_id
       LEFT JOIN LATERAL (
         SELECT descuento_porcentaje FROM promociones_productos pr
         WHERE pr.producto_id=p.id AND pr.activo=TRUE
           AND pr.fecha_inicio <= CURRENT_DATE AND (pr.fecha_fin IS NULL OR pr.fecha_fin >= CURRENT_DATE)
         ORDER BY pr.descuento_porcentaje DESC LIMIT 1
       ) promo ON TRUE
       WHERE p.activo = TRUE AND (p.stock_actual - p.stock_reservado) > 0
         AND (p.categoria_id IS NULL OR c.activo = TRUE)
       ORDER BY COALESCE(c.orden, 0), COALESCE(c.nombre, p.categoria) NULLS LAST, p.nombre ASC`
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al listar catálogo público:', error);
    res.status(500).json({ error: 'Error al obtener el catálogo' });
  }
});

// POST /api/tienda/pedidos — crear pedido público (queda pendiente de aprobación)
// body: { nombre_cliente, telefono, email, direccion_envio, metodo_pago_preferido, notas,
//         items: [{ producto_id, cantidad }] }
router.post('/pedidos', async (req, res) => {
  const { nit, nombre_cliente, telefono, email, direccion_envio, metodo_pago_preferido, notas, items } = req.body;

  if (!nit || !nombre_cliente || !telefono || !direccion_envio) {
    return res.status(400).json({ error: 'NIT, nombre, teléfono y dirección de envío son requeridos' });
  }
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'El pedido debe tener al menos un producto' });
  }
  if (metodo_pago_preferido && !['efectivo', 'transferencia'].includes(metodo_pago_preferido)) {
    return res.status(400).json({ error: 'Método de pago inválido' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await liberarReservasVencidas(client);

    // Los precios y disponibilidad se recalculan del lado del servidor.
    // Nunca se confía en el precio que venga del navegador.
    let subtotal = 0;
    const lineas = [];

    for (const item of items) {
      const producto = await client.query(
        `SELECT id, nombre,
           ROUND(precio * (1 - COALESCE((SELECT MAX(descuento_porcentaje) FROM promociones_productos pr
             WHERE pr.producto_id=productos.id AND pr.activo=TRUE AND pr.fecha_inicio <= CURRENT_DATE
               AND (pr.fecha_fin IS NULL OR pr.fecha_fin >= CURRENT_DATE)), 0) / 100), 2) AS precio,
           stock_actual, stock_reservado, activo
         FROM productos WHERE id = $1 FOR UPDATE`,
        [item.producto_id]
      );
      if (producto.rows.length === 0 || !producto.rows[0].activo) {
        throw new Error(`Uno de los productos del carrito ya no está disponible`);
      }
      const p = producto.rows[0];
      const cantidad = Math.max(1, Number(item.cantidad) || 1);

      const disponible = p.stock_actual - p.stock_reservado;
      if (cantidad > disponible) {
        throw new Error(`No hay suficiente stock de "${p.nombre}" (disponible: ${disponible})`);
      }

      const lineaSubtotal = cantidad * Number(p.precio);
      subtotal += lineaSubtotal;
      lineas.push({ producto_id: p.id, descripcion: p.nombre, cantidad, precio_unitario: Number(p.precio), subtotal: lineaSubtotal });
    }

    const total = subtotal;
    const nitNormalizado = normalizarNit(nit);
    const pacienteId = await asegurarPaciente(client, {
      nit: nitNormalizado, nombre: nombre_cliente, telefono, email,
      direccion: direccion_envio, origen: 'un pedido web',
    });

    const pedidoResultado = await client.query(
      `INSERT INTO pedidos_publicos
        (paciente_id, nit_cliente, nombre_cliente, telefono, email, direccion_envio,
         metodo_pago_preferido, notas, subtotal, total, estado, reserva_expira_en)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'nuevo',NOW() + INTERVAL '24 hours')
       RETURNING id, reserva_expira_en`,
      [pacienteId, nitNormalizado, nombre_cliente, telefono, email || null, direccion_envio,
        metodo_pago_preferido || 'efectivo', notas || null, subtotal, total]
    );
    const pedidoId = pedidoResultado.rows[0].id;

    for (const linea of lineas) {
      await client.query(
        `INSERT INTO pedido_detalles (pedido_id, producto_id, descripcion, cantidad, precio_unitario, subtotal)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [pedidoId, linea.producto_id, linea.descripcion, linea.cantidad, linea.precio_unitario, linea.subtotal]
      );
      await client.query(
        'UPDATE productos SET stock_reservado = stock_reservado + $1 WHERE id = $2',
        [linea.cantidad, linea.producto_id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({
      id: pedidoId,
      total,
      reserva_expira_en: pedidoResultado.rows[0].reserva_expira_en,
      mensaje: 'Pedido recibido. Tus productos quedaron reservados por 24 horas.',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: error.message || 'No se pudo registrar el pedido' });
  } finally {
    client.release();
  }
});

module.exports = router;
