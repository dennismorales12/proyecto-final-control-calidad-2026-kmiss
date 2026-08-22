import { useEffect, useState } from 'react';
import { ImagePlus, Plus, Pencil, Trash2, X, Stethoscope } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { urlArchivo } from '../config';

const FORMULARIO_VACIO = { nombre: '', descripcion: '', duracion_minutos: 30, precio: 0, especialidad: '', activo: true };

export default function Servicios() {
  const [servicios, setServicios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [error, setError] = useState('');
  const [imagenArchivo, setImagenArchivo] = useState(null);
  const [imagenPreview, setImagenPreview] = useState(null);
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'administrador';

  async function cargarServicios() {
    setCargando(true);
    try {
      setServicios(await api.servicios.listar());
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargarServicios(); }, []);

  function abrirNuevo() {
    setFormulario(FORMULARIO_VACIO);
    setEditandoId(null);
    setImagenArchivo(null); setImagenPreview(null);
    setError('');
    setModalAbierto(true);
  }

  function abrirEdicion(s) {
    setFormulario(s);
    setEditandoId(s.id);
    setImagenArchivo(null); setImagenPreview(urlArchivo(s.imagen_url));
    setError('');
    setModalAbierto(true);
  }

  async function guardar(e) {
    e.preventDefault();
    setError('');
    try {
      const servicio = editandoId
        ? await api.servicios.actualizar(editandoId, formulario)
        : await api.servicios.crear(formulario);
      if (imagenArchivo) await api.servicios.subirImagen(servicio.id, imagenArchivo);
      setModalAbierto(false);
      cargarServicios();
    } catch (err) {
      setError(err.message);
    }
  }

  function seleccionarImagen(e) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setImagenArchivo(archivo);
    const lector = new FileReader();
    lector.onload = () => setImagenPreview(lector.result);
    lector.readAsDataURL(archivo);
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este servicio?')) return;
    try {
      await api.servicios.eliminar(id);
      cargarServicios();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="pagina">
      <header className="pagina-encabezado">
        <div>
          <h1>Servicios</h1>
          <p>{servicios.length} servicio{servicios.length !== 1 ? 's' : ''} configurado{servicios.length !== 1 ? 's' : ''}</p>
        </div>
        {esAdmin && (
          <button className="boton-primario" onClick={abrirNuevo}>
            <Plus size={17} strokeWidth={2} /> Nuevo servicio
          </button>
        )}
      </header>

      <div className="tarjetas-servicios">
        {cargando ? (
          <p className="texto-vacio">Cargando…</p>
        ) : servicios.length === 0 ? (
          <p className="texto-vacio">No hay servicios configurados.</p>
        ) : (
          servicios.map((s) => (
            <div key={s.id} className={`tarjeta-servicio ${!s.activo ? 'tarjeta-inactiva' : ''}`}>
              <div className="servicio-admin-imagen">{s.imagen_url ? <img src={urlArchivo(s.imagen_url)} alt={s.nombre} /> : <Stethoscope size={26} />}</div>
              <div className="tarjeta-servicio-header">
                <h3>{s.nombre}</h3>
                {esAdmin && (
                  <div className="tarjeta-servicio-acciones">
                    <button onClick={() => abrirEdicion(s)}><Pencil size={15} strokeWidth={1.75} /></button>
                    <button onClick={() => eliminar(s.id)} className="boton-peligro"><Trash2 size={15} strokeWidth={1.75} /></button>
                  </div>
                )}
              </div>
              {s.especialidad && <span className="etiqueta">{s.especialidad}</span>}
              <p className="tarjeta-servicio-descripcion">{s.descripcion || 'Sin descripción'}</p>
              <div className="tarjeta-servicio-footer">
                <span>{s.duracion_minutos} min</span>
                <span className="precio">Q{Number(s.precio).toFixed(2)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {modalAbierto && (
        <div className="modal-fondo" onClick={() => setModalAbierto(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-encabezado">
              <h2>{editandoId ? 'Editar servicio' : 'Nuevo servicio'}</h2>
              <button className="modal-cerrar" onClick={() => setModalAbierto(false)}><X size={18} /></button>
            </div>
            <form onSubmit={guardar} className="formulario-grid">
              <label className="campo-ancho producto-imagen-campo">Imagen del servicio
                <div className="producto-imagen-selector"><div className="producto-imagen-preview">{imagenPreview ? <img src={imagenPreview} alt="Vista previa del servicio" /> : <ImagePlus size={28} />}</div><div><input type="file" accept="image/jpeg,image/png,image/webp" onChange={seleccionarImagen} /><small>JPG, PNG o WEBP. Máximo 5 MB.</small></div></div>
              </label>
              <label className="campo-ancho">Nombre *
                <input required value={formulario.nombre}
                  onChange={(e) => setFormulario({ ...formulario, nombre: e.target.value })} />
              </label>
              <label className="campo-ancho">Descripción
                <textarea rows={2} value={formulario.descripcion}
                  onChange={(e) => setFormulario({ ...formulario, descripcion: e.target.value })} />
              </label>
              <label>Especialidad
                <input value={formulario.especialidad}
                  onChange={(e) => setFormulario({ ...formulario, especialidad: e.target.value })} />
              </label>
              <label>Duración (minutos)
                <input type="number" min="5" step="5" value={formulario.duracion_minutos}
                  onChange={(e) => setFormulario({ ...formulario, duracion_minutos: Number(e.target.value) })} />
              </label>
              <label>Precio (Q)
                <input type="number" min="0" step="0.01" value={formulario.precio}
                  onChange={(e) => setFormulario({ ...formulario, precio: Number(e.target.value) })} />
              </label>
              <label className="campo-checkbox">
                <input type="checkbox" checked={formulario.activo}
                  onChange={(e) => setFormulario({ ...formulario, activo: e.target.checked })} />
                Servicio activo
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
