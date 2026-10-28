const { obtenerCelda } = require('./importacionExcel');

test('reconoce encabezados con mayúsculas y espacios', () => {
  expect(obtenerCelda({ ' Nombre ': 'Ana' }, 'nombre')).toBe('Ana');
});
test('busca el alias cuando la primera celda está vacía', () => {
  expect(obtenerCelda({ telefono: '', 'Teléfono': '55550000' }, 'telefono', 'teléfono')).toBe('55550000');
});
test('conserva cero como dato y no como celda vacía', () => {
  expect(obtenerCelda({ orden: 0 }, 'orden')).toBe(0);
});
test('devuelve null para encabezado ausente', () => {
  expect(obtenerCelda({ correo: 'demo@example.test' }, 'nit')).toBeNull();
});
test('una celda null permite buscar el siguiente alias', () => {
  expect(obtenerCelda({ nombre: null, nombre_completo: 'Ana' }, 'nombre', 'nombre_completo')).toBe('Ana');
});
