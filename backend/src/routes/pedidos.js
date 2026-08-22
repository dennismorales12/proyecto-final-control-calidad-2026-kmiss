const express = require('express');
const pool = require('../db');
const { autenticar, permitirRoles } = require('../middleware/auth');
const { ESTADOS_CON_RESERVA, liberarReservasVencidas } = require('../reservas');

const router = express.Router();
router.use(autenticar);
router.use(permitirRoles('administrador', 'recepcion'));

const ESTADOS_VALIDOS = ['nuevo', 'contactado', 'esperando_pago', 'pagado', 'preparando', 'entregado', 'cancelado', 'vencido'];

router.get('/resumen', async (req, res) => {
  try {
    await liberarReservasVencidas();
    const resultado = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE estado = 'nuevo')::integer AS nuevos,
              COUNT(*) FILTER (WHERE estado = ANY($1::varchar[]))::integer AS reservados,
              COUNT(*) FILTER (WHERE estado = 'pagado')::integer AS pagos_confirmados
       FROM pedidos_publicos`,
      [ESTADOS_CON_RESERVA]
    );
    res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al obtener resumen de pedidos:', error);
    res.status(500).json({ error: 'Error al obtener el resumen de pedidos' });
  }
});

router.get('/', async (req, res) => {
  const { estado } = req.query;
  if (estado && !ESTADOS_VALIDOS.includes(estado)) return res.status(400).json({ error: 'Estado de pedido invalido' });
  try {
    await liberarReservasVencidas();
    const resultado = await pool.query(
      `SELECT p.*, u.nombre AS revisado_por_nombre FROM pedidos_publicos p
       LEFT JOIN usuarios u ON u.id = p.revisado_por
       ${estado ? 'WHERE p.estado = $1' : ''}
       ORDER BY p.creado_en DESC LIMIT 200`,
      estado ? [estado] : []
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al listar pedidos:', error);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    await liberarReservasVencidas();
    const pedido = await pool.query('SELECT * FROM pedidos_publicos WHERE id = $1', [req.params.id]);
    if (pedido.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
    const detalles = await pool.query('SELECT * FROM pedido_detalles WHERE pedido_id = $1', [req.params.id]);
    res.json({ ...pedido.rows[0], detalles: detalles.rows });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener pedido' });
  }
});

router.put('/:id/contactar', async (req, res) => {
  try {
    await liberarReservasVencidas();
    const resultado = await pool.query(
      `UPDATE pedidos_publicos SET estado = 'contactado', contactado_en = COALESCE(contactado_en, NOW()),
       revisado_por = $1, revisado_en = NOW(), reserva_expira_en = NOW() + INTERVAL '24 hours'
       WHERE id = $2 AND estado IN ('nuevo', 'contactado') RETURNING *`,
      [req.usuario.id, req.params.id]
    );
    if (!resultado.rows[0]) return res.status(400).json({ error: 'El pedido no esta disponible para contacto' });
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'No se pudo actualizar el pedido' });
  }
});

router.put('/:id/reabrir', async (req, res) => {
  try {
    await liberarReservasVencidas();
    const resultado = await pool.query(
      `UPDATE pedidos_publicos SET estado = 'nuevo', contactado_en = NULL,
       revisado_por = NULL, revisado_en = NULL, reserva_expira_en = NOW() + INTERVAL '24 hours'
       WHERE id = $1 AND estado IN ('contactado', 'esperando_pago') RETURNING *`,
      [req.params.id]
    );
    if (!resultado.rows[0]) return res.status(400).json({ error: 'El pedido no puede regresar a nuevo' });
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'No se pudo reabrir el pedido' });
  }
});

router.put('/:id/esperando-pago', async (req, res) => {
  try {
    await liberarReservasVencidas();
    const resultado = await pool.query(
      `UPDATE pedidos_publicos SET estado = 'esperando_pago', revisado_por = $1, revisado_en = NOW(),
       reserva_expira_en = NOW() + INTERVAL '24 hours'
       WHERE id = $2 AND estado IN ('nuevo', 'contactado', 'esperando_pago') RETURNING *`,
      [req.usuario.id, req.params.id]
    );
    if (!resultado.rows[0]) return res.status(400).json({ error: 'El pedido no puede pasar a espera de pago' });
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'No se pudo actualizar el pedido' });
  }
});

router.put('/:id/confirmar-pago', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await liberarReservasVencidas(client);
    const pedido = await client.query('SELECT * FROM pedidos_publicos WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!pedido.rows[0]) throw new Error('Pedido no encontrado');
    if (!ESTADOS_CON_RESERVA.includes(pedido.rows[0].estado)) throw new Error('Este pedido no tiene una reserva activa');
    const detalles = await client.query('SELECT * FROM pedido_detalles WHERE pedido_id = $1', [req.params.id]);

    for (const linea of detalles.rows) {
      if (!linea.producto_id) continue;
      const producto = await client.query('SELECT stock_actual, stock_reservado FROM productos WHERE id = $1 FOR UPDATE', [linea.producto_id]);
      if (!producto.rows[0] || producto.rows[0].stock_reservado < linea.cantidad || producto.rows[0].stock_actual < linea.cantidad) {
        throw new Error(`La reserva de "${linea.descripcion}" ya no esta disponible`);
      }
      await client.query(
        'UPDATE productos SET stock_actual = stock_actual - $1, stock_reservado = stock_reservado - $1 WHERE id = $2',
        [linea.cantidad, linea.producto_id]
      );
    }

    const venta = await client.query(
      `INSERT INTO ventas (paciente_id, vendido_por, subtotal, descuento, total, metodo_pago, estado)
       VALUES ($1,$2,$3,0,$4,$5,'completada') RETURNING id`,
      [pedido.rows[0].paciente_id, req.usuario.id, pedido.rows[0].subtotal, pedido.rows[0].total,
        pedido.rows[0].metodo_pago_preferido === 'transferencia' ? 'transferencia' : 'efectivo']
    );
    for (const linea of detalles.rows) {
      await client.query(
        `INSERT INTO venta_detalles (venta_id, producto_id, descripcion, cantidad, precio_unitario, subtotal)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [venta.rows[0].id, linea.producto_id, linea.descripcion, linea.cantidad, linea.precio_unitario, linea.subtotal]
      );
    }
    await client.query(
      `UPDATE pedidos_publicos SET estado = 'pagado', pago_confirmado_en = NOW(), referencia_pago = $1,
       revisado_por = $2, revisado_en = NOW(), venta_id = $3 WHERE id = $4`,
      [req.body.referencia_pago || null, req.usuario.id, venta.rows[0].id, req.params.id]
    );
    await client.query('COMMIT');
    res.json({ mensaje: 'Pago confirmado, venta registrada y stock actualizado', venta_id: venta.rows[0].id });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: error.message || 'No se pudo confirmar el pago' });
  } finally {
    client.release();
  }
});

router.put('/:id/cancelar', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await liberarReservasVencidas(client);
    const pedido = await client.query('SELECT estado FROM pedidos_publicos WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!pedido.rows[0]) throw new Error('Pedido no encontrado');
    if (!ESTADOS_CON_RESERVA.includes(pedido.rows[0].estado)) throw new Error('Solo se pueden cancelar pedidos con reserva activa');
    const detalles = await client.query('SELECT producto_id, cantidad FROM pedido_detalles WHERE pedido_id = $1', [req.params.id]);
    for (const linea of detalles.rows) {
      if (linea.producto_id) {
        await client.query('UPDATE productos SET stock_reservado = GREATEST(0, stock_reservado - $1) WHERE id = $2', [linea.cantidad, linea.producto_id]);
      }
    }
    await client.query(
      `UPDATE pedidos_publicos SET estado = 'cancelado', motivo_rechazo = $1,
       revisado_por = $2, revisado_en = NOW() WHERE id = $3`,
      [req.body.motivo || null, req.usuario.id, req.params.id]
    );
    await client.query('COMMIT');
    res.json({ mensaje: 'Pedido cancelado y reserva liberada' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: error.message || 'No se pudo cancelar el pedido' });
  } finally {
    client.release();
  }
});

async function cambiarEstadoDespacho(req, res, estado, origenes, extra = '') {
  try {
    const resultado = await pool.query(
      `UPDATE pedidos_publicos SET estado = $1, revisado_por = $2, revisado_en = NOW() ${extra}
       WHERE id = $3 AND estado = ANY($4::varchar[]) RETURNING *`,
      [estado, req.usuario.id, req.params.id, origenes]
    );
    if (!resultado.rows[0]) return res.status(400).json({ error: 'Transicion de estado no permitida' });
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'No se pudo actualizar el pedido' });
  }
}

router.put('/:id/preparar', (req, res) => cambiarEstadoDespacho(req, res, 'preparando', ['pagado']));
router.put('/:id/entregar', (req, res) => cambiarEstadoDespacho(req, res, 'entregado', ['pagado', 'preparando'], ', entregado_en = NOW()'));

module.exports = router;
