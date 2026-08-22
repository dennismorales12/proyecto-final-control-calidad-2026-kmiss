import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('vitalis_token');
    if (!token) {
      setCargando(false);
      return;
    }
    api.me()
      .then((res) => setUsuario(res.usuario))
      .catch(() => localStorage.removeItem('vitalis_token'))
      .finally(() => setCargando(false));
  }, []);

  async function iniciarSesion(email, password) {
    const res = await api.login(email, password);
    localStorage.setItem('vitalis_token', res.token);
    setUsuario(res.usuario);
    return res.usuario;
  }

  function cerrarSesion() {
    localStorage.removeItem('vitalis_token');
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, cargando, iniciarSesion, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return contexto;
}
