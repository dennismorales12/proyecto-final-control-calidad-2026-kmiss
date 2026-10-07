const {
  numero, enteroPositivo, enteroNoNegativo, decimalNoNegativo,
  validarServicio, validarProducto, validarDescuentoMonto,
} = require('./validation');

describe('validaciones numéricas', () => {
  test('convierte una cadena numérica', () => expect(numero('12.5', 'precio')).toBe(12.5));
  test('rechaza texto no numérico', () => expect(() => numero('abc', 'precio')).toThrow('precio debe ser numérico'));
  test('acepta entero positivo igual a uno', () => expect(enteroPositivo(1)).toBe(1));
  test('rechaza cero como cantidad', () => expect(() => enteroPositivo(0)).toThrow('mayor que cero'));
  test('rechaza entero negativo', () => expect(() => enteroPositivo(-1)).toThrow('mayor que cero'));
  test('rechaza cantidad decimal', () => expect(() => enteroPositivo(1.5)).toThrow('entero'));
  test('acepta entero no negativo igual a cero', () => expect(enteroNoNegativo(0, 'stock')).toBe(0));
  test('rechaza stock negativo', () => expect(() => enteroNoNegativo(-1, 'stock')).toThrow('mayor o igual'));
  test('acepta decimal no negativo', () => expect(decimalNoNegativo(0.01, 'precio')).toBe(0.01));
  test('rechaza decimal negativo', () => expect(() => decimalNoNegativo(-0.01, 'precio')).toThrow('mayor o igual'));
});

describe('validación de servicios', () => {
  test('acepta nombre, duración y precio válidos', () => expect(validarServicio({nombre:'Consulta',duracion_minutos:30,precio:100})).toEqual({duracion:30,precio:100}));
  test('rechaza nombre vacío', () => expect(() => validarServicio({nombre:' ',duracion_minutos:30,precio:100})).toThrow('nombre'));
  test('rechaza duración cero', () => expect(() => validarServicio({nombre:'Consulta',duracion_minutos:0,precio:100})).toThrow('duracion_minutos'));
  test('rechaza precio negativo', () => expect(() => validarServicio({nombre:'Consulta',duracion_minutos:30,precio:-1})).toThrow('precio'));
});

describe('validación de productos y descuentos', () => {
  const base = {nombre:'Crema',precio:100,costo:50,stock_actual:5,stock_minimo:1};
  test('acepta un producto válido', () => expect(validarProducto(base).stockActual).toBe(5));
  test('rechaza producto sin nombre', () => expect(() => validarProducto({...base,nombre:''})).toThrow('nombre'));
  test('rechaza precio negativo', () => expect(() => validarProducto({...base,precio:-1})).toThrow('precio'));
  test('rechaza costo negativo', () => expect(() => validarProducto({...base,costo:-1})).toThrow('costo'));
  test('rechaza stock actual negativo', () => expect(() => validarProducto({...base,stock_actual:-1})).toThrow('stock_actual'));
  test('rechaza stock mínimo decimal', () => expect(() => validarProducto({...base,stock_minimo:1.2})).toThrow('stock_minimo'));
  test('acepta descuento igual al subtotal', () => expect(validarDescuentoMonto(100,100)).toBe(100));
  test('rechaza descuento mayor al subtotal', () => expect(() => validarDescuentoMonto(101,100)).toThrow('superar'));
  test('rechaza descuento negativo', () => expect(() => validarDescuentoMonto(-1,100)).toThrow('mayor o igual'));
});
