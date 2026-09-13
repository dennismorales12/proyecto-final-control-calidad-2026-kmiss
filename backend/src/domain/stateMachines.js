const TRANSICIONES_CITA = {
  solicitada: new Set(['programada', 'confirmada', 'cancelada']),
  programada: new Set(['confirmada', 'atendida', 'cancelada', 'no_asistio']),
  confirmada: new Set(['atendida', 'cancelada', 'no_asistio']),
  atendida: new Set(),
  cancelada: new Set(),
  no_asistio: new Set(),
};

function puedeCambiarCita(actual, siguiente) {
  return Boolean(TRANSICIONES_CITA[actual]?.has(siguiente));
}

function validarTransicionCita(actual, siguiente) {
  if (!TRANSICIONES_CITA[actual]) throw new Error('Estado actual de cita inválido');
  if (!TRANSICIONES_CITA[actual].has(siguiente)) {
    throw new Error(`No se permite cambiar una cita de ${actual} a ${siguiente}`);
  }
}

module.exports = { TRANSICIONES_CITA, puedeCambiarCita, validarTransicionCita };
