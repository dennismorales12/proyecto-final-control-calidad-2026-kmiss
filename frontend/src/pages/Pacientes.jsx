import { useEffect, useState } from 'react';
import { CalendarDays, Eye, Search, Plus, Pencil, ShoppingBag, Trash2, X } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import ImportarExcel from '../components/ImportarExcel';

const FORMULARIO_VACIO = {
  nit: '', nombre_completo: '', fecha_nacimiento: '',
  telefono: '', email: '', direccion: '', tipo_sangre: '', alergias: '',
  contacto_emergencia_nombre: '', contacto_emergencia_telefono: '',
};

function fecha(valor) {
  return valor ? new Date(valor).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

export default function Pacientes() {
  const [pacientes, setPacientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [error, setError] = useState('');
  const [ficha, setFicha] = useState(null);
  const [cargandoFicha, setCargandoFicha] = useState(false);
  const { usuario } = useAuth();

  const puedeEditar = ['administrador', 'recepcion'].includes(usuario?.rol);

  async function cargarPacientes(q = '') {
    setCargando(true);
    try {
      const datos = await api.pacientes.listar(q);
      setPacientes(datos);
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargarPacientes(); }, []);

  function manejarBusqueda(e) {
    e.preventDefault();
    cargarPacientes(busqueda);
  }

  function abrirNuevo() {
    setFormulario(FORMULARIO_VACIO);
    setEditandoId(null);
    setError('');
    setModalAbierto(true);
  }

  function abrirEdicion(paciente) {
    setFormulario({
      ...FORMULARIO_VACIO,
      ...paciente,
      fecha_nacimiento: paciente.fecha_nacimiento ? paciente.fecha_nacimiento.split('T')[0] : '',
    });
    setEditandoId(paciente.id);
    setError('');
    setModalAbierto(true);
  }

  async function guardar(e) {
    e.preventDefault();
    setError('');
    try {
      if (editandoId) {
        await api.pacientes.actualizar(editandoId, formulario);
      } else {
        await api.pacientes.crear(formulario);
      }
      setModalAbierto(false);
      cargarPacientes(busqueda);
    } catch (err) {
      setError(err.message);
    }
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este paciente? Esta acción no se puede deshacer.')) return;
    try {
      await api.pacientes.eliminar(id);
      cargarPacientes(busqueda);
    } catch (err) {
      alert(err.message);
    }
  }

  async function abrirFicha(paciente) {
    setCargandoFicha(true);
    setError('');
    try {
      const historial = await api.pacientes.historial(paciente.id);
      setFicha({ paciente, ...historial });
    } catch (err) {
      setError(err.message);
    } finally {
      setCargandoFicha(false);
    }
  }

  return (
    <div className="pagina">
      <header className="pagina-encabezado">
        <div>
          <h1>Pacientes</h1>
          <p>{pacientes.length} paciente{pacientes.length !== 1 ? 's' : ''} registrado{pacientes.length !== 1 ? 's' : ''}</p>
        </div>
        {puedeEditar && (
          <div style={{ display: 'flex', gap: 10 }}>
            {usuario.rol === 'administrador' && (
              <ImportarExcel
                onImportar={(archivo) => api.pacientes.importar(archivo)}
                alTerminar={() => cargarPacientes(busqueda)}
                columnas={['nombre_completo', 'nit', 'telefono', 'email', 'fecha_nacimiento', 'direccion', 'tipo_sangre', 'alergias', 'contacto_emergencia_nombre', 'contacto_emergencia_telefono']}
              />
            )}
            <button className="boton-primario" onClick={abrirNuevo}>
              <Plus size={17} strokeWidth={2} /> Nuevo paciente
            </button>
          </div>
        )}
      </header>

      <form className="barra-busqueda" onSubmit={manejarBusqueda}>
        <Search size={17} strokeWidth={1.75} />
        <input
          placeholder="Buscar por nombre, NIT, teléfono o correo…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </form>

      <div className="tabla-contenedor">
        {cargando ? (
          <p className="texto-vacio">Cargando…</p>
        ) : pacientes.length === 0 ? (
          <p className="texto-vacio">No se encontraron pacientes.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>NIT</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th>Tipo de sangre</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pacientes.map((p) => (
                <tr key={p.id}>
                  <td>{p.nombre_completo}</td>
                  <td className="texto-tenue">{p.nit || 'Pendiente'}</td>
                  <td className="texto-tenue">{p.telefono || '—'}</td>
                  <td className="texto-tenue">{p.email || '—'}</td>
                  <td>{p.tipo_sangre ? <span className="etiqueta">{p.tipo_sangre}</span> : '—'}</td>
                  <td className="tabla-acciones">
                    <button onClick={() => abrirFicha(p)} title="Ver ficha e historial" disabled={cargandoFicha}><Eye size={16} strokeWidth={1.75} /></button>
                    {puedeEditar && <>
                      <button onClick={() => abrirEdicion(p)} title="Editar"><Pencil size={16} strokeWidth={1.75} /></button>
                      {usuario.rol === 'administrador' && (
                        <button onClick={() => eliminar(p.id)} title="Eliminar" className="boton-peligro">
                          <Trash2 size={16} strokeWidth={1.75} />
                        </button>
                      )}
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {ficha && (
        <div className="modal-fondo" onClick={() => setFicha(null)}>
          <div className="modal ficha-paciente-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-encabezado">
              <div><h2>{ficha.paciente.nombre_completo}</h2><span className="texto-tenue">NIT: {ficha.paciente.nit || 'Pendiente de registrar'}</span></div>
              <button className="modal-cerrar" onClick={() => setFicha(null)} title="Cerrar"><X size={18} /></button>
            </div>
            <div className="ficha-contacto">
              <div><span>Teléfono</span><strong>{ficha.paciente.telefono || '—'}</strong></div>
              <div><span>Correo</span><strong>{ficha.paciente.email || '—'}</strong></div>
              <div><span>Dirección</span><strong>{ficha.paciente.direccion || '—'}</strong></div>
            </div>

            <section className="ficha-seccion">
              <h3><ShoppingBag size={17} /> Compras confirmadas</h3>
              {ficha.ventas.length === 0 ? <p className="texto-vacio">No hay compras confirmadas.</p> : ficha.ventas.map((venta) => (
                <article className="ficha-registro" key={venta.id}>
                  <div><strong>Venta #{venta.id}</strong><span>{fecha(venta.creado_en)} · {venta.estado}</span></div>
                  <div className="ficha-items">{venta.detalles.map((item, index) => <span key={index}>{item.cantidad} × {item.descripcion}</span>)}</div>
                  <strong>Q{Number(venta.total).toFixed(2)}</strong>
                </article>
              ))}
            </section>

            <section className="ficha-seccion">
              <h3><ShoppingBag size={17} /> Pedidos web</h3>
              {ficha.pedidos.length === 0 ? <p className="texto-vacio">No hay pedidos web.</p> : ficha.pedidos.map((pedido) => (
                <article className="ficha-registro" key={pedido.id}>
                  <div><strong>Pedido #{pedido.id}</strong><span>{fecha(pedido.creado_en)} · {pedido.estado.replace('_', ' ')}</span></div>
                  <div className="ficha-items">{pedido.detalles.map((item, index) => <span key={index}>{item.cantidad} × {item.descripcion}</span>)}</div>
                  <strong>Q{Number(pedido.total).toFixed(2)}</strong>
                </article>
              ))}
            </section>

            <section className="ficha-seccion">
              <h3><CalendarDays size={17} /> Citas y servicios</h3>
              {ficha.citas.length === 0 ? <p className="texto-vacio">No hay citas registradas.</p> : ficha.citas.map((cita) => (
                <article className="ficha-registro" key={cita.id}>
                  <div><strong>{cita.servicio}</strong><span>{fecha(cita.fecha_hora)} · {cita.estado}</span></div>
                  <div className="ficha-items"><span>{cita.medico || 'Médico por asignar'}</span>{cita.notas_medico && <span>{cita.notas_medico}</span>}</div>
                  <strong>Q{Number(cita.precio).toFixed(2)}</strong>
                </article>
              ))}
            </section>
          </div>
        </div>
      )}

      {modalAbierto && (
        <div className="modal-fondo" onClick={() => setModalAbierto(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-encabezado">
              <h2>{editandoId ? 'Editar paciente' : 'Nuevo paciente'}</h2>
              <button className="modal-cerrar" onClick={() => setModalAbierto(false)}><X size={18} /></button>
            </div>
            <form onSubmit={guardar} className="formulario-grid">
              <label>Nombre completo *
                <input required value={formulario.nombre_completo}
                  onChange={(e) => setFormulario({ ...formulario, nombre_completo: e.target.value })} />
              </label>
              <label>NIT
                <input inputMode="text" value={formulario.nit}
                  onChange={(e) => setFormulario({ ...formulario, nit: e.target.value })} />
              </label>
              <label>Fecha de nacimiento
                <input type="date" value={formulario.fecha_nacimiento}
                  onChange={(e) => setFormulario({ ...formulario, fecha_nacimiento: e.target.value })} />
              </label>
              <label>Tipo de sangre
                <input placeholder="O+, A-, etc." value={formulario.tipo_sangre}
                  onChange={(e) => setFormulario({ ...formulario, tipo_sangre: e.target.value })} />
              </label>
              <label>Teléfono
                <input value={formulario.telefono}
                  onChange={(e) => setFormulario({ ...formulario, telefono: e.target.value })} />
              </label>
              <label>Email
                <input type="email" value={formulario.email}
                  onChange={(e) => setFormulario({ ...formulario, email: e.target.value })} />
              </label>
              <label className="campo-ancho">Dirección
                <input value={formulario.direccion}
                  onChange={(e) => setFormulario({ ...formulario, direccion: e.target.value })} />
              </label>
              <label className="campo-ancho">Alergias
                <input value={formulario.alergias}
                  onChange={(e) => setFormulario({ ...formulario, alergias: e.target.value })} />
              </label>
              <label>Contacto de emergencia
                <input value={formulario.contacto_emergencia_nombre}
                  onChange={(e) => setFormulario({ ...formulario, contacto_emergencia_nombre: e.target.value })} />
              </label>
              <label>Teléfono de emergencia
                <input value={formulario.contacto_emergencia_telefono}
                  onChange={(e) => setFormulario({ ...formulario, contacto_emergencia_telefono: e.target.value })} />
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
    </div>
  );
}
