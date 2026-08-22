// ============================================
// Configuración central de la aplicación.
// Cambia aquí el nombre del negocio y se reflejará
// en toda la interfaz (sidebar, login, título, etc).
// ============================================
export const APP_CONFIG = {
  nombreEmpresa: 'K-MISS',
  eslogan: 'Medicina estética avanzada',
  tipoNegocio: 'Clínica de medicina estética',
  instagramUrl: 'https://www.instagram.com/kmiss_medicina_estetica/',
  instagramUsuario: '@kmiss_medicina_estetica',
  whatsapp: '50255784833',
};

export const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:4000/api');
export const ARCHIVOS_URL = API_URL.replace(/\/api\/?$/, '');

export function urlArchivo(ruta) {
  return ruta ? `${ARCHIVOS_URL}${ruta}` : null;
}
