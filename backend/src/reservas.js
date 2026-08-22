const pool = require('./db');

const ESTADOS_CON_RESERVA = ['nuevo', 'contactado', 'esperando_pago'];

async function liberarReservasVencidas(cliente = pool) {
  await cliente.query(
    `WITH vencidos AS (
       UPDATE pedidos_publicos
       SET estado = 'vencido', motivo_rechazo = 'La reserva vencio sin confirmacion de pago'
       WHERE estado = ANY($1::varchar[]) AND reserva_expira_en <= NOW()
       RETURNING id
     ), cantidades AS (
       SELECT d.producto_id, SUM(d.cantidad)::integer AS cantidad
       FROM pedido_detalles d
       JOIN vencidos v ON v.id = d.pedido_id
       WHERE d.producto_id IS NOT NULL
       GROUP BY d.producto_id
     )
     UPDATE productos p
     SET stock_reservado = GREATEST(0, p.stock_reservado - c.cantidad)
     FROM cantidades c
     WHERE p.id = c.producto_id`,
    [ESTADOS_CON_RESERVA]
  );
}

module.exports = { ESTADOS_CON_RESERVA, liberarReservasVencidas };
