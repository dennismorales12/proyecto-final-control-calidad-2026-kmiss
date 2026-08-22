import { useEffect, useState } from 'react';
import { Search, Plus, Pencil, Trash2, X, AlertTriangle, ImagePlus, Package } from 'lucide-react';
import { api } from '../services/api';
import { urlArchivo } from '../config';
import { useAuth } from '../contexts/AuthContext';
import ImportarExcel from '../components/ImportarExcel';

const FORMULARIO_VACIO = {
  nombre: '', descripcion: '', categoria_id: '', precio: 0, costo: 0,
  stock_actual: 0, stock_minimo: 0, unidad_medida: 'unidad', activo: true,
};

export default function Inventario() {
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [error, setError] = useState('');
  const [categorias, setCategorias] = useState([]);
  const [imagenArchivo, setImagenArchivo] = useState(null);
  const [imagenPreview, setImagenPreview] = useState(null);
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'administrador';

  async function cargarProductos(q = '') {
    setCargando(true);
    try {
      setProductos(await api.productos.listar(q));
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarProductos();
    if (esAdmin) api.ajustes.categorias.listar().then(setCategorias).catch(() => {});
  }, [esAdmin]);

  function manejarBusqueda(e) {
    e.preventDefault();
    cargarProductos(busqueda);
  }

  function abrirNuevo() {
    setFormulario(FORMULARIO_VACIO);
    setEditandoId(null);
    setImagenArchivo(null);
    setImagenPreview(null);
    setError('');
    setModalAbierto(true);
  }

  function abrirEdicion(p) {
    setFormulario({ ...p, categoria_id: p.categoria_id || '' });
    setEditandoId(p.id);
    setImagenArchivo(null);
    setImagenPreview(urlArchivo(p.imagen_url));
    setError('');
    setModalAbierto(true);
  }

  async function guardar(e) {
    e.preventDefault();
    setError('');
    try {
      const producto = editandoId
        ? await api.productos.actualizar(editandoId, formulario)
        : await api.productos.crear(formulario);
      if (imagenArchivo) await api.productos.subirImagen(producto.id, imagenArchivo);
      setModalAbierto(false);
      cargarProductos(busqueda);
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
    if (!confirm('¿Eliminar este producto del inventario?')) return;
    try {
      await api.productos.eliminar(id);
      cargarProductos(busqueda);
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="pagina">
      <header className="pagina-encabezado">
        <div>
          <h1>Inventario</h1>
          <p>{productos.length} producto{productos.length !== 1 ? 's' : ''} en cat&aacute;logo</p>
        </div>
        {esAdmin && (
          <div style={{ display: 'flex', gap: 10 }}>
            <ImportarExcel
              onImportar={(archivo) => api.productos.importar(archivo)}
              alTerminar={() => cargarProductos(busqueda)}
              columnas={['nombre', 'categoria', 'descripcion', 'precio', 'costo', 'stock_actual', 'stock_minimo', 'unidad_medida']}
            />
            <button className="boton-primario" onClick={abrirNuevo}>
              <Plus size={17} strokeWidth={2} /> Nuevo producto
            </button>
          </div>
        )}
      </header>

      <form className="barra-busqueda" onSubmit={manejarBusqueda}>
        <Search size={17} strokeWidth={1.75} />
        <input
          placeholder="Buscar por nombre o categoría…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </form>

      <div className="tabla-contenedor">
        {cargando ? (
          <p className="texto-vacio">Cargando…</p>
        ) : productos.length === 0 ? (
          <p className="texto-vacio">No hay productos registrados.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Imagen</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Stock físico</th>
                <th>Reservado</th>
                <th>Disponible</th>
                {esAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => (
                <tr key={p.id}>
                  <td>{p.imagen_url ? <img className="producto-miniatura" src={urlArchivo(p.imagen_url)} alt="" /> : <span className="producto-sin-imagen"><Package size={18} /></span>}</td>
                  <td>{p.nombre}</td>
                  <td className="texto-tenue">{p.categoria || '—'}</td>
                  <td>Q{Number(p.precio).toFixed(2)}</td>
                  <td>
                    <span className={p.stock_actual <= p.stock_minimo ? 'etiqueta-estado estado-cancelada' : ''}>
                      {p.stock_actual <= p.stock_minimo && <AlertTriangle size={12} strokeWidth={2} style={{ marginRight: 4, verticalAlign: -1 }} />}
                      {p.stock_actual} {p.unidad_medida}
                    </span>
                  </td>
                  <td>{p.stock_reservado || 0} {p.unidad_medida}</td>
                  <td><strong>{p.stock_actual - (p.stock_reservado || 0)} {p.unidad_medida}</strong></td>
                  {esAdmin && (
                    <td className="tabla-acciones">
                      <button onClick={() => abrirEdicion(p)} title="Editar"><Pencil size={16} strokeWidth={1.75} /></button>
                      <button onClick={() => eliminar(p.id)} title="Eliminar" className="boton-peligro">
                        <Trash2 size={16} strokeWidth={1.75} />
                      </button>
                    </td>
                  )}
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
              <h2>{editandoId ? 'Editar producto' : 'Nuevo producto'}</h2>
              <button className="modal-cerrar" onClick={() => setModalAbierto(false)}><X size={18} /></button>
            </div>
            <form onSubmit={guardar} className="formulario-grid">
              <label className="campo-ancho producto-imagen-campo">Imagen del producto
                <div className="producto-imagen-selector">
                  <div className="producto-imagen-preview">
                    {imagenPreview ? <img src={imagenPreview} alt="Vista previa del producto" /> : <ImagePlus size={28} />}
                  </div>
                  <div><input type="file" accept="image/jpeg,image/png,image/webp" onChange={seleccionarImagen} /><small>JPG, PNG o WEBP. Máximo 5 MB.</small></div>
                </div>
              </label>
              <label className="campo-ancho">Nombre *
                <input required value={formulario.nombre}
                  onChange={(e) => setFormulario({ ...formulario, nombre: e.target.value })} />
              </label>
              <label className="campo-ancho">Descripción
                <textarea rows={2} value={formulario.descripcion}
                  onChange={(e) => setFormulario({ ...formulario, descripcion: e.target.value })} />
              </label>
              <label>Categoría
                <select value={formulario.categoria_id || ''}
                  onChange={(e) => setFormulario({ ...formulario, categoria_id: e.target.value ? Number(e.target.value) : '' })}>
                  <option value="">Sin categoría</option>
                  {categorias.filter((c) => c.activo || c.id === formulario.categoria_id).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </label>
              <label>Unidad de medida
                <input placeholder="unidad, caja, ml…" value={formulario.unidad_medida}
                  onChange={(e) => setFormulario({ ...formulario, unidad_medida: e.target.value })} />
              </label>
              <label>Precio de venta (Q)
                <input type="number" min="0" step="0.01" value={formulario.precio}
                  onChange={(e) => setFormulario({ ...formulario, precio: Number(e.target.value) })} />
              </label>
              <label>Costo (Q)
                <input type="number" min="0" step="0.01" value={formulario.costo}
                  onChange={(e) => setFormulario({ ...formulario, costo: Number(e.target.value) })} />
              </label>
              <label>Stock actual
                <input type="number" min="0" value={formulario.stock_actual}
                  onChange={(e) => setFormulario({ ...formulario, stock_actual: Number(e.target.value) })} />
              </label>
              <label>Stock mínimo (alerta)
                <input type="number" min="0" value={formulario.stock_minimo}
                  onChange={(e) => setFormulario({ ...formulario, stock_minimo: Number(e.target.value) })} />
              </label>
              <label className="campo-checkbox">
                <input type="checkbox" checked={formulario.activo}
                  onChange={(e) => setFormulario({ ...formulario, activo: e.target.checked })} />
                Producto activo
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
