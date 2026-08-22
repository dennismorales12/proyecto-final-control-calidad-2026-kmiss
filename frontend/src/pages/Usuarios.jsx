import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, KeyRound, Ban, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const FORMULARIO_VACIO = { nombre: '', email: '', telefono: '', password: '', rol: 'recepcion' };

const ETIQUETAS_ROL = {
  administrador: 'Administrador/a',
  recepcion: 'Recepción',
  medico: 'Médico/a',
};

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [error, setError] = useState('');

  const [modalPassword, setModalPassword] = useState(null); // id del usuario o null
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [errorPassword, setErrorPassword] = useState('');

  const { usuario: sesion } = useAuth();

  async function cargarUsuarios() {
    setCargando(true);
    try {
      setUsuarios(await api.usuarios.listar());
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargarUsuarios(); }, []);

  function abrirNuevo() {
    setFormulario(FORMULARIO_VACIO);
    setEditandoId(null);
    setError('');
    setModalAbierto(true);
  }

  function abrirEdicion(u) {
    setFormulario({ nombre: u.nombre, email: u.email, telefono: u.telefono || '', password: '', rol: u.rol });
    setEditandoId(u.id);
    setError('');
    setModalAbierto(true);
  }

  async function guardar(e) {
    e.preventDefault();
    setError('');
    try {
      if (editandoId) {
        await api.usuarios.actualizar(editandoId, { nombre: formulario.nombre, telefono: formulario.telefono, rol: formulario.rol, activo: true });
      } else {
        await api.usuarios.crear(formulario);
      }
      setModalAbierto(false);
      cargarUsuarios();
    } catch (err) {
      setError(err.message);
    }
  }

  async function alternarActivo(u) {
    try {
      await api.usuarios.actualizar(u.id, { nombre: u.nombre, telefono: u.telefono, rol: u.rol, activo: !u.activo });
      cargarUsuarios();
    } catch (err) {
      alert(err.message);
    }
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este usuario permanentemente?')) return;
    try {
      await api.usuarios.eliminar(id);
      cargarUsuarios();
    } catch (err) {
      alert(err.message);
    }
  }

  async function guardarPassword(e) {
    e.preventDefault();
    setErrorPassword('');
    try {
      await api.usuarios.restablecerPassword(modalPassword, nuevaPassword);
      setModalPassword(null);
      setNuevaPassword('');
    } catch (err) {
      setErrorPassword(err.message);
    }
  }

  return (
    <div className="pagina">
      <header className="pagina-encabezado">
        <div>
          <h1>Usuarios y accesos</h1>
          <p>{usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''} con acceso al sistema</p>
        </div>
        <button className="boton-primario" onClick={abrirNuevo}>
          <Plus size={17} strokeWidth={2} /> Nuevo usuario
        </button>
      </header>

      <div className="tabla-contenedor">
        {cargando ? (
          <p className="texto-vacio">Cargando…</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Teléfono</th>
                <th>Rol</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td>{u.nombre} {u.id === sesion.id && <span className="etiqueta">Tú</span>}</td>
                  <td className="texto-tenue">{u.email}</td>
                  <td className="texto-tenue">{u.telefono || '—'}</td>
                  <td>{ETIQUETAS_ROL[u.rol] || u.rol}</td>
                  <td>
                    <span className={`etiqueta-estado ${u.activo ? 'estado-atendida' : 'estado-cancelada'}`}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="tabla-acciones">
                    <button onClick={() => abrirEdicion(u)} title="Editar"><Pencil size={16} strokeWidth={1.75} /></button>
                    <button onClick={() => setModalPassword(u.id)} title="Restablecer contraseña"><KeyRound size={16} strokeWidth={1.75} /></button>
                    {sesion?.rol === 'administrador' && u.id !== sesion.id && (
                      <>
                        <button onClick={() => alternarActivo(u)} title={u.activo ? 'Desactivar' : 'Activar'}>
                          {u.activo ? <Ban size={16} strokeWidth={1.75} /> : <CheckCircle2 size={16} strokeWidth={1.75} />}
                        </button>
                        <button onClick={() => eliminar(u.id)} title="Eliminar" className="boton-peligro">
                          <Trash2 size={16} strokeWidth={1.75} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalAbierto && (
        <div className="modal-fondo" onClick={() => setModalAbierto(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-encabezado">
              <h2>{editandoId ? 'Editar usuario' : 'Nuevo usuario'}</h2>
              <button className="modal-cerrar" onClick={() => setModalAbierto(false)}><X size={18} /></button>
            </div>
            <form onSubmit={guardar} className="formulario-grid">
              <label className="campo-ancho">Nombre completo *
                <input required value={formulario.nombre}
                  onChange={(e) => setFormulario({ ...formulario, nombre: e.target.value })} />
              </label>
              <label className="campo-ancho">Correo electrónico *
                <input type="email" required disabled={!!editandoId} value={formulario.email}
                  onChange={(e) => setFormulario({ ...formulario, email: e.target.value })} />
              </label>
              <label className="campo-ancho">Teléfono / WhatsApp
                <input type="tel" value={formulario.telefono}
                  onChange={(e) => setFormulario({ ...formulario, telefono: e.target.value })} />
              </label>
              {!editandoId && (
                <label className="campo-ancho">Contraseña inicial *
                  <input type="password" required minLength={6} value={formulario.password}
                    onChange={(e) => setFormulario({ ...formulario, password: e.target.value })} />
                </label>
              )}
              <label className="campo-ancho">Rol *
                <select required value={formulario.rol}
                  onChange={(e) => setFormulario({ ...formulario, rol: e.target.value })}>
                  <option value="administrador">Administrador/a — acceso completo</option>
                  <option value="recepcion">Recepción — pacientes, citas, ventas</option>
                  <option value="medico">Médico/a — consulta de citas y expedientes</option>
                </select>
              </label>

              {error && <p className="login-error campo-ancho">{error}</p>}

              <div className="modal-acciones campo-ancho">
                <button type="button" className="boton-secundario" onClick={() => setModalAbierto(false)}>Cancelar</button>
                <button type="submit" className="boton-primario">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalPassword && (
        <div className="modal-fondo" onClick={() => setModalPassword(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="modal-encabezado">
              <h2>Restablecer contraseña</h2>
              <button className="modal-cerrar" onClick={() => setModalPassword(null)}><X size={18} /></button>
            </div>
            <form onSubmit={guardarPassword} className="formulario-grid">
              <label className="campo-ancho">Nueva contraseña *
                <input type="password" required minLength={6} value={nuevaPassword}
                  onChange={(e) => setNuevaPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
              </label>
              {errorPassword && <p className="login-error campo-ancho">{errorPassword}</p>}
              <div className="modal-acciones campo-ancho">
                <button type="button" className="boton-secundario" onClick={() => setModalPassword(null)}>Cancelar</button>
                <button type="submit" className="boton-primario">Actualizar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
