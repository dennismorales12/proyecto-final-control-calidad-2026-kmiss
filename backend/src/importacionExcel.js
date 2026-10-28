// Conserva los alias de encabezados, omite celdas vacías y admite cero como dato.
function obtenerCelda(fila, ...claves) {
  for (const clave of claves) {
    const encontrada = Object.keys(fila).find((nombre) => nombre.toLowerCase().trim() === clave);
    if (encontrada && fila[encontrada] !== null && fila[encontrada] !== '') return fila[encontrada];
  }
  return null;
}

module.exports = { obtenerCelda };
