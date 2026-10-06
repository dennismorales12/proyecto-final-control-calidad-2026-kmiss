const { validarDisponibilidad } = require('./agenda');

const cita = { medicoId: 7, sedeId: 2, servicioId: 3, fechaHora: '2026-10-20T10:00:00', excluirCitaId: 12 };
function clienteCon({ servicio = [{ duracion_minutos: 30 }], horario = [{}], bloqueo = [], conflicto = [] } = {}) {
  return { query: jest.fn()
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: servicio })
    .mockResolvedValueOnce({ rows: horario })
    .mockResolvedValueOnce({ rows: bloqueo })
    .mockResolvedValueOnce({ rows: conflicto }) };
}

test('no consulta la base si falta el médico', async () => {
  const cliente = clienteCon();
  await expect(validarDisponibilidad(cliente, { ...cita, medicoId: null })).rejects.toThrow('seleccionar un medico');
  expect(cliente.query).not.toHaveBeenCalled();
});
test('no consulta la base si falta la sede', async () => {
  const cliente = clienteCon();
  await expect(validarDisponibilidad(cliente, { ...cita, sedeId: null })).rejects.toThrow('seleccionar una sede');
  expect(cliente.query).not.toHaveBeenCalled();
});
test('rechaza un servicio inactivo o inexistente', async () => {
  const cliente = clienteCon({ servicio: [] });
  await expect(validarDisponibilidad(cliente, cita)).rejects.toThrow('Servicio no disponible');
  expect(cliente.query).toHaveBeenCalledTimes(2);
});
test('rechaza una cita fuera del turno del médico', async () => {
  await expect(validarDisponibilidad(clienteCon({ horario: [] }), cita)).rejects.toThrow('dia u horario');
});
test('informa el motivo del bloqueo médico', async () => {
  await expect(validarDisponibilidad(clienteCon({ bloqueo: [{ motivo: 'Vacaciones' }] }), cita)).rejects.toThrow('Vacaciones');
});
test('rechaza un horario que ya tiene una cita', async () => {
  await expect(validarDisponibilidad(clienteCon({ conflicto: [{}] }), cita)).rejects.toThrow('ya esta ocupado');
});
test('devuelve duración y excluye la cita que se está editando', async () => {
  const cliente = clienteCon();
  await expect(validarDisponibilidad(cliente, cita)).resolves.toBe(30);
  expect(cliente.query.mock.calls[0]).toEqual(['SELECT pg_advisory_xact_lock($1)', [7]]);
  expect(cliente.query.mock.calls[4][1]).toEqual([7, cita.fechaHora, 30, 12]);
});
test('usa null al verificar conflictos de una cita nueva', async () => {
  const cliente = clienteCon();
  const { excluirCitaId, ...nueva } = cita;
  await validarDisponibilidad(cliente, nueva);
  expect(cliente.query.mock.calls[4][1][3]).toBeNull();
});
test('propaga un fallo de base de datos sin aceptar el horario', async () => {
  const cliente = { query: jest.fn().mockRejectedValue(new Error('Sin conexión')) };
  await expect(validarDisponibilidad(cliente, cita)).rejects.toThrow('Sin conexión');
});
