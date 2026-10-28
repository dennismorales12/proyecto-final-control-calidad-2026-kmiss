import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, obtenerToken } from './api';

const almacenamiento = new Map();

function respuestaJson(datos, { estado = 200, correcta = true } = {}) {
  return {
    ok: correcta,
    status: estado,
    headers: { get: vi.fn(() => 'application/json; charset=utf-8') },
    json: vi.fn().mockResolvedValue(datos),
  };
}

describe('cliente HTTP del frontend', () => {
  beforeEach(() => {
    almacenamiento.clear();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((clave) => almacenamiento.get(clave) || null),
      setItem: vi.fn((clave, valor) => almacenamiento.set(clave, valor)),
      removeItem: vi.fn((clave) => almacenamiento.delete(clave)),
    });
    vi.stubGlobal('fetch', vi.fn());
  });

  it('devuelve null cuando no hay token guardado', () => {
    expect(obtenerToken()).toBeNull();
  });

  it('recupera el token de la sesión', () => {
    almacenamiento.set('vitalis_token', 'token-de-prueba');
    expect(obtenerToken()).toBe('token-de-prueba');
  });

  it('envía el inicio de sesión como JSON', async () => {
    fetch.mockResolvedValue(respuestaJson({ token: 'abc' }));

    await api.login('admin@vitalis.local', 'clave-segura');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/login$/),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'admin@vitalis.local', password: 'clave-segura' }),
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    );
  });

  it('adjunta el token a las solicitudes autenticadas', async () => {
    almacenamiento.set('vitalis_token', 'token-de-prueba');
    fetch.mockResolvedValue(respuestaJson([]));

    await api.pacientes.listar();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/pacientes$/),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token-de-prueba' }) }),
    );
  });

  it('codifica el texto de búsqueda de pacientes', async () => {
    fetch.mockResolvedValue(respuestaJson([]));

    await api.pacientes.listar('María López');

    expect(fetch.mock.calls[0][0]).toMatch(/pacientes\?q=Mar%C3%ADa%20L%C3%B3pez$/);
  });

  it('construye los filtros de citas sin valores inventados', async () => {
    fetch.mockResolvedValue(respuestaJson([]));

    await api.citas.listar({ estado: 'confirmada', medico_id: 7 });

    const url = fetch.mock.calls[0][0];
    expect(url).toContain('/citas?');
    expect(url).toContain('estado=confirmada');
    expect(url).toContain('medico_id=7');
  });

  it('no agrega Content-Type al subir un FormData', async () => {
    fetch.mockResolvedValue(respuestaJson({ ok: true }));

    await api.pacientes.importar(new Blob(['datos'], { type: 'text/plain' }));

    expect(fetch.mock.calls[0][1].body).toBeInstanceOf(FormData);
    expect(fetch.mock.calls[0][1].headers).not.toHaveProperty('Content-Type');
  });

  it('devuelve el mensaje de error enviado por la API', async () => {
    fetch.mockResolvedValue(respuestaJson({ error: 'Credenciales inválidas' }, { estado: 401, correcta: false }));

    await expect(api.login('nadie@example.test', 'incorrecta')).rejects.toThrow('Credenciales inválidas');
  });

  it('crea un mensaje útil cuando el error no trae JSON', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 503,
      headers: { get: vi.fn(() => 'text/plain') },
    });

    await expect(api.me()).rejects.toThrow('Error en la petición (503)');
  });

  it('retorna null en una respuesta exitosa sin contenido JSON', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 204,
      headers: { get: vi.fn(() => '') },
    });

    await expect(api.productos.eliminar(20)).resolves.toBeNull();
  });

  it('codifica correctamente el mes del tablero de ventas', async () => {
    fetch.mockResolvedValue(respuestaJson({}));

    await api.ventas.dashboard('2026/10');

    expect(fetch.mock.calls[0][0]).toMatch(/ventas\/dashboard\?mes=2026%2F10$/);
  });

  it('permite limitar una búsqueda de inventario', async () => {
    fetch.mockResolvedValue(respuestaJson([]));

    await api.productos.buscar('gel antibacterial', 5);

    expect(fetch.mock.calls[0][0]).toMatch(/productos\?q=gel%20antibacterial&limit=5$/);
  });
});
