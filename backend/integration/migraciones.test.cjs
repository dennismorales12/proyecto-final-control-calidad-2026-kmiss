const { describe, test, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

// Solo bases temporales locales; nunca ejecutar este conjunto contra Azure.
const conexion = new URL(process.env.DATABASE_URL || 'postgresql://localhost/NO_CONFIGURADA');
if (process.env.NODE_ENV !== 'test'
    || !['127.0.0.1', 'localhost'].includes(conexion.hostname)
    || !['/kmiss_ci', '/kmiss_migraciones_test'].includes(conexion.pathname)) {
  throw new Error('Migraciones: se exige NODE_ENV=test y una base temporal local autorizada');
}
const cliente = new Client({ connectionString: conexion.href });
const esquema = fs.readFileSync(path.join(__dirname, '../../db/init.sql'), 'utf8');

describe('Migraciones PostgreSQL KMISS', { concurrency: false }, () => {
  before(async () => {
    await cliente.connect();
    const { rows } = await cliente.query("SELECT count(*)::int AS total FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
    assert.equal(rows[0].total, 0, 'La base temporal debe estar vacía; no se modifica una base existente');
  });
  beforeEach(async () => {
    await cliente.query('BEGIN');
    await cliente.query(esquema);
  });
  afterEach(async () => { await cliente.query('ROLLBACK'); });
  after(async () => { await cliente.end(); });

  test('crea las tablas de clínica y tienda en PostgreSQL real', async () => {
    const { rows } = await cliente.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    for (const tabla of ['usuarios', 'pacientes', 'citas', 'productos', 'ventas', 'pedidos_publicos', 'horarios_semanales']) {
      assert.ok(rows.some(r => r.table_name === tabla), `Falta la tabla ${tabla}`);
    }
    const sede = await cliente.query('SELECT nombre FROM sedes');
    assert.deepEqual(sede.rows, [{ nombre: 'Sede Central' }]);
  });

  test('repetir la inicialización no duplica sedes ni tablas', async () => {
    const contar = () => cliente.query("SELECT count(*)::int AS total FROM information_schema.tables WHERE table_schema='public'");
    const anterior = await contar();
    await cliente.query(esquema);
    assert.deepEqual((await contar()).rows, anterior.rows);
    assert.equal((await cliente.query('SELECT count(*)::int AS total FROM sedes')).rows[0].total, 1);
  });

  test('convierte estados anteriores y conserva datos al repetir la migración', async () => {
    await cliente.query('ALTER TABLE pedidos_publicos DROP CONSTRAINT pedidos_publicos_estado_check');
    const producto = (await cliente.query("INSERT INTO productos(nombre,categoria,stock_actual,precio) VALUES ('Producto migración','Categoría migración',100,10) RETURNING id")).rows[0].id;
    for (const [estado, telefono] of [['pendiente','55550001'], ['aprobado','55550002'], ['rechazado','55550003']]) {
      const pedido = (await cliente.query("INSERT INTO pedidos_publicos(nombre_cliente,telefono,direccion_envio,estado,total) VALUES ('Cliente sintético',$1,'Dirección de prueba',$2,20) RETURNING id", [telefono,estado])).rows[0].id;
      await cliente.query('INSERT INTO pedido_detalles(pedido_id,producto_id,descripcion,cantidad,precio_unitario,subtotal) VALUES ($1,$2,$3,2,10,20)', [pedido,producto,'Detalle sintético']);
    }
    await cliente.query(esquema);
    const comprobar = async () => {
      const pedidos = await cliente.query('SELECT estado,paciente_id,reserva_expira_en FROM pedidos_publicos ORDER BY telefono');
      assert.deepEqual(pedidos.rows.map(r => r.estado), ['nuevo','pagado','cancelado']);
      assert.ok(pedidos.rows.every(r => Number.isInteger(r.paciente_id)));
      assert.ok(pedidos.rows[0].reserva_expira_en instanceof Date);
      const inventario = (await cliente.query('SELECT stock_actual,stock_reservado,categoria_id FROM productos WHERE id=$1', [producto])).rows[0];
      assert.equal(inventario.stock_actual, 100);
      assert.equal(inventario.stock_reservado, 2);
      assert.ok(Number.isInteger(inventario.categoria_id));
      assert.equal((await cliente.query('SELECT count(*)::int AS total FROM pacientes')).rows[0].total, 3);
      return pedidos.rows;
    };
    const primera = await comprobar();
    await cliente.query(esquema);
    assert.deepEqual(await comprobar(), primera);
  });

  test('rechaza inventario negativo sin aceptar datos inválidos', async () => {
    await cliente.query('SAVEPOINT dato_invalido');
    await assert.rejects(cliente.query("INSERT INTO productos(nombre,stock_actual) VALUES ('Inválido',-1)"), { code: '23514' });
    await cliente.query('ROLLBACK TO SAVEPOINT dato_invalido');
    assert.equal((await cliente.query('SELECT count(*)::int AS total FROM productos')).rows[0].total, 0);
  });

  test('el rollback de cada caso deja la base temporal sin tablas persistidas', async () => {
    await cliente.query('ROLLBACK');
    const { rows } = await cliente.query("SELECT count(*)::int AS total FROM information_schema.tables WHERE table_schema='public'");
    assert.equal(rows[0].total, 0);
    await cliente.query('BEGIN');
  });
});
