import { useEffect, useState } from 'react';
import { ShoppingCart, Plus, Minus, Trash2, X, CheckCircle2, CalendarDays, Package, Stethoscope, Instagram, MessageCircle, ArrowRight, ExternalLink, MapPin, Newspaper, Phone, ListFilter } from 'lucide-react';
import { api } from '../services/api';
import { APP_CONFIG } from '../config';
import { urlArchivo } from '../config';
import logoDorado from '../assets/brand/kmiss-logo-gold.png';

function ImagenCatalogo({ ruta, nombre, Icono = Package }) {
  const [fallo, setFallo] = useState(false);

  useEffect(() => setFallo(false), [ruta]);

  if (!ruta || fallo) {
    return <span className="catalogo-imagen-fallback"><Icono size={24} /><small>Imagen no disponible</small></span>;
  }

  return <img src={urlArchivo(ruta)} alt={nombre} onError={() => setFallo(true)} />;
}

export default function Tienda() {
  const [productos, setProductos] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [noticias, setNoticias] = useState([]);
  const [medicos, setMedicos] = useState([]);
  const [vista, setVista] = useState('productos');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('todas');
  const [cargando, setCargando] = useState(true);
  const [carrito, setCarrito] = useState([]); // [{ producto_id, nombre, precio, cantidad, stock_actual }]
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [checkoutAbierto, setCheckoutAbierto] = useState(false);
  const [confirmacion, setConfirmacion] = useState(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [citaAbierta, setCitaAbierta] = useState(false);
  const [citaConfirmacion, setCitaConfirmacion] = useState(null);
  const [servicioDetalle, setServicioDetalle] = useState(null);
  const [horarios, setHorarios] = useState([]);
  const [cargandoHorarios, setCargandoHorarios] = useState(false);
  const [datosCita, setDatosCita] = useState({ nit: '', nombre: '', telefono: '', email: '', sede_id: '', servicio_id: '', medico_id: '', fecha: '', hora: '', motivo_consulta: '' });

  const [datosCliente, setDatosCliente] = useState({
    nit: '', nombre_cliente: '', telefono: '', email: '', direccion_envio: '',
    metodo_pago_preferido: 'efectivo', notas: '',
  });

  useEffect(() => {
    Promise.all([api.tienda.productos(), api.tienda.servicios(), api.tienda.sedes(), api.tienda.noticias()])
      .then(([productosDatos, serviciosDatos, sedesDatos, noticiasDatos]) => { setProductos(productosDatos); setServicios(serviciosDatos); setSedes(sedesDatos); setNoticias(noticiasDatos); })
      .catch((err) => console.error(err))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    if (!datosCita.sede_id) { setMedicos([]); return; }
    setDatosCita((actual) => ({ ...actual, medico_id: '', hora: '' }));
    api.tienda.medicos(datosCita.sede_id).then(setMedicos).catch((err) => setError(err.message));
  }, [datosCita.sede_id]);

  useEffect(() => {
    if (!datosCita.sede_id || !datosCita.medico_id || !datosCita.servicio_id || !datosCita.fecha) { setHorarios([]); return; }
    setCargandoHorarios(true);
    setDatosCita((actual) => ({ ...actual, hora: '' }));
    api.tienda.disponibilidad(datosCita.medico_id, datosCita.sede_id, datosCita.servicio_id, datosCita.fecha)
      .then(setHorarios).catch((err) => setError(err.message)).finally(() => setCargandoHorarios(false));
  }, [datosCita.sede_id, datosCita.medico_id, datosCita.servicio_id, datosCita.fecha]);

  function reservarServicio(servicio) {
    setDatosCita((actual) => ({ ...actual, servicio_id: servicio.id, hora: '' }));
    setError('');
    setCitaAbierta(true);
  }

  async function solicitarCita(e) {
    e.preventDefault();
    setEnviando(true); setError('');
    try {
      const respuesta = await api.tienda.solicitarCita(datosCita);
      setCitaConfirmacion(respuesta);
      setCitaAbierta(false);
      setDatosCita({ nit: '', nombre: '', telefono: '', email: '', sede_id: '', servicio_id: '', medico_id: '', fecha: '', hora: '', motivo_consulta: '' });
    } catch (err) { setError(err.message); } finally { setEnviando(false); }
  }

  function agregarAlCarrito(producto) {
    setCarrito((prev) => {
      const existente = prev.find((i) => i.producto_id === producto.id);
      if (existente) {
        if (existente.cantidad >= producto.stock_actual) return prev;
        return prev.map((i) => i.producto_id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      }
      return [...prev, { producto_id: producto.id, nombre: producto.nombre, precio: Number(producto.precio_final ?? producto.precio), cantidad: 1, stock_actual: producto.stock_actual }];
    });
    setCarritoAbierto(true);
  }

  function cambiarCantidad(producto_id, delta) {
    setCarrito((prev) => prev
      .map((i) => i.producto_id === producto_id ? { ...i, cantidad: Math.min(i.stock_actual, Math.max(1, i.cantidad + delta)) } : i)
    );
  }

  function quitarDelCarrito(producto_id) {
    setCarrito((prev) => prev.filter((i) => i.producto_id !== producto_id));
  }

  const totalCarrito = carrito.reduce((acc, i) => acc + i.cantidad * i.precio, 0);
  const cantidadTotal = carrito.reduce((acc, i) => acc + i.cantidad, 0);
  const nombreCategoria = (producto) => producto.categoria?.trim() || 'Sin categoría';
  const categoriasProductos = [...new Set(productos.map(nombreCategoria))];
  const gruposProductos = categoriasProductos
    .filter((categoria) => categoriaSeleccionada === 'todas' || categoria === categoriaSeleccionada)
    .map((categoria) => ({
      categoria,
      productos: productos.filter((producto) => nombreCategoria(producto) === categoria),
    }));

  async function confirmarPedido(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const respuesta = await api.tienda.crearPedido({
        ...datosCliente,
        items: carrito.map((i) => ({ producto_id: i.producto_id, cantidad: i.cantidad })),
      });
      setConfirmacion(respuesta);
      setCarrito([]);
      setCheckoutAbierto(false);
      setCarritoAbierto(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

    function mostrarCargaCatalogo() {
    return (<p className="texto-vacio">Cargando catálogo…</p>);
  }

  function mostrarServicios() {
    return (<section className="tienda-servicios-publicos">
            <div className="tienda-seccion-titulo"><div><h2>Servicios de K-MISS</h2><p>Selecciona un tratamiento para consultar horarios y solicitar tu cita.</p></div></div>
            {servicios.length === 0 ? <p className="texto-vacio">No hay servicios disponibles por el momento.</p> : <div className="tienda-grid">
              {servicios.map((servicio) => <article key={servicio.id} className="tienda-tarjeta servicio-publico" tabIndex="0">
                <button className="servicio-publico-imagen" onClick={() => setServicioDetalle(servicio)} aria-label={`Ver detalles de ${servicio.nombre}`}><ImagenCatalogo ruta={servicio.imagen_url} nombre={servicio.nombre} Icono={Stethoscope} /></button>
                <div className="tienda-tarjeta-info"><h3>{servicio.nombre}</h3>{servicio.especialidad && <span className="texto-tenue">{servicio.especialidad}</span>}<p className="tienda-tarjeta-descripcion">{servicio.descripcion}</p></div>
                <div className="tienda-tarjeta-footer"><div><span className="precio">Q{Number(servicio.precio).toFixed(2)}</span><small>{servicio.duracion_minutos} min</small></div><div className="servicio-publico-acciones"><button className="boton-secundario" onClick={() => setServicioDetalle(servicio)}>Detalles</button><button className="boton-primario" onClick={() => reservarServicio(servicio)}><CalendarDays size={15} /> Reservar</button></div></div>
                <div className="servicio-hover-detalle" role="tooltip"><strong>{servicio.nombre}</strong><p>{servicio.descripcion || 'Este servicio no tiene una descripción registrada todavía.'}</p><span>{servicio.especialidad || 'Servicio de K-MISS'} · {servicio.duracion_minutos} min</span></div>
              </article>)}
            </div>}
          </section>);
  }

  function mostrarSedes() {
    return (<section className="tienda-sedes-publicas">
            <div className="tienda-seccion-titulo"><div><h2>Encuéntranos</h2><p>Conoce nuestros establecimientos y elige el más conveniente para tu cita.</p></div></div>
            {sedes.length === 0 ? <p className="texto-vacio">Próximamente publicaremos nuestras ubicaciones.</p> : <div className="sedes-publicas-grid">{sedes.map((sede) => <article className="sede-publica" key={sede.id}>
              <div className="sede-publica-icono"><MapPin size={22} /></div><div><h3>{sede.nombre}</h3><p>{sede.direccion}</p>{sede.telefono && <a href={`tel:${sede.telefono}`}><Phone size={15} /> {sede.telefono}</a>}</div>
              <a className="boton-secundario" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sede.direccion)}`} target="_blank" rel="noreferrer"><MapPin size={15} /> Ver en mapa</a>
            </article>)}</div>}
          </section>);
  }

  function mostrarNoticias() {
    return (<section className="tienda-noticias-publicas">
            <div className="tienda-seccion-titulo"><div><h2>Noticias y actividades</h2><p>Conferencias, eventos y novedades de K-MISS Medicina Estética.</p></div></div>
            {noticias.length === 0 ? <p className="texto-vacio">No hay noticias publicadas por el momento.</p> : <div className="noticias-publicas-grid">{noticias.map((noticia) => <article className="noticia-publica" key={noticia.id}>
              <div className="noticia-publica-imagen">{noticia.imagen_url ? <img src={urlArchivo(noticia.imagen_url)} alt={noticia.titulo} /> : <Newspaper size={30} />}</div>
              <div className="noticia-publica-contenido">{noticia.fecha_evento && <time dateTime={String(noticia.fecha_evento).slice(0,10)}>{new Date(`${String(noticia.fecha_evento).slice(0,10)}T12:00:00`).toLocaleDateString('es-GT',{day:'numeric',month:'long',year:'numeric'})}</time>}<h3>{noticia.titulo}</h3>{noticia.resumen && <p className="noticia-resumen">{noticia.resumen}</p>}{noticia.contenido && <p>{noticia.contenido}</p>}{noticia.enlace_url && <a href={noticia.enlace_url} target="_blank" rel="noreferrer">Más información <ExternalLink size={14} /></a>}</div>
            </article>)}</div>}
          </section>);
  }

  function mostrarCatalogoVacio() {
    return (<p className="texto-vacio">No hay productos disponibles por el momento.</p>);
  }

  function mostrarProductos() {
    return (<section className="tienda-seccion">
              <div className="tienda-seccion-titulo"><div><h2>Productos K-Skin</h2><p>Explora el catálogo por categoría y encuentra lo que necesitas.</p></div></div>
              <div className="productos-filtros" aria-label="Filtrar productos por categoría">
                <span><ListFilter size={16} /> Categorías</span>
                <div className="productos-filtros-opciones">
                  <button className={categoriaSeleccionada === 'todas' ? 'activo' : ''} onClick={() => setCategoriaSeleccionada('todas')}>Todos <small>{productos.length}</small></button>
                  {categoriasProductos.map((categoria) => {
                    const cantidad = productos.filter((producto) => nombreCategoria(producto) === categoria).length;
                    return <button key={categoria} className={categoriaSeleccionada === categoria ? 'activo' : ''} onClick={() => setCategoriaSeleccionada(categoria)}>{categoria} <small>{cantidad}</small></button>;
                  })}
                </div>
              </div>
              <div className="productos-categorias">
                {gruposProductos.map((grupo) => <section className="productos-categoria" key={grupo.categoria}>
                  <div className="productos-categoria-encabezado"><h3>{grupo.categoria}</h3><span>{grupo.productos.length} {grupo.productos.length === 1 ? 'producto' : 'productos'}</span></div>
                  <div className="tienda-grid">
                    {grupo.productos.map((p) => {
                      const enCarrito = carrito.find((i) => i.producto_id === p.id);
                      const agotandoStock = p.stock_actual <= 5;
                      return (
                        <article key={p.id} className="tienda-tarjeta producto-publico" tabIndex="0">
                          <div className="tienda-tarjeta-imagen">
                            <ImagenCatalogo ruta={p.imagen_url} nombre={p.nombre} />
                          </div>
                          <div className="tienda-tarjeta-info">
                            <h3>{p.nombre}</h3>
                            {p.descripcion && <p className="tienda-tarjeta-descripcion">{p.descripcion}</p>}
                            <div className="producto-etiquetas">{p.descuento_porcentaje && <span className="etiqueta oferta">-{Number(p.descuento_porcentaje).toFixed(0)}%</span>}{agotandoStock && <span className="etiqueta">Últimas unidades</span>}</div>
                          </div>
                          <div className="tienda-tarjeta-footer">
                            <div className="producto-precios">{p.descuento_porcentaje && <span className="precio-anterior">Q{Number(p.precio).toFixed(2)}</span>}<span className="precio">Q{Number(p.precio_final ?? p.precio).toFixed(2)}</span></div>
                            <button
                              className="boton-primario"
                              disabled={enCarrito && enCarrito.cantidad >= p.stock_actual}
                              onClick={() => agregarAlCarrito(p)}
                            >
                              <Plus size={15} strokeWidth={2} /> {enCarrito ? `En carrito (${enCarrito.cantidad})` : 'Agregar'}
                            </button>
                          </div>
                          <div className="producto-hover-detalle" role="tooltip"><strong>{p.nombre}</strong><p>{p.descripcion || 'Este artículo no tiene detalles registrados todavía.'}</p><span>{nombreCategoria(p)} · Disponible: {p.stock_actual}</span></div>
                        </article>
                      );
                    })}
                  </div>
                </section>)}
              </div>
            </section>);
  }

  function mostrarCatalogo() {
    if (cargando) return mostrarCargaCatalogo();
    if (vista === 'servicios') return mostrarServicios();
    if (vista === 'sedes') return mostrarSedes();
    if (vista === 'noticias') return mostrarNoticias();
    if (productos.length === 0) return mostrarCatalogoVacio();
    return mostrarProductos();
  }

  function mostrarServicioDetalle() {
    return (servicioDetalle && <div className="modal-fondo" onClick={() => setServicioDetalle(null)}><div className="modal servicio-detalle-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-encabezado"><h2>{servicioDetalle.nombre}</h2><button className="modal-cerrar" onClick={() => setServicioDetalle(null)}><X size={18} /></button></div>
        <div className="servicio-detalle-imagen"><ImagenCatalogo ruta={servicioDetalle.imagen_url} nombre={servicioDetalle.nombre} Icono={Stethoscope} /></div>
        {servicioDetalle.especialidad && <span className="etiqueta">{servicioDetalle.especialidad}</span>}
        <p className="servicio-detalle-descripcion">{servicioDetalle.descripcion || 'Próximamente agregaremos más información sobre este servicio.'}</p>
        <div className="servicio-detalle-datos"><div><span>Duración</span><strong>{servicioDetalle.duracion_minutos} minutos</strong></div><div><span>Precio</span><strong>Q{Number(servicioDetalle.precio).toFixed(2)}</strong></div></div>
        <div className="modal-acciones"><button className="boton-secundario" onClick={() => setServicioDetalle(null)}>Cerrar</button><button className="boton-primario" onClick={() => { setServicioDetalle(null); reservarServicio(servicioDetalle); }}><CalendarDays size={16} /> Reservar cita</button></div>
      </div></div>);
  }

  function mostrarCitaAbierta() {
    return (citaAbierta && <div className="modal-fondo" onClick={() => setCitaAbierta(false)}><div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-encabezado"><h2>Solicitar cita</h2><button className="modal-cerrar" onClick={() => setCitaAbierta(false)}><X size={18} /></button></div>
        <form className="formulario-grid" onSubmit={solicitarCita}>
          <label className="campo-ancho">Establecimiento *<select required value={datosCita.sede_id} onChange={(e) => setDatosCita({ ...datosCita, sede_id: Number(e.target.value) })}><option value="">Selecciona una sede</option>{sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre} · {s.direccion}</option>)}</select></label>
          <label className="campo-ancho">Servicio *<select required value={datosCita.servicio_id} onChange={(e) => setDatosCita({ ...datosCita, servicio_id: Number(e.target.value) })}><option value="">Selecciona un servicio</option>{servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre} · {s.duracion_minutos} min</option>)}</select></label>
          <label className="campo-ancho">Médico *<select required disabled={!datosCita.sede_id} value={datosCita.medico_id} onChange={(e) => setDatosCita({ ...datosCita, medico_id: Number(e.target.value) })}><option value="">Selecciona un médico</option>{medicos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></label>
          <label>Fecha *<input type="date" required min={new Date().toISOString().split('T')[0]} value={datosCita.fecha} onChange={(e) => setDatosCita({ ...datosCita, fecha: e.target.value })} /></label>
          <label>Horario disponible *<select required disabled={!datosCita.fecha || cargandoHorarios} value={datosCita.hora} onChange={(e) => setDatosCita({ ...datosCita, hora: e.target.value })}><option value="">{cargandoHorarios ? 'Consultando…' : horarios.length ? 'Selecciona una hora' : 'No hay horarios disponibles'}</option>{horarios.map((h) => <option key={h} value={h}>{h}</option>)}</select></label>
          <div className="campo-ancho separador-formulario">Datos de contacto</div>
          <label className="campo-ancho">Nombre completo *<input required value={datosCita.nombre} onChange={(e) => setDatosCita({ ...datosCita, nombre: e.target.value })} /></label>
          <label>NIT *<input required inputMode="text" value={datosCita.nit} onChange={(e) => setDatosCita({ ...datosCita, nit: e.target.value })} /></label>
          <label>Teléfono / WhatsApp *<input type="tel" required value={datosCita.telefono} onChange={(e) => setDatosCita({ ...datosCita, telefono: e.target.value })} /></label>
          <label>Correo electrónico<input type="email" value={datosCita.email} onChange={(e) => setDatosCita({ ...datosCita, email: e.target.value })} /></label>
          <label className="campo-ancho">Comentario<textarea rows={2} value={datosCita.motivo_consulta} onChange={(e) => setDatosCita({ ...datosCita, motivo_consulta: e.target.value })} /></label>
          <p className="campo-ancho texto-tenue">La solicitud quedará pendiente. Recepción se comunicará contigo para confirmarla.</p>
          {error && <p className="login-error campo-ancho">{error}</p>}
          <div className="modal-acciones campo-ancho"><button type="button" className="boton-secundario" onClick={() => setCitaAbierta(false)}>Cancelar</button><button className="boton-primario" disabled={enviando || !datosCita.hora}>{enviando ? 'Enviando…' : 'Solicitar cita'}</button></div>
        </form>
      </div></div>);
  }

  function mostrarCitaConfirmacion() {
    return (citaConfirmacion && <div className="modal-fondo" onClick={() => setCitaConfirmacion(null)}><div className="modal confirmacion-cita" onClick={(e) => e.stopPropagation()}><CheckCircle2 size={42} /><h2>Solicitud recibida</h2><p>Tu solicitud #{citaConfirmacion.id} fue registrada. Recepción verificará los datos y se comunicará contigo para confirmar la cita.</p><button className="boton-primario" onClick={() => setCitaConfirmacion(null)}>Entendido</button></div></div>);
  }

  function mostrarCarritoAbierto() {
    return (carritoAbierto && (
        <div className="modal-fondo" onClick={() => setCarritoAbierto(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-encabezado">
              <h2>Tu carrito</h2>
              <button className="modal-cerrar" onClick={() => setCarritoAbierto(false)}><X size={18} /></button>
            </div>

            {carrito.length === 0 ? (
              <p className="texto-vacio">Tu carrito está vacío.</p>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                  {carrito.map((i) => (
                    <div key={i.producto_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{i.nombre}</p>
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>Q{i.precio.toFixed(2)} c/u</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button className="boton-secundario" style={{ padding: 6 }} onClick={() => cambiarCantidad(i.producto_id, -1)}><Minus size={13} /></button>
                        <span style={{ minWidth: 20, textAlign: 'center', fontFamily: 'var(--fuente-datos)' }}>{i.cantidad}</span>
                        <button className="boton-secundario" style={{ padding: 6 }} onClick={() => cambiarCantidad(i.producto_id, 1)}><Plus size={13} /></button>
                        <button className="boton-peligro" style={{ background: 'none', border: 'none', padding: 6, borderRadius: 6 }} onClick={() => quitarDelCarrito(i.producto_id)}><Trash2 size={15} /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', borderTop: '1px solid var(--color-border)' }}>
                  <span style={{ fontWeight: 600, fontFamily: 'var(--fuente-display)', color: 'var(--color-primary)' }}>Total</span>
                  <span style={{ fontFamily: 'var(--fuente-datos)', fontWeight: 600, fontSize: 18, color: 'var(--color-primary)' }}>Q{totalCarrito.toFixed(2)}</span>
                </div>
                <div className="modal-acciones">
                  <button className="boton-secundario" onClick={() => setCarritoAbierto(false)}>Seguir comprando</button>
                  <button className="boton-primario" onClick={() => { setCarritoAbierto(false); setCheckoutAbierto(true); }}>Continuar al pedido</button>
                </div>
              </>
            )}
          </div>
        </div>
      ));
  }

  function mostrarCheckoutAbierto() {
    return (checkoutAbierto && (
        <div className="modal-fondo" onClick={() => setCheckoutAbierto(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-encabezado">
              <h2>Completa tu pedido</h2>
              <button className="modal-cerrar" onClick={() => setCheckoutAbierto(false)}><X size={18} /></button>
            </div>
            <form onSubmit={confirmarPedido} className="formulario-grid">
              <label className="campo-ancho">Nombre completo *
                <input required value={datosCliente.nombre_cliente}
                  onChange={(e) => setDatosCliente({ ...datosCliente, nombre_cliente: e.target.value })} />
              </label>
              <label>NIT *
                <input required inputMode="text" value={datosCliente.nit}
                  onChange={(e) => setDatosCliente({ ...datosCliente, nit: e.target.value })} />
              </label>
              <label>Teléfono *
                <input required value={datosCliente.telefono}
                  onChange={(e) => setDatosCliente({ ...datosCliente, telefono: e.target.value })} />
              </label>
              <label>Email (opcional)
                <input type="email" value={datosCliente.email}
                  onChange={(e) => setDatosCliente({ ...datosCliente, email: e.target.value })} />
              </label>
              <label className="campo-ancho">Dirección de envío *
                <input required value={datosCliente.direccion_envio}
                  onChange={(e) => setDatosCliente({ ...datosCliente, direccion_envio: e.target.value })} />
              </label>
              <label className="campo-ancho">Método de pago preferido *
                <select value={datosCliente.metodo_pago_preferido}
                  onChange={(e) => setDatosCliente({ ...datosCliente, metodo_pago_preferido: e.target.value })}>
                  <option value="efectivo">Efectivo contra entrega</option>
                  <option value="transferencia">Transferencia bancaria</option>
                </select>
              </label>
              <label className="campo-ancho">Notas para tu pedido (opcional)
                <textarea rows={2} value={datosCliente.notas}
                  onChange={(e) => setDatosCliente({ ...datosCliente, notas: e.target.value })} />
              </label>

              <div className="campo-ancho" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--color-border)' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>Total del pedido</span>
                <span style={{ fontFamily: 'var(--fuente-datos)', fontWeight: 600 }}>Q{totalCarrito.toFixed(2)}</span>
              </div>

              <p className="campo-ancho texto-tenue" style={{ fontSize: 13 }}>
                Tu pedido quedará pendiente de confirmación. Nuestro equipo te contactará para coordinar el pago y la entrega.
              </p>

              {error && <p className="login-error campo-ancho">{error}</p>}

              <div className="modal-acciones campo-ancho">
                <button type="button" className="boton-secundario" onClick={() => setCheckoutAbierto(false)}>Cancelar</button>
                <button type="submit" className="boton-primario" disabled={enviando}>
                  {enviando ? 'Enviando…' : 'Confirmar pedido'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ));
  }

  function mostrarConfirmacion() {
    return (confirmacion && (
        <div className="modal-fondo" onClick={() => setConfirmacion(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400, textAlign: 'center' }}>
            <CheckCircle2 size={40} strokeWidth={1.5} color="var(--color-success)" style={{ margin: '8px auto' }} />
            <h2 style={{ marginBottom: 8 }}>¡Pedido recibido!</h2>
            <p className="texto-tenue" style={{ marginBottom: 4 }}>Tu pedido #{confirmacion.id} quedó registrado y los productos están reservados.</p>
            <p className="texto-tenue" style={{ marginBottom: 20 }}>Te contactaremos por WhatsApp para coordinar el pago. La reserva vence en 24 horas.</p>
            <button className="boton-primario" style={{ margin: '0 auto' }} onClick={() => setConfirmacion(null)}>Entendido</button>
          </div>
        </div>
      ));
  }

  return (
    <div className="tienda-pagina">
      <header className="tienda-header">
        <div className="tienda-marca">
          <img className="tienda-logo" src={logoDorado} alt={`${APP_CONFIG.nombreEmpresa} - ${APP_CONFIG.eslogan}`} />
        </div>
        <div className="tienda-tabs" role="tablist">
          <button className={vista === 'productos' ? 'activo' : ''} onClick={() => setVista('productos')}><Package size={16} /> Productos</button>
          <button className={vista === 'servicios' ? 'activo' : ''} onClick={() => setVista('servicios')}><Stethoscope size={16} /> Servicios y citas</button>
          <button className={vista === 'sedes' ? 'activo' : ''} onClick={() => setVista('sedes')}><MapPin size={16} /> Encuéntranos</button>
          <button className={vista === 'noticias' ? 'activo' : ''} onClick={() => setVista('noticias')}><Newspaper size={16} /> Noticias</button>
        </div>
        <div className="tienda-header-acciones">
          <a className="tienda-social-boton" href={APP_CONFIG.instagramUrl} target="_blank" rel="noreferrer" title={`Instagram ${APP_CONFIG.instagramUsuario}`}><Instagram size={18} /></a>
          <button className="tienda-carrito-boton" onClick={() => setCarritoAbierto(true)} title="Ver carrito"><ShoppingCart size={19} strokeWidth={1.75} />{cantidadTotal > 0 && <span className="tienda-carrito-contador">{cantidadTotal}</span>}</button>
        </div>
      </header>

      <section className="tienda-presentacion">
        <div className="tienda-presentacion-interior">
          <p className="tienda-eyebrow">Dra. Karen Miss Retana</p>
          <h1>Medicina estética avanzada</h1>
          <p className="tienda-presentacion-texto">Tratamientos personalizados para acompañar una versión más segura y auténtica de ti.</p>
          <p className="tienda-tratamientos">Sculptra <span>·</span> Botox <span>·</span> Radiesse <span>·</span> K-Skin</p>
          <div className="tienda-presentacion-acciones">
            <button className="boton-primario" onClick={() => setVista('servicios')}><CalendarDays size={17} /> Reservar cita</button>
            <a href={APP_CONFIG.instagramUrl} target="_blank" rel="noreferrer"><Instagram size={17} /> Ver Instagram <ArrowRight size={15} /></a>
          </div>
        </div>
      </section>

      <main className="tienda-contenido">
        {mostrarCatalogo()}
      </main>

      {mostrarServicioDetalle()}

      <footer className="tienda-footer">
        <img className="tienda-footer-logo" src={logoDorado} alt="K-MISS Medicina Estética Avanzada" />
        <nav><a href={APP_CONFIG.instagramUrl} target="_blank" rel="noreferrer"><Instagram size={17} /> {APP_CONFIG.instagramUsuario}</a><a href={`https://wa.me/${APP_CONFIG.whatsapp}`} target="_blank" rel="noreferrer"><MessageCircle size={17} /> WhatsApp 5578-4833</a></nav>
      </footer>

      {mostrarCitaAbierta()}

      {mostrarCitaConfirmacion()}

      {mostrarCarritoAbierto()}

      {mostrarCheckoutAbierto()}

      {mostrarConfirmacion()}
    </div>
  );
}
