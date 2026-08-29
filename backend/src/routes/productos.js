const express = require('express');
const XLSX = require('xlsx');
const pool = require('../db');
const { autenticar, permitirRoles } = require('../middleware/auth');
const upload = require('../middleware/upload');
const uploadImagen = require('../middleware/uploadImagen');

const router = express.Router();
router.use(autenticar);

// GET /api/productos — lista con búsqueda opcional (?q=texto)
router.get('/', async (req, res) => {
  const { q } = req.query;
  const limiteSolicitado = Number(req.query.limit);
  const limite = Number.isInteger(limiteSolicitado) && limiteSolicitado > 0
    ? Math.min(limiteSolicitado, 50)
    : null;
  try {
    let resultado;
    if (q) {
      const consulta = `SELECT p.id,p.nombre,p.descripcion,p.categoria_id,p.imagen_url,p.precio,p.costo,
                p.stock_actual,p.stock_reservado,p.stock_minimo,p.unidad_medida,p.activo,p.creado_en,
                COALESCE(c.nombre, p.categoria) AS categoria
         FROM productos p LEFT JOIN categorias_productos c ON c.id = p.categoria_id
         WHERE p.nombre ILIKE $1 OR COALESCE(c.nombre, p.categoria) ILIKE $1
         ORDER BY CASE WHEN p.nombre ILIKE $2 THEN 0 ELSE 1 END, p.nombre ASC
         ${limite ? 'LIMIT $3' : ''}`;
      const parametros = limite ? [`%${q}%`, `${q}%`, limite] : [`%${q}%`, `${q}%`];
      resultado = await pool.query(consulta, parametros);
    } else {
      resultado = await pool.query(
        `SELECT p.id,p.nombre,p.descripcion,p.categoria_id,p.imagen_url,p.precio,p.costo,
                p.stock_actual,p.stock_reservado,p.stock_minimo,p.unidad_medida,p.activo,p.creado_en,
                COALESCE(c.nombre, p.categoria) AS categoria
         FROM productos p LEFT JOIN categorias_productos c ON c.id = p.categoria_id ORDER BY p.nombre ASC`
      );
    }
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al listar productos:', error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

// POST /api/productos — crear (admin)
router.post('/', permitirRoles('administrador'), async (req, res) => {
  const { nombre, descripcion, categoria_id, precio, costo, stock_actual, stock_minimo, unidad_medida } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'El nombre del producto es requerido' });
  }

  try {
    const resultado = await pool.query(
      `INSERT INTO productos (nombre, descripcion, categoria_id, categoria, precio, costo, stock_actual, stock_minimo, unidad_medida)
       VALUES ($1,$2,$3,(SELECT nombre FROM categorias_productos WHERE id=$3),$4,$5,$6,$7,$8)
       RETURNING id,nombre,descripcion,categoria_id,categoria,imagen_url,precio,costo,stock_actual,stock_reservado,stock_minimo,unidad_medida,activo,creado_en`,
      [nombre, descripcion || null, categoria_id || null, precio || 0, costo || 0,
        stock_actual || 0, stock_minimo || 0, unidad_medida || 'unidad']
    );
    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al crear producto:', error);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

router.post('/:id/imagen', permitirRoles('administrador'), uploadImagen.single('imagen'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibio ninguna imagen' });
  try {
    const imagenUrl = `/api/media/productos/${req.params.id}?v=${Date.now()}`;
    const resultado = await pool.query(
      'UPDATE productos SET imagen_url=$1, imagen_datos=$2, imagen_mime=$3 WHERE id=$4 RETURNING id,nombre,imagen_url',
      [imagenUrl, req.file.buffer, req.file.mimetype, req.params.id]
    );
    if (!resultado.rows[0]) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'No se pudo guardar la imagen' });
  }
});

// PUT /api/productos/:id — actualizar (admin)
router.put('/:id', permitirRoles('administrador'), async (req, res) => {
  const { nombre, descripcion, categoria_id, precio, costo, stock_actual, stock_minimo, unidad_medida, activo } = req.body;

  try {
    const existencia = await pool.query('SELECT stock_reservado FROM productos WHERE id = $1', [req.params.id]);
    if (!existencia.rows[0]) return res.status(404).json({ error: 'Producto no encontrado' });
    if (Number(stock_actual || 0) < existencia.rows[0].stock_reservado) {
      return res.status(400).json({ error: `No puedes reducir el stock por debajo de las ${existencia.rows[0].stock_reservado} unidades reservadas` });
    }
    const resultado = await pool.query(
      `UPDATE productos SET
        nombre = $1, descripcion = $2, categoria_id = $3,
        categoria = (SELECT nombre FROM categorias_productos WHERE id=$3), precio = $4, costo = $5,
        stock_actual = $6, stock_minimo = $7, unidad_medida = $8, activo = $9
       WHERE id = $10
       RETURNING id,nombre,descripcion,categoria_id,categoria,imagen_url,precio,costo,stock_actual,stock_reservado,stock_minimo,unidad_medida,activo,creado_en`,
      [nombre, descripcion || null, categoria_id || null, precio || 0, costo || 0,
        stock_actual || 0, stock_minimo || 0, unidad_medida || 'unidad',
        activo !== undefined ? activo : true, req.params.id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
});

// DELETE /api/productos/:id — solo administrador
router.delete('/:id', permitirRoles('administrador'), async (req, res) => {
  try {
    const resultado = await pool.query('DELETE FROM productos WHERE id = $1 RETURNING id', [req.params.id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json({ mensaje: 'Producto eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
});

// POST /api/productos/importar — carga masiva desde Excel (solo administrador)
// Columnas esperadas: nombre, categoria, descripcion, precio, costo, stock_actual, stock_minimo, unidad_medida
// Si ya existe un producto con el mismo nombre (sin distinguir mayúsculas), se actualiza; si no, se crea.
router.post('/importar', permitirRoles('administrador'), upload.single('archivo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ningún archivo' });
  }

  let filas;
  try {
    const libro = XLSX.read(req.file.buffer, { type: 'buffer' });
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

  let creados = 0, actualizados = 0;
  const errores = [];

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i];
    const numeroFila = i + 2;

    const nombre = obtener(fila, 'nombre', 'producto', 'articulo', 'artículo');
    if (!nombre) {
      errores.push(`Fila ${numeroFila}: falta el nombre del producto, se omitió`);
      continue;
    }

    const categoria = obtener(fila, 'categoria', 'categoría');
    const descripcion = obtener(fila, 'descripcion', 'descripción');
    const precio = Number(obtener(fila, 'precio', 'precio_venta', 'precio de venta') || 0);
    const costo = Number(obtener(fila, 'costo') || 0);
    const stock_actual = Number(obtener(fila, 'stock_actual', 'stock', 'existencias') || 0);
    const stock_minimo = Number(obtener(fila, 'stock_minimo', 'stock minimo', 'stock mínimo') || 0);
    const unidad_medida = obtener(fila, 'unidad_medida', 'unidad') || 'unidad';

    try {
      let categoriaId = null;
      if (categoria) {
        const categoriaResultado = await pool.query(
          `INSERT INTO categorias_productos (nombre) VALUES ($1)
           ON CONFLICT (LOWER(nombre)) DO UPDATE SET nombre=EXCLUDED.nombre RETURNING id`,
          [String(categoria).trim()]
        );
        categoriaId = categoriaResultado.rows[0].id;
      }
      const existente = await pool.query('SELECT id FROM productos WHERE LOWER(nombre) = LOWER($1)', [nombre]);

      if (existente.rows.length > 0) {
        await pool.query(
          `UPDATE productos SET categoria=$1, categoria_id=$2, descripcion=$3, precio=$4, costo=$5,
            stock_actual=$6, stock_minimo=$7, unidad_medida=$8 WHERE id=$9`,
          [categoria, categoriaId, descripcion, precio, costo, stock_actual, stock_minimo, unidad_medida, existente.rows[0].id]
        );
        actualizados++;
      } else {
        await pool.query(
          `INSERT INTO productos (nombre, categoria, categoria_id, descripcion, precio, costo, stock_actual, stock_minimo, unidad_medida)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [nombre, categoria, categoriaId, descripcion, precio, costo, stock_actual, stock_minimo, unidad_medida]
        );
        creados++;
      }
    } catch (error) {
      errores.push(`Fila ${numeroFila} (${nombre}): ${error.message}`);
    }
  }

  res.json({ total: filas.length, creados, actualizados, errores });
});

module.exports = router;
