jest.mock('jsonwebtoken', () => ({ verify: jest.fn() }));
const jwt = require('jsonwebtoken');
const { autenticar, permitirRoles } = require('./auth');

function respuesta() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}
beforeEach(() => jest.clearAllMocks());

test('sin token devuelve 401 y no valida JWT', () => {
  const res = respuesta();
  const next = jest.fn();
  autenticar({ headers: {} }, res, next);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(jwt.verify).not.toHaveBeenCalled();
  expect(next).not.toHaveBeenCalled();
});
test('token inválido devuelve 403 y no continúa', () => {
  jwt.verify.mockImplementation((token, secreto, callback) => callback(new Error('Expiró')));
  const res = respuesta();
  const next = jest.fn();
  autenticar({ headers: { authorization: 'Bearer vencido' } }, res, next);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
});
test('token válido adjunta el usuario y continúa una vez', () => {
  const usuario = { id: 8, rol: 'recepcion' };
  jwt.verify.mockImplementation((token, secreto, callback) => callback(null, usuario));
  const req = { headers: { authorization: 'Bearer valido' } };
  const next = jest.fn();
  autenticar(req, respuesta(), next);
  expect(req.usuario).toEqual(usuario);
  expect(next).toHaveBeenCalledTimes(1);
});
test('sin usuario autenticado no permite una operación protegida', () => {
  const res = respuesta();
  const next = jest.fn();
  permitirRoles('administrador')({}, res, next);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
});
test('un médico no puede ejecutar una operación de administrador', () => {
  const res = respuesta();
  const next = jest.fn();
  permitirRoles('administrador')({ usuario: { rol: 'medico' } }, res, next);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
});
test('permite cualquiera de los roles autorizados', () => {
  const next = jest.fn();
  permitirRoles('administrador', 'recepcion')({ usuario: { rol: 'recepcion' } }, respuesta(), next);
  expect(next).toHaveBeenCalledTimes(1);
});
