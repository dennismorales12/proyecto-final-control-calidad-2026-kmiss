jest.mock('./db', () => ({ query: jest.fn() }));
const pool = require('./db');
const { liberarReservasVencidas, ESTADOS_CON_RESERVA } = require('./reservas');
beforeEach(() => jest.clearAllMocks());

test('libera solo los estados que mantienen una reserva', async () => {
  const cliente = { query: jest.fn().mockResolvedValue({ rowCount: 2 }) };
  await liberarReservasVencidas(cliente);
  expect(cliente.query).toHaveBeenCalledTimes(1);
  expect(cliente.query.mock.calls[0][1]).toEqual([['nuevo', 'contactado', 'esperando_pago']]);
  expect(ESTADOS_CON_RESERVA).not.toContain('pagado');
  expect(pool.query).not.toHaveBeenCalled();
});
test('usa el pool cuando no se recibe un cliente transaccional', async () => {
  pool.query.mockResolvedValue({ rowCount: 0 });
  await liberarReservasVencidas();
  expect(pool.query).toHaveBeenCalledTimes(1);
  expect(pool.query.mock.calls[0][0]).toContain('reserva_expira_en <= NOW()');
  expect(pool.query.mock.calls[0][0]).toContain('GREATEST(0, p.stock_reservado - c.cantidad)');
});
test('propaga el error para que el llamador pueda revertir la operación', async () => {
  const cliente = { query: jest.fn().mockRejectedValue(new Error('Reserva no actualizada')) };
  await expect(liberarReservasVencidas(cliente)).rejects.toThrow('Reserva no actualizada');
});
