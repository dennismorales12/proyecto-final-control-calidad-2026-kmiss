import { API_URL } from '../config';

function obtenerToken() {
  return localStorage.getItem('vitalis_token');
}

async function peticion(endpoint, opciones = {}) {
  const token = obtenerToken();
  const esFormData = opciones.body instanceof FormData;

  const respuesta = await fetch(`${API_URL}${endpoint}`, {
    ...opciones,
    headers: {
      ...(esFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opciones.headers,
    },
  });

  const contentType = respuesta.headers.get('content-type') || '';
  const datos = contentType.includes('application/json') ? await respuesta.json() : null;

  if (!respuesta.ok) {
    throw new Error(datos?.error || `Error en la petición (${respuesta.status})`);
  }

  return datos;
}

export const api = {
  login: (email, password) =>
    peticion('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  me: () => peticion('/auth/me'),

  pacientes: {
    listar: (q = '') => peticion(`/pacientes${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    obtener: (id) => peticion(`/pacientes/${id}`),
    historial: (id) => peticion(`/pacientes/${id}/historial`),
    crear: (datos) => peticion('/pacientes', { method: 'POST', body: JSON.stringify(datos) }),
    actualizar: (id, datos) => peticion(`/pacientes/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),
    eliminar: (id) => peticion(`/pacientes/${id}`, { method: 'DELETE' }),
    importar: (archivo) => {
      const formData = new FormData();
      formData.append('archivo', archivo);
      return peticion('/pacientes/importar', { method: 'POST', body: formData });
    },
  },

  servicios: {
    listar: () => peticion('/servicios'),
    crear: (datos) => peticion('/servicios', { method: 'POST', body: JSON.stringify(datos) }),
    actualizar: (id, datos) => peticion(`/servicios/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),
    subirImagen: (id, archivo) => {
      const formData = new FormData();
      formData.append('imagen', archivo);
      return peticion(`/servicios/${id}/imagen`, { method: 'POST', body: formData });
    },
    eliminar: (id) => peticion(`/servicios/${id}`, { method: 'DELETE' }),
  },

  citas: {
    listar: (filtros = {}) => {
      const params = new URLSearchParams(filtros).toString();
      return peticion(`/citas${params ? `?${params}` : ''}`);
    },
    crear: (datos) => peticion('/citas', { method: 'POST', body: JSON.stringify(datos) }),
    sedes: () => peticion('/citas/sedes/lista'),
    medicos: (sedeId = '') => peticion(`/citas/medicos/lista${sedeId ? `?sede_id=${sedeId}` : ''}`),
    disponibilidad: (medicoId, sedeId, servicioId, fecha) =>
      peticion(`/citas/disponibilidad?medico_id=${medicoId}&sede_id=${sedeId}&servicio_id=${servicioId}&fecha=${fecha}`),
    actualizar: (id, datos) => peticion(`/citas/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),
    cambiarEstado: (id, estado) =>
      peticion(`/citas/${id}/estado`, { method: 'PUT', body: JSON.stringify({ estado }) }),
    eliminar: (id) => peticion(`/citas/${id}`, { method: 'DELETE' }),
    importar: (archivo) => {
      const formData = new FormData();
      formData.append('archivo', archivo);
      return peticion('/citas/importar', { method: 'POST', body: formData });
    },
  },

  productos: {
    listar: (q = '') => peticion(`/productos${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    buscar: (q, limite = 8) => peticion(`/productos?q=${encodeURIComponent(q)}&limit=${limite}`),
    crear: (datos) => peticion('/productos', { method: 'POST', body: JSON.stringify(datos) }),
    actualizar: (id, datos) => peticion(`/productos/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),
    subirImagen: (id, archivo) => {
      const formData = new FormData();
      formData.append('imagen', archivo);
      return peticion(`/productos/${id}/imagen`, { method: 'POST', body: formData });
    },
    eliminar: (id) => peticion(`/productos/${id}`, { method: 'DELETE' }),
    importar: (archivo) => {
      const formData = new FormData();
      formData.append('archivo', archivo);
      return peticion('/productos/importar', { method: 'POST', body: formData });
    },
  },

  ajustes: {
    categorias: {
      listar: () => peticion('/ajustes/categorias'),
      crear: (datos) => peticion('/ajustes/categorias', { method: 'POST', body: JSON.stringify(datos) }),
      actualizar: (id, datos) => peticion(`/ajustes/categorias/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),
      eliminar: (id) => peticion(`/ajustes/categorias/${id}`, { method: 'DELETE' }),
    },
    promociones: {
      listar: () => peticion('/ajustes/promociones'),
      crear: (datos) => peticion('/ajustes/promociones', { method: 'POST', body: JSON.stringify(datos) }),
      actualizar: (id, datos) => peticion(`/ajustes/promociones/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),
      eliminar: (id) => peticion(`/ajustes/promociones/${id}`, { method: 'DELETE' }),
    },
    sedes: {
      listar: () => peticion('/ajustes/sedes'),
      crear: (datos) => peticion('/ajustes/sedes', { method: 'POST', body: JSON.stringify(datos) }),
      actualizar: (id, datos) => peticion(`/ajustes/sedes/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),
      eliminar: (id) => peticion(`/ajustes/sedes/${id}`, { method: 'DELETE' }),
    },
    horarios: {
      listar: () => peticion('/ajustes/horarios-semanales'),
      crear: (datos) => peticion('/ajustes/horarios-semanales', { method: 'POST', body: JSON.stringify(datos) }),
      actualizar: (id, datos) => peticion(`/ajustes/horarios-semanales/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),
      eliminar: (id) => peticion(`/ajustes/horarios-semanales/${id}`, { method: 'DELETE' }),
    },
    bloqueos: {
      listar: () => peticion('/ajustes/bloqueos-medicos'),
      crear: (datos) => peticion('/ajustes/bloqueos-medicos', { method: 'POST', body: JSON.stringify(datos) }),
      eliminar: (id) => peticion(`/ajustes/bloqueos-medicos/${id}`, { method: 'DELETE' }),
    },
    noticias: {
      listar: () => peticion('/ajustes/noticias'),
      crear: (datos) => peticion('/ajustes/noticias', { method: 'POST', body: JSON.stringify(datos) }),
      actualizar: (id, datos) => peticion(`/ajustes/noticias/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),
      eliminar: (id) => peticion(`/ajustes/noticias/${id}`, { method: 'DELETE' }),
      subirImagen: (id, archivo) => {
        const formData = new FormData(); formData.append('imagen', archivo);
        return peticion(`/ajustes/noticias/${id}/imagen`, { method: 'POST', body: formData });
      },
    },
  },

  ventas: {
    dashboard: (mes) => peticion(`/ventas/dashboard?mes=${encodeURIComponent(mes)}`),
    listar: (filtros = {}) => {
      const params = new URLSearchParams(filtros).toString();
      return peticion(`/ventas${params ? `?${params}` : ''}`);
    },
    obtener: (id) => peticion(`/ventas/${id}`),
    crear: (datos) => peticion('/ventas', { method: 'POST', body: JSON.stringify(datos) }),
    anular: (id) => peticion(`/ventas/${id}/anular`, { method: 'PUT' }),
  },

  usuarios: {
    listar: () => peticion('/usuarios'),
    crear: (datos) => peticion('/usuarios', { method: 'POST', body: JSON.stringify(datos) }),
    actualizar: (id, datos) => peticion(`/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),
    eliminar: (id) => peticion(`/usuarios/${id}`, { method: 'DELETE' }),
    restablecerPassword: (id, password) =>
      peticion(`/usuarios/${id}/password`, { method: 'PUT', body: JSON.stringify({ password }) }),
  },

  pedidos: {
    resumen: () => peticion('/pedidos/resumen'),
    listar: (filtros = {}) => {
      const params = new URLSearchParams(filtros).toString();
      return peticion(`/pedidos${params ? `?${params}` : ''}`);
    },
    obtener: (id) => peticion(`/pedidos/${id}`),
    contactar: (id) => peticion(`/pedidos/${id}/contactar`, { method: 'PUT' }),
    reabrir: (id) => peticion(`/pedidos/${id}/reabrir`, { method: 'PUT' }),
    esperandoPago: (id) => peticion(`/pedidos/${id}/esperando-pago`, { method: 'PUT' }),
    confirmarPago: (id, referencia_pago) =>
      peticion(`/pedidos/${id}/confirmar-pago`, { method: 'PUT', body: JSON.stringify({ referencia_pago }) }),
    cancelar: (id, motivo) => peticion(`/pedidos/${id}/cancelar`, { method: 'PUT', body: JSON.stringify({ motivo }) }),
    preparar: (id) => peticion(`/pedidos/${id}/preparar`, { method: 'PUT' }),
    entregar: (id) => peticion(`/pedidos/${id}/entregar`, { method: 'PUT' }),
  },

  tienda: {
    productos: () => peticion('/tienda/productos'),
    crearPedido: (datos) => peticion('/tienda/pedidos', { method: 'POST', body: JSON.stringify(datos) }),
    servicios: () => peticion('/tienda/servicios'),
    sedes: () => peticion('/tienda/sedes'),
    noticias: () => peticion('/tienda/noticias'),
    medicos: (sedeId = '') => peticion(`/tienda/medicos${sedeId ? `?sede_id=${sedeId}` : ''}`),
    disponibilidad: (medicoId, sedeId, servicioId, fecha) =>
      peticion(`/tienda/disponibilidad?medico_id=${medicoId}&sede_id=${sedeId}&servicio_id=${servicioId}&fecha=${fecha}`),
    solicitarCita: (datos) => peticion('/tienda/citas', { method: 'POST', body: JSON.stringify(datos) }),
  },
};

export { obtenerToken };
