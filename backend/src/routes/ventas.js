const express = require('express');
const pool = require('../db');
const { autenticar, permitirRoles } = require('../middleware/auth');
const { enteroPositivo, validarDescuentoMonto } = require('../domain/validation');

const router = express.Router();
router.use(autenticar);

// GET /api/ventas/dashboard?mes=YYYY-MM — indicadores comerciales del mes
router.get('/dashboard', permitirRoles('administrador', 'recepcion'), async (req, res) => {
  const mes = /^\d{4}-\d{2}$/.test(req.query.mes || '')
    ? req.query.mes
    : new Date().toISOString().slice(0, 7);
  const inicio = `${mes}-01`;
  try {
    const [resumen, productos, clientes, dias, metodos] = await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(total),0) AS total_mes, COUNT(*)::integer AS cantidad_ventas,
                COALESCE(AVG(total),0) AS ticket_promedio,
                COUNT(DISTINCT paciente_id) FILTER (WHERE paciente_id IS NOT NULL)::integer AS clientes,
                COALESCE(SUM(descuento),0) AS descuentos
         FROM ventas WHERE estado='completada'
           AND creado_en >= $1::date AND creado_en < $1::date + INTERVAL '1 month'`,
        [inicio]
      ),
      pool.query(
        `SELECT d.producto_id, d.descripcion, SUM(d.cantidad)::integer AS unidades,
                SUM(d.subtotal) AS importe, COUNT(DISTINCT v.id)::integer AS ventas
         FROM venta_detalles d JOIN ventas v ON v.id=d.venta_id
         WHERE v.estado='completada' AND d.producto_id IS NOT NULL
           AND v.creado_en >= $1::date AND v.creado_en < $1::date + INTERVAL '1 month'
         GROUP BY d.producto_id, d.descripcion ORDER BY unidades DESC, importe DESC LIMIT 5`,
        [inicio]
      ),
      pool.query(
        `SELECT p.id, p.nombre_completo, p.nit, COUNT(v.id)::integer AS compras, SUM(v.total) AS total
         FROM ventas v JOIN pacientes p ON p.id=v.paciente_id
         WHERE v.estado='completada'
           AND v.creado_en >= $1::date AND v.creado_en < $1::date + INTERVAL '1 month'
         GROUP BY p.id, p.nombre_completo, p.nit ORDER BY total DESC, compras DESC LIMIT 5`,
        [inicio]
      ),
      pool.query(
        `SELECT TO_CHAR(d.dia,'YYYY-MM-DD') AS fecha, COALESCE(SUM(v.total),0) AS total,
                COUNT(v.id)::integer AS ventas
         FROM generate_series($1::date, ($1::date + INTERVAL '1 month - 1 day')::date, INTERVAL '1 day') d(dia)
         LEFT JOIN ventas v ON DATE(v.creado_en)=d.dia AND v.estado='completada'
         GROUP BY d.dia ORDER BY d.dia`,
        [inicio]
      ),
      pool.query(
        `SELECT metodo_pago, COUNT(*)::integer AS ventas, SUM(total) AS total
         FROM ventas WHERE estado='completada'
           AND creado_en >= $1::date AND creado_en < $1::date + INTERVAL '1 month'
         GROUP BY metodo_pago ORDER BY total DESC`,
        [inicio]
      ),
    ]);
    res.json({ mes, resumen: resumen.rows[0], productos: productos.rows, clientes: clientes.rows, dias: dias.rows, metodos: metodos.rows });
  } catch (error) {
    console.error('Error al obtener dashboard de ventas:', error);
    res.status(500).json({ error: 'Error al obtener indicadores de ventas' });
  }
});

// GET /api/ventas — soporta ?fecha=YYYY-MM-DD
router.get('/', permitirRoles('administrador', 'recepcion'), async (req, res) => {
  const { fecha } = req.query;
  try {
    let resultado;
    if (fecha) {
      resultado = await pool.query(
        `SELECT v.*, u.nombre AS vendedor_nombre, p.nombre_completo AS paciente_nombre
         FROM ventas v
         LEFT JOIN usuarios u ON u.id = v.vendido_por
         LEFT JOIN pacientes p ON p.id = v.paciente_id
         WHERE DATE(v.creado_en) = $1
         ORDER BY v.creado_en DESC`,
        [fecha]
      );
    } else {
      resultado = await pool.query(
        `SELECT v.*, u.nombre AS vendedor_nombre, p.nombre_completo AS paciente_nombre
         FROM ventas v
         LEFT JOIN usuarios u ON u.id = v.vendido_por
         LEFT JOIN pacientes p ON p.id = v.paciente_id
         ORDER BY v.creado_en DESC LIMIT 100`
      );
    }
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al listar ventas:', error);
    res.status(500).json({ error: 'Error al obtener ventas' });
  }
});

// GET /api/ventas/:id — detalle con líneas
router.get('/:id', permitirRoles('administrador', 'recepcion'), async (req, res) => {
  try {
    const venta = await pool.query(
      `SELECT v.*, u.nombre AS vendedor_nombre, p.nombre_completo AS paciente_nombre
       FROM ventas v
       LEFT JOIN usuarios u ON u.id = v.vendido_por
       LEFT JOIN pacientes p ON p.id = v.paciente_id
       WHERE v.id = $1`,
      [req.params.id]
    );
    if (venta.rows.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    const detalles = await pool.query('SELECT * FROM venta_detalles WHERE venta_id = $1', [req.params.id]);
    res.json({ ...venta.rows[0], detalles: detalles.rows });
  } catch (error) {
    console.error('Error al obtener venta:', error);
    res.status(500).json({ error: 'Error al obtener venta' });
  }
});

// POST /api/ventas — crear venta con líneas (admin y recepción)
// body: { paciente_id, metodo_pago, descuento, items: [{ producto_id?, servicio_id?, descripcion, cantidad, precio_unitario }] }
router.post('/', permitirRoles('administrador', 'recepcion'), async (req, res) => {
  const { paciente_id, metodo_pago, descuento, items } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'La venta debe tener al menos un artículo' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const itemsValidados = [];
    for (const item of items) {
      const cantidad = enteroPositivo(item.cantidad);
      if (Boolean(item.producto_id) === Boolean(item.servicio_id)) {
        throw new Error('Cada línea debe identificar un producto o un servicio');
      }
      if (item.producto_id) {
        const prod = await client.query('SELECT stock_actual, nombre, precio, activo FROM productos WHERE id = $1 FOR UPDATE', [item.producto_id]);
        if (prod.rows.length === 0) {
          throw new Error(`Producto no encontrado (id ${item.producto_id})`);
        }
        if (!prod.rows[0].activo) throw new Error(`Producto inactivo (id ${item.producto_id})`);
        if (prod.rows[0].stock_actual < cantidad) {
          throw new Error(`Stock insuficiente de "${prod.rows[0].nombre}" (disponible: ${prod.rows[0].stock_actual})`);
        }
        itemsValidados.push({ producto_id: item.producto_id, servicio_id: null, descripcion: prod.rows[0].nombre, cantidad, precio_unitario: Number(prod.rows[0].precio) });
      } else {
        const servicio = await client.query('SELECT nombre, precio, activo FROM servicios WHERE id=$1', [item.servicio_id]);
        if (!servicio.rows[0] || !servicio.rows[0].activo) throw new Error(`Servicio no disponible (id ${item.servicio_id})`);
        itemsValidados.push({ producto_id: null, servicio_id: item.servicio_id, descripcion: servicio.rows[0].nombre, cantidad, precio_unitario: Number(servicio.rows[0].precio) });
      }
    }

    const subtotal = itemsValidados.reduce((acc, i) => acc + (i.cantidad * i.precio_unitario), 0);
    const descuentoFinal = validarDescuentoMonto(descuento, subtotal);
    const total = subtotal - descuentoFinal;

    const ventaResultado = await client.query(
      `INSERT INTO ventas (paciente_id, vendido_por, subtotal, descuento, total, metodo_pago)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [paciente_id || null, req.usuario.id, subtotal, descuentoFinal, total, metodo_pago || 'efectivo']
    );
    const ventaId = ventaResultado.rows[0].id;

    for (const item of itemsValidados) {
      const lineaSubtotal = item.cantidad * item.precio_unitario;
      await client.query(
        `INSERT INTO venta_detalles (venta_id, producto_id, servicio_id, descripcion, cantidad, precio_unitario, subtotal)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [ventaId, item.producto_id || null, item.servicio_id || null, item.descripcion,
          item.cantidad, item.precio_unitario, lineaSubtotal]
      );

      if (item.producto_id) {
        await client.query(
          'UPDATE productos SET stock_actual = stock_actual - $1 WHERE id = $2',
          [item.cantidad, item.producto_id]
        );
      }
    }

    await client.query('COMMIT');

    const ventaCompleta = await pool.query('SELECT * FROM ventas WHERE id = $1', [ventaId]);
    const detalles = await pool.query('SELECT * FROM venta_detalles WHERE venta_id = $1', [ventaId]);
    res.status(201).json({ ...ventaCompleta.rows[0], detalles: detalles.rows });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear venta:', error);
    res.status(400).json({ error: error.message || 'Error al crear la venta' });
  } finally {
    client.release();
  }
});

// PUT /api/ventas/:id/anular — revierte stock y marca como anulada (admin)
router.put('/:id/anular', permitirRoles('administrador'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const venta = await client.query('SELECT estado FROM ventas WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (venta.rows.length === 0) {
      throw new Error('Venta no encontrada');
    }
    if (venta.rows[0].estado === 'anulada') {
      throw new Error('Esta venta ya está anulada');
    }

    const detalles = await client.query('SELECT * FROM venta_detalles WHERE venta_id = $1', [req.params.id]);
    for (const linea of detalles.rows) {
      if (linea.producto_id) {
        await client.query(
          'UPDATE productos SET stock_actual = stock_actual + $1 WHERE id = $2',
          [linea.cantidad, linea.producto_id]
        );
      }
    }

    await client.query(`UPDATE ventas SET estado = 'anulada' WHERE id = $1`, [req.params.id]);
    await client.query('COMMIT');
    res.json({ mensaje: 'Venta anulada y stock restituido correctamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al anular venta:', error);
    res.status(400).json({ error: error.message || 'Error al anular venta' });
  } finally {
    client.release();
  }
});

module.exports = router;
