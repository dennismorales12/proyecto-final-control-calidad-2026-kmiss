function numero(valor, campo) {
  const resultado = Number(valor);
  if (!Number.isFinite(resultado)) throw new Error(`${campo} debe ser numérico`);
  return resultado;
}

function enteroPositivo(valor, campo = 'cantidad') {
  const resultado = numero(valor, campo);
  if (!Number.isInteger(resultado) || resultado <= 0) {
    throw new Error(`${campo} debe ser un entero mayor que cero`);
  }
  return resultado;
}

function enteroNoNegativo(valor, campo) {
  const resultado = numero(valor, campo);
  if (!Number.isInteger(resultado) || resultado < 0) {
    throw new Error(`${campo} debe ser un entero mayor o igual que cero`);
  }
  return resultado;
}

function decimalNoNegativo(valor, campo) {
  const resultado = numero(valor, campo);
  if (resultado < 0) throw new Error(`${campo} debe ser mayor o igual que cero`);
  return resultado;
}

function validarServicio({ nombre, duracion_minutos, precio }) {
  if (!String(nombre || '').trim()) throw new Error('El nombre del servicio es requerido');
  return {
    duracion: enteroPositivo(duracion_minutos ?? 30, 'duracion_minutos'),
    precio: decimalNoNegativo(precio ?? 0, 'precio'),
  };
}

function validarProducto({ nombre, precio, costo, stock_actual, stock_minimo }) {
  if (!String(nombre || '').trim()) throw new Error('El nombre del producto es requerido');
  return {
    precio: decimalNoNegativo(precio ?? 0, 'precio'),
    costo: decimalNoNegativo(costo ?? 0, 'costo'),
    stockActual: enteroNoNegativo(stock_actual ?? 0, 'stock_actual'),
    stockMinimo: enteroNoNegativo(stock_minimo ?? 0, 'stock_minimo'),
  };
}

function validarDescuentoMonto(valor, subtotal) {
  const descuento = decimalNoNegativo(valor ?? 0, 'descuento');
  if (descuento > subtotal) throw new Error('descuento no puede superar el subtotal');
  return descuento;
}

module.exports = {
  numero,
  enteroPositivo,
  enteroNoNegativo,
  decimalNoNegativo,
  validarServicio,
  validarProducto,
  validarDescuentoMonto,
};
