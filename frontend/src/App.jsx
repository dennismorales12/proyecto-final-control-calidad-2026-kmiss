import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Pacientes from './pages/Pacientes';
import Servicios from './pages/Servicios';
import Citas from './pages/Citas';
import Inventario from './pages/Inventario';
import Ventas from './pages/Ventas';
import Pedidos from './pages/Pedidos';
import Usuarios from './pages/Usuarios';
import Tienda from './pages/Tienda';
import Ajustes from './pages/Ajustes';

function DisenoPrincipal({ children }) {
  return (
    <div className="app-diseno">
      <Sidebar />
      <main className="app-contenido">{children}</main>
    </div>
  );
}

function RutasInternas() {
  const { cargando } = useAuth();
  if (cargando) return <div className="pantalla-carga">Cargando…</div>;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <ProtectedRoute><DisenoPrincipal><Dashboard /></DisenoPrincipal></ProtectedRoute>
      } />
      <Route path="/pacientes" element={
        <ProtectedRoute><DisenoPrincipal><Pacientes /></DisenoPrincipal></ProtectedRoute>
      } />
      <Route path="/servicios" element={
        <ProtectedRoute><DisenoPrincipal><Servicios /></DisenoPrincipal></ProtectedRoute>
      } />
      <Route path="/citas" element={
        <ProtectedRoute><DisenoPrincipal><Citas /></DisenoPrincipal></ProtectedRoute>
      } />
      <Route path="/inventario" element={
        <ProtectedRoute><DisenoPrincipal><Inventario /></DisenoPrincipal></ProtectedRoute>
      } />
      <Route path="/ventas" element={
        <ProtectedRoute rolesPermitidos={['administrador', 'recepcion']}>
          <DisenoPrincipal><Ventas /></DisenoPrincipal>
        </ProtectedRoute>
      } />
      <Route path="/pedidos" element={
        <ProtectedRoute rolesPermitidos={['administrador', 'recepcion']}>
          <DisenoPrincipal><Pedidos /></DisenoPrincipal>
        </ProtectedRoute>
      } />
      <Route path="/usuarios" element={
        <ProtectedRoute rolesPermitidos={['administrador']}>
          <DisenoPrincipal><Usuarios /></DisenoPrincipal>
        </ProtectedRoute>
      } />
      <Route path="/ajustes" element={
        <ProtectedRoute rolesPermitidos={['administrador']}>
          <DisenoPrincipal><Ajustes /></DisenoPrincipal>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Tienda pública: sin login, sin AuthProvider, accesible para cualquier visitante */}
        <Route path="/tienda" element={<Tienda />} />

        {/* Todo lo demás requiere sesión y vive dentro del panel interno */}
        <Route path="/*" element={
          <AuthProvider>
            <RutasInternas />
          </AuthProvider>
        } />
      </Routes>
    </BrowserRouter>
  );
}
