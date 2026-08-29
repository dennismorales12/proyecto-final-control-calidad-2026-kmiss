import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutGrid, Users, Stethoscope, CalendarDays, LogOut, Package, ShoppingCart, ClipboardList, UserCog, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { APP_CONFIG } from '../config';
import { api } from '../services/api';
import logoDorado from '../assets/brand/kmiss-logo-gold.png';

const ETIQUETAS_ROL = {
  administrador: 'Administrador/a',
  recepcion: 'Recepción',
  medico: 'Médico/a',
};

export default function Sidebar() {
  const { usuario, cerrarSesion } = useAuth();
  const [pedidosNuevos, setPedidosNuevos] = useState(0);

  useEffect(() => {
    if (!['administrador', 'recepcion'].includes(usuario?.rol)) return undefined;
    let activo = true;
    const cargar = () => api.pedidos.resumen()
      .then((datos) => activo && setPedidosNuevos(datos.nuevos || 0))
      .catch(() => {});
    cargar();
    const intervalo = setInterval(cargar, 30000);
    return () => { activo = false; clearInterval(intervalo); };
  }, [usuario?.rol]);

  return (
    <aside className="sidebar">
      <div className="sidebar-marca">
        <img className="sidebar-logo" src={logoDorado} alt={`${APP_CONFIG.nombreEmpresa} - ${APP_CONFIG.eslogan}`} />
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/" end className="sidebar-link">
          <LayoutGrid size={18} strokeWidth={1.75} />
          <span>Panel</span>
        </NavLink>
        <NavLink to="/pacientes" className="sidebar-link">
          <Users size={18} strokeWidth={1.75} />
          <span>Pacientes</span>
        </NavLink>
        <NavLink to="/servicios" className="sidebar-link">
          <Stethoscope size={18} strokeWidth={1.75} />
          <span>Servicios</span>
        </NavLink>
        <NavLink to="/citas" className="sidebar-link">
          <CalendarDays size={18} strokeWidth={1.75} />
          <span>Citas</span>
        </NavLink>
        <NavLink to="/inventario" className="sidebar-link">
          <Package size={18} strokeWidth={1.75} />
          <span>Inventario</span>
        </NavLink>
        <NavLink to="/ventas" className="sidebar-link">
          <ShoppingCart size={18} strokeWidth={1.75} />
          <span>Ventas</span>
        </NavLink>
        {['administrador', 'recepcion'].includes(usuario?.rol) && (
          <NavLink to="/pedidos" className="sidebar-link">
            <ClipboardList size={18} strokeWidth={1.75} />
            <span>Pedidos web</span>
            {pedidosNuevos > 0 && <span className="sidebar-contador">{pedidosNuevos}</span>}
          </NavLink>
        )}
        {usuario?.rol === 'administrador' && (
          <>
            <NavLink to="/usuarios" className="sidebar-link">
              <UserCog size={18} strokeWidth={1.75} />
              <span>Usuarios</span>
            </NavLink>
            <NavLink to="/ajustes" className="sidebar-link">
              <Settings size={18} strokeWidth={1.75} />
              <span>Ajustes</span>
            </NavLink>
          </>
        )}
      </nav>

      <div className="sidebar-usuario">
        <div className="sidebar-usuario-info">
          <p className="sidebar-usuario-nombre">{usuario?.nombre}</p>
          <p className="sidebar-usuario-rol">{ETIQUETAS_ROL[usuario?.rol] || usuario?.rol}</p>
        </div>
        <button className="sidebar-salir" onClick={cerrarSesion} title="Cerrar sesión">
          <LogOut size={17} strokeWidth={1.75} />
        </button>
      </div>
    </aside>
  );
}
