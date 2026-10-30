const { crearOpcionesCors, obtenerClaveDemo } = require('./configuracionSeguridad');

test.each([
  ['', 'https://externo.example.test', false],
  ['https://qa.example.test', 'https://qa.example.test', true],
  ['https://qa.example.test', 'https://qa.example.test.atacante.test', false],
  [' https://qa.example.test , https://dev.example.test ', 'https://dev.example.test', true],
  ['https://qa.example.test', undefined, false],
])('CORS concede acceso solo por coincidencia exacta: %s / %s', (lista, origen, permitido) => {
  const callback = jest.fn();
  crearOpcionesCors(lista).origin(origen, callback);
  expect(callback).toHaveBeenCalledWith(null, permitido);
});
test('seed sin clave no usa una contraseña incrustada', () => {
  expect(() => obtenerClaveDemo({})).toThrow('Configura DEMO_PASSWORD');
});
test('seed rechaza clave demasiado corta', () => {
  expect(() => obtenerClaveDemo({DEMO_PASSWORD:'corta'})).toThrow('al menos 8 caracteres');
});
test('seed toma la clave configurada sin imprimirla', () => {
  const clave = 'dato-sintetico-no-productivo';
  expect(obtenerClaveDemo({DEMO_PASSWORD:clave})).toBe(clave);
});
