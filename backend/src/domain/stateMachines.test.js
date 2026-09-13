const { puedeCambiarCita, validarTransicionCita } = require('./stateMachines');

describe('máquina de estados de citas', () => {
  test('permite confirmar una solicitud', () => expect(puedeCambiarCita('solicitada','confirmada')).toBe(true));
  test('permite programar una solicitud', () => expect(puedeCambiarCita('solicitada','programada')).toBe(true));
  test('permite cancelar una solicitud', () => expect(puedeCambiarCita('solicitada','cancelada')).toBe(true));
  test('permite atender una cita programada', () => expect(puedeCambiarCita('programada','atendida')).toBe(true));
  test('permite marcar no asistencia desde confirmada', () => expect(puedeCambiarCita('confirmada','no_asistio')).toBe(true));
  test('rechaza regresar de atendida a programada', () => expect(puedeCambiarCita('atendida','programada')).toBe(false));
  test('rechaza reactivar una cita cancelada', () => expect(puedeCambiarCita('cancelada','confirmada')).toBe(false));
  test('rechaza cambiar una no asistencia', () => expect(puedeCambiarCita('no_asistio','programada')).toBe(false));
  test('rechaza saltar de solicitada a atendida', () => expect(puedeCambiarCita('solicitada','atendida')).toBe(false));
  test('lanza error para transición inválida', () => expect(() => validarTransicionCita('atendida','programada')).toThrow('No se permite'));
  test('lanza error para estado actual desconocido', () => expect(() => validarTransicionCita('desconocido','programada')).toThrow('Estado actual'));
  test('no lanza error para transición permitida', () => expect(() => validarTransicionCita('confirmada','atendida')).not.toThrow());
});
