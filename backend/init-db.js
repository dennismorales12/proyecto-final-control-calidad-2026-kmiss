require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./src/db');

async function inicializarBaseDeDatos() {
  const rutaSql = path.join(__dirname, '..', 'db', 'init.sql');
  const sql = fs.readFileSync(rutaSql, 'utf8');

  try {
    console.log('Ejecutando esquema de base de datos...');
    await pool.query(sql);
    console.log('Base de datos inicializada correctamente.');
  } catch (error) {
    console.error('Error al inicializar la base de datos:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

inicializarBaseDeDatos();
