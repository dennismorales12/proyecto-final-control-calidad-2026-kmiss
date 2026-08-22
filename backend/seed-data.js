require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./src/db');

async function sembrarDatos() {
  try {
    console.log('Creando usuarios de prueba...');

    const passwordInicial = process.env.DEMO_PASSWORD || (process.env.NODE_ENV === 'production' ? null : 'vitalis123');
    if (!passwordInicial || passwordInicial.length < 8) {
      throw new Error('DEMO_PASSWORD debe tener al menos 8 caracteres en producción');
    }
    const passwordHash = await bcrypt.hash(passwordInicial, 10);

    await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol)
       VALUES
        ('Administradora', 'admin@vitalis.local', $1, 'administrador'),
        ('Recepción', 'recepcion@vitalis.local', $1, 'recepcion'),
        ('Dra. Médico', 'medico@vitalis.local', $1, 'medico')
       ON CONFLICT (email) DO NOTHING`,
      [passwordHash]
    );

    console.log('Creando servicios de ejemplo...');
    await pool.query(
      `INSERT INTO servicios (nombre, descripcion, duracion_minutos, precio, especialidad)
       SELECT datos.* FROM (VALUES
        ('Consulta general', 'Evaluación médica general', 30, 150.00, 'Medicina general'),
        ('Control de seguimiento', 'Cita de seguimiento a tratamiento', 20, 100.00, 'Medicina general'),
        ('Consulta especializada', 'Evaluación con especialista', 45, 250.00, 'Especialidad')
       ) AS datos(nombre, descripcion, duracion_minutos, precio, especialidad)
       WHERE NOT EXISTS (SELECT 1 FROM servicios s WHERE LOWER(s.nombre)=LOWER(datos.nombre))`
    );

    console.log('Creando paciente de ejemplo...');
    await pool.query(
      `INSERT INTO pacientes (nit, nombre_completo, telefono, email)
       SELECT 'CF-DEMO', 'Paciente de Ejemplo', '00000000', 'paciente@ejemplo.com'
       WHERE NOT EXISTS (SELECT 1 FROM pacientes WHERE nit='CF-DEMO')`
    );

    console.log('Datos de ejemplo creados correctamente.');
    console.log('Usuarios de prueba creados con la contraseña configurada en DEMO_PASSWORD:');
    console.log('  admin@vitalis.local / recepcion@vitalis.local / medico@vitalis.local');
  } catch (error) {
    console.error('Error al sembrar datos:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

sembrarDatos();
