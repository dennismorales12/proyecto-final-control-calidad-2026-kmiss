import { useEffect, useState } from 'react';
import { ImagePlus, Package, Pencil, Plus, Search, Tags, Trash2, X } from 'lucide-react';
import { api } from '../services/api';
import { urlArchivo } from '../config';

const VACIO = { nombre: '', orden: 0, activo: true };
const HOY = new Date().toISOString().split('T')[0];
const PROMO_VACIA = { alcance: 'producto', producto_id: '', categoria_id: '', descuento_porcentaje: 10, fecha_inicio: HOY, fecha_fin: '', activo: true };
const SEDE_VACIA = { nombre: '', direccion: '', telefono: '', activo: true };
const BLOQUEO_VACIO = { medico_id: '', sede_id: '', fecha: HOY, hora_inicio: '12:00', hora_fin: '13:00', motivo: 'Almuerzo' };
const NOTICIA_VACIA = { titulo: '', resumen: '', contenido: '', fecha_evento: '', enlace_url: '', activo: true };
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
function semanaPredeterminada() {
  return Object.fromEntries(Array.from({length:7},(_,dia)=>[dia,dia===0 ? [] : [{inicio:'08:00',fin:'12:00'},{inicio:'13:00',fin:'17:00'}]]));
}
function horarioVacio() { return { medico_id: '', sede_id: '', semana: semanaPredeterminada(), activo: true }; }

export default function Ajustes() {
  const [categorias, setCategorias] = useState([]);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formulario, setFormulario] = useState(VACIO);
  const [error, setError] = useState('');
  const [promociones, setPromociones] = useState([]);
  const [productos, setProductos] = useState([]);
  const [modalPromo, setModalPromo] = useState(false);
  const [promoEditando, setPromoEditando] = useState(null);
  const [promoFormulario, setPromoFormulario] = useState(PROMO_VACIA);
  const [promoBusqueda, setPromoBusqueda] = useState('');
  const [promoBuscando, setPromoBuscando] = useState(false);
  const [promoResultadosAbiertos, setPromoResultadosAbiertos] = useState(false);
  const [sedes, setSedes] = useState([]);
  const [medicos, setMedicos] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [bloqueos, setBloqueos] = useState([]);
  const [modalSede, setModalSede] = useState(false);
  const [sedeEditando, setSedeEditando] = useState(null);
  const [sedeFormulario, setSedeFormulario] = useState(SEDE_VACIA);
  const [modalHorario, setModalHorario] = useState(false);
  const [horarioEditando, setHorarioEditando] = useState(null);
  const [horarioFormulario, setHorarioFormulario] = useState(horarioVacio());
  const [modalBloqueo, setModalBloqueo] = useState(false);
  const [bloqueoFormulario, setBloqueoFormulario] = useState(BLOQUEO_VACIO);
  const [noticias, setNoticias] = useState([]);
  const [modalNoticia, setModalNoticia] = useState(false);
  const [noticiaEditando, setNoticiaEditando] = useState(null);
  const [noticiaFormulario, setNoticiaFormulario] = useState(NOTICIA_VACIA);
  const [noticiaImagen, setNoticiaImagen] = useState(null);
  const [noticiaPreview, setNoticiaPreview] = useState(null);

  async function cargar() {
    try {
      const [categoriasDatos, promocionesDatos, sedesDatos, medicosDatos, horariosDatos, bloqueosDatos, noticiasDatos] = await Promise.all([
        api.ajustes.categorias.listar(), api.ajustes.promociones.listar(), api.ajustes.sedes.listar(), api.citas.medicos(), api.ajustes.horarios.listar(), api.ajustes.bloqueos.listar(), api.ajustes.noticias.listar(),
      ]);
      setCategorias(categoriasDatos); setPromociones(promocionesDatos);
      setSedes(sedesDatos); setMedicos(medicosDatos); setHorarios(horariosDatos); setBloqueos(bloqueosDatos);
      setNoticias(noticiasDatos);
    } catch (err) { setError(err.message); }
  }
  useEffect(() => { cargar(); }, []);

  useEffect(() => {
    if (!modalPromo || promoFormulario.alcance !== 'producto') return undefined;
    if (promoFormulario.producto_id) {
      setPromoBuscando(false); setPromoResultadosAbiertos(false);
      return undefined;
    }
    const termino = promoBusqueda.trim();
    if (termino.length < 2) {
      setProductos([]); setPromoBuscando(false); setPromoResultadosAbiertos(false);
      return undefined;
    }

    let vigente = true;
    setPromoBuscando(true);
    const espera = setTimeout(() => {
      api.productos.buscar(termino, 8)
        .then((datos) => {
          if (!vigente) return;
          setProductos(datos);
          setPromoResultadosAbiertos(true);
        })
        .catch((err) => { if (vigente) setError(err.message); })
        .finally(() => { if (vigente) setPromoBuscando(false); });
    }, 250);

    return () => { vigente = false; clearTimeout(espera); };
  }, [modalPromo, promoBusqueda, promoFormulario.alcance, promoFormulario.producto_id]);

  function abrir(categoria = null) {
    setEditando(categoria?.id || null);
    setFormulario(categoria ? { nombre: categoria.nombre, orden: categoria.orden, activo: categoria.activo } : VACIO);
    setError('');
    setModal(true);
  }

  async function guardar(e) {
    e.preventDefault();
    try {
      if (editando) await api.ajustes.categorias.actualizar(editando, formulario);
      else await api.ajustes.categorias.crear(formulario);
      setModal(false);
      cargar();
    } catch (err) { setError(err.message); }
  }

  async function cambiarActivo(categoria) {
    try {
      await api.ajustes.categorias.actualizar(categoria.id, { ...categoria, activo: !categoria.activo });
      cargar();
    } catch (err) { setError(err.message); }
  }

  async function eliminarCategoria(categoria) {
    if (!window.confirm(`¿Eliminar la categoria "${categoria.nombre}"?`)) return;
    try { await api.ajustes.categorias.eliminar(categoria.id); setError(''); cargar(); }
    catch (err) { setError(err.message); }
  }

  function abrirPromocion(promocion = null) {
    setPromoEditando(promocion?.id || null);
    setPromoFormulario(promocion ? {
      alcance: promocion.categoria_id ? 'categoria' : 'producto',
      producto_id: promocion.producto_id || '',
      categoria_id: promocion.categoria_id || '',
      descuento_porcentaje: Number(promocion.descuento_porcentaje),
      fecha_inicio: String(promocion.fecha_inicio).slice(0, 10),
      fecha_fin: promocion.fecha_fin ? String(promocion.fecha_fin).slice(0, 10) : '',
      activo: promocion.activo,
    } : { ...PROMO_VACIA });
    setPromoBusqueda(promocion?.producto_nombre || '');
    setProductos([]); setPromoBuscando(false); setPromoResultadosAbiertos(false);
    setError(''); setModalPromo(true);
  }

  function cambiarAlcancePromocion(alcance) {
    setPromoFormulario((actual) => ({ ...actual, alcance, producto_id: '', categoria_id: '' }));
    setPromoBusqueda(''); setProductos([]); setPromoResultadosAbiertos(false); setError('');
  }

  function seleccionarProductoPromocion(producto) {
    setPromoFormulario((actual) => ({ ...actual, producto_id: producto.id, categoria_id: '' }));
    setPromoBusqueda(producto.nombre); setPromoResultadosAbiertos(false);
  }

  function nombreObjetivoPromocion(promocion) {
    return promocion.categoria_nombre || promocion.producto_nombre || 'Promoción';
  }

  async function guardarPromocion(e) {
    e.preventDefault();
    try {
      if (promoEditando) await api.ajustes.promociones.actualizar(promoEditando, promoFormulario);
      else await api.ajustes.promociones.crear(promoFormulario);
      setModalPromo(false); cargar();
    } catch (err) { setError(err.message); }
  }

  async function alternarPromocion(promocion) {
    try {
      await api.ajustes.promociones.actualizar(promocion.id, { ...promocion, activo: !promocion.activo });
      cargar();
    } catch (err) { setError(err.message); }
  }

  async function eliminarPromocion(promocion) {
    if (!window.confirm(`¿Eliminar la promoción de "${nombreObjetivoPromocion(promocion)}"?`)) return;
    try { await api.ajustes.promociones.eliminar(promocion.id); setError(''); cargar(); }
    catch (err) { setError(err.message); }
  }

  function abrirSede(sede = null) {
    setSedeEditando(sede?.id || null); setSedeFormulario(sede ? { nombre: sede.nombre, direccion: sede.direccion, telefono: sede.telefono || '', activo: sede.activo } : SEDE_VACIA); setError(''); setModalSede(true);
  }
  async function guardarSede(e) {
    e.preventDefault();
    try { if (sedeEditando) await api.ajustes.sedes.actualizar(sedeEditando, sedeFormulario); else await api.ajustes.sedes.crear(sedeFormulario); setModalSede(false); cargar(); }
    catch (err) { setError(err.message); }
  }
  async function alternarSede(sede) {
    try { await api.ajustes.sedes.actualizar(sede.id, { ...sede, activo: !sede.activo }); cargar(); } catch (err) { setError(err.message); }
  }
  async function eliminarSede(sede) {
    if (!window.confirm(`¿Eliminar la sede "${sede.nombre}"? Sus horarios y bloqueos tambien se eliminaran.`)) return;
    try { await api.ajustes.sedes.eliminar(sede.id); setError(''); cargar(); }
    catch (err) { setError(err.message); }
  }
  function abrirHorario(horario = null) {
    setHorarioEditando(horario?.id || null);
    setHorarioFormulario(horario ? { medico_id: horario.medico_id, sede_id: horario.sede_id, semana: horario.semana, activo: horario.activo } : horarioVacio());
    setError(''); setModalHorario(true);
  }
  function alternarDiaHorario(dia, activo) {
    setHorarioFormulario((actual) => ({...actual,semana:{...actual.semana,[dia]:activo ? [{inicio:'08:00',fin:'12:00'},{inicio:'13:00',fin:'17:00'}] : []}}));
  }
  function alternarSegundoBloque(dia, activo) {
    setHorarioFormulario((actual) => { const bloques=[...(actual.semana[dia]||[])]; return {...actual,semana:{...actual.semana,[dia]:activo ? [bloques[0]||{inicio:'08:00',fin:'12:00'}, {inicio:'13:00',fin:'17:00'}] : bloques.slice(0,1)}}; });
  }
  function cambiarBloque(dia, indice, campo, valor) {
    setHorarioFormulario((actual) => { const bloques=(actual.semana[dia]||[]).map((b)=>({...b})); bloques[indice][campo]=valor; return {...actual,semana:{...actual.semana,[dia]:bloques}}; });
  }
  async function guardarHorario(e) {
    e.preventDefault();
    try { if (horarioEditando) await api.ajustes.horarios.actualizar(horarioEditando, horarioFormulario); else await api.ajustes.horarios.crear(horarioFormulario); setModalHorario(false); setHorarioFormulario(horarioVacio()); cargar(); }
    catch (err) { setError(err.message); }
  }
  async function eliminarHorario(id) {
    if (!window.confirm('¿Eliminar todo el horario semanal de este médico en la sede?')) return;
    try { await api.ajustes.horarios.eliminar(id); cargar(); } catch (err) { setError(err.message); }
  }
  function diasHorario(semana) {
    return [1,2,3,4,5,6,0].filter((dia)=>(semana?.[dia]||[]).length).map((dia)=>DIAS_CORTOS[dia]).join(', ') || 'Sin días';
  }
  function resumenHorario(semana) {
    const firmas=[...new Set([1,2,3,4,5,6,0].flatMap((dia)=>(semana?.[dia]||[]).length ? [(semana[dia]||[]).map((b)=>`${b.inicio}-${b.fin}`).join(' / ')] : []))];
    return firmas.length===1 ? firmas[0] : firmas.length ? 'Horario variable' : 'Sin turnos';
  }
  async function guardarBloqueo(e) {
    e.preventDefault();
    try { await api.ajustes.bloqueos.crear(bloqueoFormulario); setModalBloqueo(false); setBloqueoFormulario(BLOQUEO_VACIO); cargar(); }
    catch (err) { setError(err.message); }
  }
  async function eliminarBloqueo(id) {
    if (!window.confirm('¿Eliminar este bloqueo de agenda?')) return;
    try { await api.ajustes.bloqueos.eliminar(id); cargar(); } catch (err) { setError(err.message); }
  }
  function abrirNoticia(noticia = null) {
    setNoticiaEditando(noticia?.id || null);
    setNoticiaFormulario(noticia ? {
      titulo: noticia.titulo, resumen: noticia.resumen || '', contenido: noticia.contenido || '',
      fecha_evento: noticia.fecha_evento ? String(noticia.fecha_evento).slice(0,10) : '',
      enlace_url: noticia.enlace_url || '', activo: noticia.activo,
    } : NOTICIA_VACIA);
    setNoticiaImagen(null); setNoticiaPreview(noticia?.imagen_url ? urlArchivo(noticia.imagen_url) : null); setError(''); setModalNoticia(true);
  }
  function seleccionarImagenNoticia(e) {
    const archivo = e.target.files?.[0] || null; setNoticiaImagen(archivo);
    setNoticiaPreview(archivo ? URL.createObjectURL(archivo) : null);
  }
  async function guardarNoticia(e) {
    e.preventDefault();
    try {
      const noticia = noticiaEditando
        ? await api.ajustes.noticias.actualizar(noticiaEditando, noticiaFormulario)
        : await api.ajustes.noticias.crear(noticiaFormulario);
      if (noticiaImagen) await api.ajustes.noticias.subirImagen(noticia.id, noticiaImagen);
      setModalNoticia(false); cargar();
    } catch (err) { setError(err.message); }
  }
  async function alternarNoticia(noticia) {
    try { await api.ajustes.noticias.actualizar(noticia.id, { ...noticia, activo: !noticia.activo, fecha_evento: noticia.fecha_evento ? String(noticia.fecha_evento).slice(0,10) : '' }); cargar(); }
    catch (err) { setError(err.message); }
  }
  async function eliminarNoticia(noticia) {
    if (!window.confirm(`¿Eliminar la noticia "${noticia.titulo}"?`)) return;
    try { await api.ajustes.noticias.eliminar(noticia.id); setError(''); cargar(); }
    catch (err) { setError(err.message); }
  }

    function mostrarError() {
    return (error && <div className="ajustes-alerta" role="alert"><span>{error}</span><button onClick={() => setError('')} title="Cerrar aviso"><X size={16} /></button></div>);
  }

  function mostrarModal() {
    return (modal && <div className="modal-fondo" onClick={(e) => { if (e.target === e.currentTarget) setModal(false); }} onKeyDown={(e) => { if (e.key === 'Escape') setModal(false); }} role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-label="Formulario de ajustes">
        <div className="modal-encabezado"><h2>{editando ? 'Editar categoría' : 'Nueva categoría'}</h2><button className="modal-cerrar" onClick={() => setModal(false)}><X size={18} /></button></div>
        <form className="formulario-grid" onSubmit={guardar}>
          <label className="campo-ancho">Nombre *<input required value={formulario.nombre} onChange={(e) => setFormulario({ ...formulario, nombre: e.target.value })} /></label>
          <label>Orden<input type="number" min="0" value={formulario.orden} onChange={(e) => setFormulario({ ...formulario, orden: Number(e.target.value) })} /></label>
          <label className="campo-checkbox"><input type="checkbox" checked={formulario.activo} onChange={(e) => setFormulario({ ...formulario, activo: e.target.checked })} />Categoría activa</label>
          {error && <p className="login-error campo-ancho">{error}</p>}
          <div className="modal-acciones campo-ancho"><button type="button" className="boton-secundario" onClick={() => setModal(false)}>Cancelar</button><button className="boton-primario">Guardar</button></div>
        </form>
      </div></div>);
  }

  function mostrarModalPromo() {
    return (modalPromo && <div className="modal-fondo" onClick={(e) => { if (e.target === e.currentTarget) setModalPromo(false); }} onKeyDown={(e) => { if (e.key === 'Escape') setModalPromo(false); }} role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-label="Formulario de ajustes">
        <div className="modal-encabezado"><h2>{promoEditando ? 'Editar promoción' : 'Nueva promoción'}</h2><button className="modal-cerrar" onClick={() => setModalPromo(false)}><X size={18} /></button></div>
        <form className="formulario-grid" onSubmit={guardarPromocion}>
          <div className="campo-ancho promo-alcance"><span>Aplicar promoción a *</span><div role="group" aria-label="Alcance de la promoción"><button type="button" className={promoFormulario.alcance === 'producto' ? 'activo' : ''} onClick={() => cambiarAlcancePromocion('producto')}><Package size={16} /> Un artículo</button><button type="button" className={promoFormulario.alcance === 'categoria' ? 'activo' : ''} onClick={() => cambiarAlcancePromocion('categoria')}><Tags size={16} /> Una categoría</button></div></div>
          {promoFormulario.alcance === 'producto' ? <div className="campo-ancho promo-selector-producto"><span className="campo-etiqueta">Buscar artículo *</span><div className={`promo-buscador ${promoFormulario.producto_id ? 'seleccionado' : ''}`}><Search size={17} /><input required autoComplete="off" role="combobox" aria-expanded={promoResultadosAbiertos} aria-controls="promo-resultados" placeholder="Escribe al menos 2 letras del artículo" value={promoBusqueda} onFocus={() => { if (productos.length) setPromoResultadosAbiertos(true); }} onChange={(e) => { setPromoBusqueda(e.target.value); setPromoFormulario({ ...promoFormulario, producto_id: '' }); }} onKeyDown={(e) => { if (e.key === 'Escape') setPromoResultadosAbiertos(false); }} />{promoBuscando && <small>Buscando…</small>}</div>
            {promoResultadosAbiertos && <div className="promo-resultados" id="promo-resultados" role="listbox">{productos.length ? productos.map((producto) => <button type="button" role="option" key={producto.id} onClick={() => seleccionarProductoPromocion(producto)}><span><strong>{producto.nombre}</strong><small>{producto.categoria || 'Sin categoría'}</small></span><b>Q{Number(producto.precio).toFixed(2)}</b></button>) : <p>No se encontraron artículos similares.</p>}</div>}
            <small className="promo-ayuda">{promoFormulario.producto_id ? 'Artículo seleccionado' : 'Los resultados aparecerán mientras escribes.'}</small>
          </div> : <label className="campo-ancho">Categoría *<select required value={promoFormulario.categoria_id} onChange={(e) => setPromoFormulario({ ...promoFormulario, categoria_id: Number(e.target.value), producto_id: '' })}><option value="">Selecciona una categoría</option>{categorias.filter((categoria) => categoria.activo || categoria.id === promoFormulario.categoria_id).map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>)}</select><small>El descuento se aplicará a todos los artículos activos de esta categoría.</small></label>}
          <label>Descuento (%) *<input type="number" required min="1" max="100" step="1" value={promoFormulario.descuento_porcentaje} onChange={(e) => setPromoFormulario({ ...promoFormulario, descuento_porcentaje: Number(e.target.value) })} /></label>
          <label>Fecha de inicio *<input type="date" required value={promoFormulario.fecha_inicio} onChange={(e) => setPromoFormulario({ ...promoFormulario, fecha_inicio: e.target.value })} /></label>
          <label>Fecha de finalización<input type="date" min={promoFormulario.fecha_inicio} value={promoFormulario.fecha_fin} onChange={(e) => setPromoFormulario({ ...promoFormulario, fecha_fin: e.target.value })} /></label>
          <label className="campo-checkbox"><input type="checkbox" checked={promoFormulario.activo} onChange={(e) => setPromoFormulario({ ...promoFormulario, activo: e.target.checked })} />Promoción activa</label>
          {error && <p className="login-error campo-ancho">{error}</p>}
          <div className="modal-acciones campo-ancho"><button type="button" className="boton-secundario" onClick={() => setModalPromo(false)}>Cancelar</button><button className="boton-primario" disabled={promoFormulario.alcance === 'producto' ? !promoFormulario.producto_id : !promoFormulario.categoria_id}>Guardar promoción</button></div>
        </form>
      </div></div>);
  }

  function mostrarModalNoticia() {
    return (modalNoticia && <div className="modal-fondo" onClick={(e) => { if (e.target === e.currentTarget) setModalNoticia(false); }} onKeyDown={(e) => { if (e.key === 'Escape') setModalNoticia(false); }} role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-label="Formulario de ajustes">
        <div className="modal-encabezado"><h2>{noticiaEditando ? 'Editar noticia' : 'Nueva noticia'}</h2><button className="modal-cerrar" onClick={() => setModalNoticia(false)}><X size={18} /></button></div>
        <form className="formulario-grid" onSubmit={guardarNoticia}>
          <label className="campo-ancho producto-imagen-campo">Imagen<div className="producto-imagen-selector"><div className="producto-imagen-preview">{noticiaPreview ? <img src={noticiaPreview} alt="Vista previa" /> : <ImagePlus size={28} />}</div><div><input type="file" accept="image/jpeg,image/png,image/webp" onChange={seleccionarImagenNoticia} /><small>JPG, PNG o WEBP. Máximo 5 MB.</small></div></div></label>
          <label className="campo-ancho">Título *<input required value={noticiaFormulario.titulo} onChange={(e) => setNoticiaFormulario({...noticiaFormulario,titulo:e.target.value})} /></label>
          <label className="campo-ancho">Resumen<textarea rows={2} maxLength={300} value={noticiaFormulario.resumen} onChange={(e) => setNoticiaFormulario({...noticiaFormulario,resumen:e.target.value})} /></label>
          <label className="campo-ancho">Contenido<textarea rows={5} value={noticiaFormulario.contenido} onChange={(e) => setNoticiaFormulario({...noticiaFormulario,contenido:e.target.value})} /></label>
          <label>Fecha del evento<input type="date" value={noticiaFormulario.fecha_evento} onChange={(e) => setNoticiaFormulario({...noticiaFormulario,fecha_evento:e.target.value})} /></label>
          <label>Enlace externo<input type="url" placeholder="https://..." value={noticiaFormulario.enlace_url} onChange={(e) => setNoticiaFormulario({...noticiaFormulario,enlace_url:e.target.value})} /></label>
          <label className="campo-checkbox"><input type="checkbox" checked={noticiaFormulario.activo} onChange={(e) => setNoticiaFormulario({...noticiaFormulario,activo:e.target.checked})} />Visible en la tienda</label>
          {error && <p className="login-error campo-ancho">{error}</p>}
          <div className="modal-acciones campo-ancho"><button type="button" className="boton-secundario" onClick={() => setModalNoticia(false)}>Cancelar</button><button className="boton-primario">Publicar noticia</button></div>
        </form>
      </div></div>);
  }

  function mostrarModalSede() {
    return (modalSede && <div className="modal-fondo" onClick={(e) => { if (e.target === e.currentTarget) setModalSede(false); }} onKeyDown={(e) => { if (e.key === 'Escape') setModalSede(false); }} role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-label="Formulario de ajustes"><div className="modal-encabezado"><h2>{sedeEditando ? 'Editar sede' : 'Nueva sede'}</h2><button className="modal-cerrar" onClick={() => setModalSede(false)}><X size={18} /></button></div><form className="formulario-grid" onSubmit={guardarSede}>
        <label className="campo-ancho">Nombre *<input required value={sedeFormulario.nombre} onChange={(e) => setSedeFormulario({...sedeFormulario,nombre:e.target.value})} /></label>
        <label className="campo-ancho">Dirección *<input required value={sedeFormulario.direccion} onChange={(e) => setSedeFormulario({...sedeFormulario,direccion:e.target.value})} /></label>
        <label>Teléfono<input type="tel" value={sedeFormulario.telefono} onChange={(e) => setSedeFormulario({...sedeFormulario,telefono:e.target.value})} /></label>
        <label className="campo-checkbox"><input type="checkbox" checked={sedeFormulario.activo} onChange={(e) => setSedeFormulario({...sedeFormulario,activo:e.target.checked})} />Sede activa</label>
        {error && <p className="login-error campo-ancho">{error}</p>}<div className="modal-acciones campo-ancho"><button type="button" className="boton-secundario" onClick={() => setModalSede(false)}>Cancelar</button><button className="boton-primario">Guardar sede</button></div>
      </form></div></div>);
  }

  function mostrarModalHorario() {
    return (modalHorario && <div className="modal-fondo" onClick={(e) => { if (e.target === e.currentTarget) setModalHorario(false); }} onKeyDown={(e) => { if (e.key === 'Escape') setModalHorario(false); }} role="presentation"><div className="modal modal-horario-semanal" role="dialog" aria-modal="true" aria-label="Formulario de ajustes"><div className="modal-encabezado"><h2>{horarioEditando ? 'Editar horario semanal' : 'Configurar horario semanal'}</h2><button className="modal-cerrar" onClick={() => setModalHorario(false)}><X size={18} /></button></div><form onSubmit={guardarHorario}>
        <div className="formulario-grid horario-identificacion"><label>Médico *<select required disabled={Boolean(horarioEditando)} value={horarioFormulario.medico_id} onChange={(e) => setHorarioFormulario({...horarioFormulario,medico_id:Number(e.target.value)})}><option value="">Selecciona</option>{medicos.map((m)=><option key={m.id} value={m.id}>{m.nombre}</option>)}</select></label><label>Sede *<select required value={horarioFormulario.sede_id} onChange={(e) => setHorarioFormulario({...horarioFormulario,sede_id:Number(e.target.value)})}><option value="">Selecciona</option>{sedes.filter((s)=>s.activo).map((s)=><option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label></div>
        <div className="editor-semana"><div className="editor-semana-cabecera"><span>Día</span><span>Primera jornada</span><span>Segunda jornada</span></div>{[1,2,3,4,5,6,0].map((dia)=>{const bloques=horarioFormulario.semana?.[dia]||[]; const activo=bloques.length>0; return <div className={`editor-dia ${activo?'activo':''}`} key={dia}>
          <label className="editor-dia-nombre"><input type="checkbox" checked={activo} onChange={(e)=>alternarDiaHorario(dia,e.target.checked)} />{DIAS[dia]}</label>
          <div className="editor-bloque"><input aria-label={`Inicio ${DIAS[dia]}`} type="time" required={activo} disabled={!activo} value={bloques[0]?.inicio||''} onChange={(e)=>cambiarBloque(dia,0,'inicio',e.target.value)} /><span>a</span><input aria-label={`Fin ${DIAS[dia]}`} type="time" required={activo} disabled={!activo} value={bloques[0]?.fin||''} onChange={(e)=>cambiarBloque(dia,0,'fin',e.target.value)} /></div>
          <div className="editor-segundo"><label><input type="checkbox" disabled={!activo} checked={bloques.length>1} onChange={(e)=>alternarSegundoBloque(dia,e.target.checked)} />Agregar</label><div className="editor-bloque"><input aria-label={`Segundo inicio ${DIAS[dia]}`} type="time" required={bloques.length>1} disabled={bloques.length<2} value={bloques[1]?.inicio||''} onChange={(e)=>cambiarBloque(dia,1,'inicio',e.target.value)} /><span>a</span><input aria-label={`Segundo fin ${DIAS[dia]}`} type="time" required={bloques.length>1} disabled={bloques.length<2} value={bloques[1]?.fin||''} onChange={(e)=>cambiarBloque(dia,1,'fin',e.target.value)} /></div></div>
        </div>;})}</div>
        {error && <p className="login-error">{error}</p>}<div className="modal-acciones"><button type="button" className="boton-secundario" onClick={() => setModalHorario(false)}>Cancelar</button><button className="boton-primario">Guardar horario semanal</button></div>
      </form></div></div>);
  }

  function mostrarModalBloqueo() {
    return (modalBloqueo && <div className="modal-fondo" onClick={(e) => { if (e.target === e.currentTarget) setModalBloqueo(false); }} onKeyDown={(e) => { if (e.key === 'Escape') setModalBloqueo(false); }} role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-label="Formulario de ajustes"><div className="modal-encabezado"><h2>Bloquear agenda</h2><button className="modal-cerrar" onClick={() => setModalBloqueo(false)}><X size={18} /></button></div><form className="formulario-grid" onSubmit={guardarBloqueo}>
        <label>Médico *<select required value={bloqueoFormulario.medico_id} onChange={(e) => setBloqueoFormulario({...bloqueoFormulario,medico_id:Number(e.target.value)})}><option value="">Selecciona</option>{medicos.map((m)=><option key={m.id} value={m.id}>{m.nombre}</option>)}</select></label>
        <label>Sede *<select required value={bloqueoFormulario.sede_id} onChange={(e) => setBloqueoFormulario({...bloqueoFormulario,sede_id:Number(e.target.value)})}><option value="">Selecciona</option>{sedes.filter((s)=>s.activo).map((s)=><option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label>
        <label>Fecha *<input type="date" required value={bloqueoFormulario.fecha} onChange={(e) => setBloqueoFormulario({...bloqueoFormulario,fecha:e.target.value})} /></label>
        <label>Desde *<input type="time" required value={bloqueoFormulario.hora_inicio} onChange={(e) => setBloqueoFormulario({...bloqueoFormulario,hora_inicio:e.target.value})} /></label>
        <label>Hasta *<input type="time" required value={bloqueoFormulario.hora_fin} onChange={(e) => setBloqueoFormulario({...bloqueoFormulario,hora_fin:e.target.value})} /></label>
        <label className="campo-ancho">Motivo *<input required value={bloqueoFormulario.motivo} onChange={(e) => setBloqueoFormulario({...bloqueoFormulario,motivo:e.target.value})} /></label>
        {error && <p className="login-error campo-ancho">{error}</p>}<div className="modal-acciones campo-ancho"><button type="button" className="boton-secundario" onClick={() => setModalBloqueo(false)}>Cancelar</button><button className="boton-primario">Guardar bloqueo</button></div>
      </form></div></div>);
  }

  return (
    <div className="pagina">
      <header className="pagina-encabezado">
        <div><h1>Ajustes</h1><p>Catálogos y parámetros del sistema</p></div>
      </header>

      {mostrarError()}

      <section className="ajustes-seccion">
        <div className="ajustes-encabezado">
          <div><h2>Categorías de productos</h2><p>Estas opciones aparecen al crear o editar productos.</p></div>
          <button className="boton-primario" onClick={() => abrir()}><Plus size={16} /> Nueva categoría</button>
        </div>
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead><tr><th>Nombre</th><th>Orden</th><th>Estado</th><th></th></tr></thead>
            <tbody>{categorias.map((categoria) => (
              <tr key={categoria.id}>
                <td>{categoria.nombre}</td><td>{categoria.orden}</td>
                <td><button className={`interruptor ${categoria.activo ? 'activo' : ''}`} onClick={() => cambiarActivo(categoria)} aria-label={`Cambiar estado de ${categoria.nombre}`}><span /></button></td>
                <td className="tabla-acciones"><button onClick={() => abrir(categoria)} title="Editar"><Pencil size={16} /></button><button className="boton-peligro" onClick={() => eliminarCategoria(categoria)} title="Eliminar"><Trash2 size={16} /></button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="ajustes-seccion ajustes-bloque">
        <div className="ajustes-encabezado">
          <div><h2>Promociones de productos</h2><p>Aplica descuentos a un artículo específico o a todos los productos de una categoría.</p></div>
          <button className="boton-primario" onClick={() => abrirPromocion()}><Plus size={16} /> Nueva promoción</button>
        </div>
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead><tr><th>Alcance</th><th>Descuento</th><th>Vigencia</th><th>Estado</th><th></th></tr></thead>
            <tbody>{promociones.length === 0 ? <tr><td colSpan="5" className="texto-tenue">No hay promociones registradas.</td></tr> : promociones.map((promo) => (
              <tr key={promo.id}>
                <td><div className="promocion-objetivo"><span className="etiqueta">{promo.alcance === 'categoria' ? 'Categoría' : 'Artículo'}</span><strong>{nombreObjetivoPromocion(promo)}</strong>{promo.producto_id ? <small>Precio base: Q{Number(promo.precio).toFixed(2)}</small> : <small>Aplica a todos sus artículos</small>}</div></td>
                <td><strong>{Number(promo.descuento_porcentaje).toFixed(0)}%</strong></td>
                <td>{String(promo.fecha_inicio).slice(0,10)} — {promo.fecha_fin ? String(promo.fecha_fin).slice(0,10) : 'Sin vencimiento'}</td>
                <td><button className={`interruptor ${promo.activo ? 'activo' : ''}`} onClick={() => alternarPromocion(promo)} aria-label={`Cambiar promoción de ${nombreObjetivoPromocion(promo)}`}><span /></button></td>
                <td className="tabla-acciones"><button onClick={() => abrirPromocion(promo)} title="Editar"><Pencil size={16} /></button><button className="boton-peligro" onClick={() => eliminarPromocion(promo)} title="Eliminar"><Trash2 size={16} /></button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="ajustes-seccion ajustes-bloque">
        <div className="ajustes-encabezado"><div><h2>Noticias y actividades</h2><p>Publica conferencias, eventos y novedades que aparecerán en la tienda.</p></div><button className="boton-primario" onClick={() => abrirNoticia()}><Plus size={16} /> Nueva noticia</button></div>
        <div className="tabla-contenedor"><table className="tabla"><thead><tr><th>Noticia</th><th>Fecha</th><th>Estado</th><th></th></tr></thead><tbody>
          {noticias.length === 0 ? <tr><td colSpan="4" className="texto-tenue">No hay noticias registradas.</td></tr> : noticias.map((noticia) => <tr key={noticia.id}>
            <td><div className="ajustes-noticia-celda">{noticia.imagen_url ? <img src={urlArchivo(noticia.imagen_url)} alt="" /> : <span><ImagePlus size={17} /></span>}<div><strong>{noticia.titulo}</strong><small>{noticia.resumen || 'Sin resumen'}</small></div></div></td>
            <td>{noticia.fecha_evento ? String(noticia.fecha_evento).slice(0,10) : 'Sin fecha'}</td>
            <td><button className={`interruptor ${noticia.activo ? 'activo' : ''}`} onClick={() => alternarNoticia(noticia)} aria-label={`Cambiar estado de ${noticia.titulo}`}><span /></button></td>
            <td className="tabla-acciones"><button onClick={() => abrirNoticia(noticia)} title="Editar"><Pencil size={16} /></button><button className="boton-peligro" onClick={() => eliminarNoticia(noticia)} title="Eliminar"><Trash2 size={16} /></button></td>
          </tr>)}
        </tbody></table></div>
      </section>

      <section className="ajustes-seccion ajustes-bloque">
        <div className="ajustes-encabezado"><div><h2>Sedes</h2><p>Establecimientos disponibles para citas de clientes y recepción.</p></div><button className="boton-primario" onClick={() => abrirSede()}><Plus size={16} /> Nueva sede</button></div>
        <div className="tabla-contenedor"><table className="tabla"><thead><tr><th>Nombre</th><th>Dirección</th><th>Teléfono</th><th>Estado</th><th></th></tr></thead><tbody>
          {sedes.map((sede) => <tr key={sede.id}><td><strong>{sede.nombre}</strong></td><td>{sede.direccion}</td><td>{sede.telefono || '—'}</td><td><button className={`interruptor ${sede.activo ? 'activo' : ''}`} onClick={() => alternarSede(sede)} aria-label={`Cambiar estado de ${sede.nombre}`}><span /></button></td><td className="tabla-acciones"><button onClick={() => abrirSede(sede)} title="Editar"><Pencil size={16} /></button><button className="boton-peligro" onClick={() => eliminarSede(sede)} title="Eliminar"><Trash2 size={16} /></button></td></tr>)}
        </tbody></table></div>
      </section>

      <section className="ajustes-seccion ajustes-bloque">
        <div className="ajustes-encabezado"><div><h2>Horarios semanales</h2><p>Una configuración reúne todos los días y jornadas de un médico en cada sede.</p></div><button className="boton-primario" onClick={() => abrirHorario()}><Plus size={16} /> Configurar horario</button></div>
        <div className="tabla-contenedor"><table className="tabla"><thead><tr><th>Médico</th><th>Sede</th><th>Días de atención</th><th>Jornada</th><th></th></tr></thead><tbody>
          {horarios.length === 0 ? <tr><td colSpan="5" className="texto-tenue">No hay horarios configurados.</td></tr> : horarios.map((h) => <tr key={h.id}><td><strong>{h.medico_nombre}</strong></td><td>{h.sede_nombre}</td><td>{diasHorario(h.semana)}</td><td>{resumenHorario(h.semana)}</td><td className="tabla-acciones"><button onClick={() => abrirHorario(h)} title="Editar horario"><Pencil size={16} /></button><button onClick={() => eliminarHorario(h.id)} title="Eliminar horario"><Trash2 size={16} /></button></td></tr>)}
        </tbody></table></div>
      </section>

      <section className="ajustes-seccion ajustes-bloque">
        <div className="ajustes-encabezado"><div><h2>Bloqueos de agenda</h2><p>Registra almuerzos especiales, permisos, vacaciones o períodos fuera de turno.</p></div><button className="boton-primario" onClick={() => { setBloqueoFormulario(BLOQUEO_VACIO); setError(''); setModalBloqueo(true); }}><Plus size={16} /> Nuevo bloqueo</button></div>
        <div className="tabla-contenedor"><table className="tabla"><thead><tr><th>Fecha</th><th>Médico</th><th>Sede</th><th>Horario</th><th>Motivo</th><th></th></tr></thead><tbody>
          {bloqueos.length === 0 ? <tr><td colSpan="6" className="texto-tenue">No hay bloqueos futuros.</td></tr> : bloqueos.map((b) => <tr key={b.id}><td>{String(b.fecha).slice(0,10)}</td><td>{b.medico_nombre}</td><td>{b.sede_nombre}</td><td>{String(b.hora_inicio).slice(0,5)} - {String(b.hora_fin).slice(0,5)}</td><td>{b.motivo}</td><td className="tabla-acciones"><button onClick={() => eliminarBloqueo(b.id)} title="Eliminar bloqueo"><Trash2 size={16} /></button></td></tr>)}
        </tbody></table></div>
      </section>

      {mostrarModal()}

      {mostrarModalPromo()}

      {mostrarModalNoticia()}

      {mostrarModalSede()}

      {mostrarModalHorario()}

      {mostrarModalBloqueo()}
    </div>
  );
}
