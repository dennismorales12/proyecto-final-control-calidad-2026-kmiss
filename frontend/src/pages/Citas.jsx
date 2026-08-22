import { useEffect, useMemo, useState } from 'react';
import { Ban, CalendarDays, Check, ChevronLeft, ChevronRight, MessageCircle, Plus, X } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import ImportarExcel from '../components/ImportarExcel';

const VACIO = { paciente_id: '', sede_id: '', servicio_id: '', medico_id: '', fecha: '', hora: '', motivo_consulta: '' };
const ESTADOS = {
  solicitada: ['Solicitada', 'estado-programada'], programada: ['Programada', 'estado-programada'],
  confirmada: ['Confirmada', 'estado-confirmada'], atendida: ['Atendida', 'estado-atendida'],
  cancelada: ['Cancelada', 'estado-cancelada'], no_asistio: ['No asistió', 'estado-cancelada'],
};

function fechaLocal(date) {
  const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function inicioSemana(base = new Date()) {
  const fecha = new Date(base); const dia = fecha.getDay() || 7;
  fecha.setHours(0, 0, 0, 0); fecha.setDate(fecha.getDate() - dia + 1); return fecha;
}
function telefonoWhatsApp(valor) { const d = String(valor || '').replace(/\D/g, ''); return d.length === 8 ? `502${d}` : d; }

export default function Citas() {
  const { usuario } = useAuth();
  const [semana, setSemana] = useState(inicioSemana());
  const [citas, setCitas] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [medicos, setMedicos] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [cargandoHorarios, setCargandoHorarios] = useState(false);
  const [sedeFiltro, setSedeFiltro] = useState('');
  const [modal, setModal] = useState(false);
  const [formulario, setFormulario] = useState(VACIO);
  const [error, setError] = useState('');
  const puedeConfirmar = ['administrador', 'recepcion'].includes(usuario?.rol);
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(semana); d.setDate(d.getDate() + i); return d; }), [semana]);

  async function cargar() {
    const desde = fechaLocal(dias[0]); const hasta = fechaLocal(dias[6]);
    try { setCitas(await api.citas.listar({ desde, hasta, ...(sedeFiltro ? { sede_id: sedeFiltro } : {}) })); } catch (err) { setError(err.message); }
  }
  useEffect(() => { cargar(); }, [semana, sedeFiltro]);
  useEffect(() => {
    Promise.all([api.pacientes.listar(), api.servicios.listar(), api.citas.sedes()])
      .then(([p, s, sedesDatos]) => { setPacientes(p); setServicios(s); setSedes(sedesDatos); if (sedesDatos.length === 1) setSedeFiltro(String(sedesDatos[0].id)); })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!formulario.sede_id) { setMedicos([]); return; }
    api.citas.medicos(formulario.sede_id).then(setMedicos).catch(() => setMedicos([]));
  }, [formulario.sede_id]);
  useEffect(() => {
    const { medico_id, sede_id, servicio_id, fecha } = formulario;
    if (!medico_id || !sede_id || !servicio_id || !fecha) { setHorarios([]); return; }
    setCargandoHorarios(true); setFormulario((actual) => ({ ...actual, hora: '' }));
    api.citas.disponibilidad(medico_id, sede_id, servicio_id, fecha)
      .then(setHorarios).catch((err) => setError(err.message)).finally(() => setCargandoHorarios(false));
  }, [formulario.medico_id, formulario.sede_id, formulario.servicio_id, formulario.fecha]);

  function abrirNueva(fecha = null) {
    const sedeInicial = sedeFiltro || (sedes.length === 1 ? String(sedes[0].id) : '');
    setFormulario({ ...VACIO, sede_id: sedeInicial, medico_id: usuario.rol === 'medico' ? usuario.id : '', fecha: fecha ? fechaLocal(fecha) : '' });
    setHorarios([]); setError(''); setModal(true);
  }
  async function guardar(e) {
    e.preventDefault(); setError('');
    try { await api.citas.crear({ ...formulario, fecha_hora: `${formulario.fecha}T${formulario.hora}:00` }); setModal(false); cargar(); }
    catch (err) { setError(err.message); }
  }
  async function cambiarEstado(id, estado) {
    try { await api.citas.cambiarEstado(id, estado); cargar(); } catch (err) { setError(err.message); }
  }
  function recordar(cita) {
    if (!cita.medico_telefono) { setError('Agrega el teléfono del médico en Usuarios para enviar recordatorios.'); return; }
    const fecha = new Date(cita.fecha_hora).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' });
    const mensaje = encodeURIComponent(`Hola, Dr(a). ${cita.medico_nombre}. Recordatorio de cita en K-MISS, ${cita.sede_nombre}: ${fecha}, paciente ${cita.paciente_nombre}, servicio ${cita.servicio_nombre}.`);
    window.open(`https://wa.me/${telefonoWhatsApp(cita.medico_telefono)}?text=${mensaje}`, '_blank', 'noopener,noreferrer');
  }

  return <div className="pagina">
    <header className="pagina-encabezado"><div><h1>Agenda de citas</h1><p>Disponibilidad semanal por sede y médico</p></div><div className="acciones-encabezado">
      {usuario.rol === 'administrador' && <ImportarExcel onImportar={(a) => api.citas.importar(a)} alTerminar={cargar} columnas={['paciente','servicio','sede','fecha_hora','medico','motivo_consulta','estado']} />}
      <button className="boton-primario" onClick={() => abrirNueva()}><Plus size={17} /> Nueva cita</button>
    </div></header>
    {error && !modal && <p className="login-error">{error}</p>}
    <div className="agenda-controles">
      <label className="agenda-filtro-sede">Sede<select value={sedeFiltro} onChange={(e) => setSedeFiltro(e.target.value)}><option value="">Todas las sedes</option>{sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label>
      <button className="boton-secundario" title="Semana anterior" onClick={() => setSemana((s) => { const d = new Date(s); d.setDate(d.getDate()-7); return d; })}><ChevronLeft size={17} /></button><button className="boton-secundario" onClick={() => setSemana(inicioSemana())}>Hoy</button><strong>{dias[0].toLocaleDateString('es-GT',{day:'numeric',month:'short'})} - {dias[6].toLocaleDateString('es-GT',{day:'numeric',month:'short',year:'numeric'})}</strong><button className="boton-secundario" title="Semana siguiente" onClick={() => setSemana((s) => { const d = new Date(s); d.setDate(d.getDate()+7); return d; })}><ChevronRight size={17} /></button>
    </div>
    <div className="agenda-semanal">{dias.map((dia) => {
      const delDia = citas.filter((c) => fechaLocal(new Date(c.fecha_hora)) === fechaLocal(dia));
      return <section className={`agenda-dia ${fechaLocal(dia) === fechaLocal(new Date()) ? 'hoy' : ''}`} key={fechaLocal(dia)}>
        <button className="agenda-dia-encabezado" onClick={() => abrirNueva(dia)}><span>{dia.toLocaleDateString('es-GT',{weekday:'short'})}</span><strong>{dia.getDate()}</strong></button>
        <div className="agenda-dia-citas">{delDia.length === 0 ? <span className="agenda-vacio">Disponible</span> : delDia.map((cita) => <article className={`cita-chip cita-${cita.estado}`} key={cita.id}>
          <div className="cita-chip-hora">{new Date(cita.fecha_hora).toLocaleTimeString('es-GT',{hour:'2-digit',minute:'2-digit'})}</div>
          <strong>{cita.paciente_nombre}</strong><span>{cita.servicio_nombre}</span><small>{cita.medico_nombre}</small><small>{cita.sede_nombre}</small>
          <span className={`etiqueta-estado ${ESTADOS[cita.estado]?.[1]}`}>{ESTADOS[cita.estado]?.[0]}</span>
          <div className="cita-chip-acciones">
            {cita.medico_id && <button title="Recordar por WhatsApp" onClick={() => recordar(cita)}><MessageCircle size={14} /></button>}
            {cita.estado === 'solicitada' && puedeConfirmar && <button title="Confirmar cita" onClick={() => cambiarEstado(cita.id,'confirmada')}><Check size={14} /></button>}
            {['programada','confirmada'].includes(cita.estado) && <button title="Marcar atendida" onClick={() => cambiarEstado(cita.id,'atendida')}><Check size={14} /></button>}
            {!['cancelada','atendida','no_asistio'].includes(cita.estado) && <button title="Cancelar cita" onClick={() => cambiarEstado(cita.id,'cancelada')}><Ban size={14} /></button>}
          </div>
        </article>)}</div>
      </section>;
    })}</div>
    {modal && <div className="modal-fondo" onClick={() => setModal(false)}><div className="modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal-encabezado"><h2>Nueva cita</h2><button className="modal-cerrar" onClick={() => setModal(false)}><X size={18} /></button></div>
      <form className="formulario-grid" onSubmit={guardar}>
        <label className="campo-ancho">Paciente *<select required value={formulario.paciente_id} onChange={(e) => setFormulario({...formulario,paciente_id:e.target.value})}><option value="">Selecciona un paciente</option>{pacientes.map((p)=><option key={p.id} value={p.id}>{p.nombre_completo}</option>)}</select></label>
        <label className="campo-ancho">Establecimiento *<select required value={formulario.sede_id} onChange={(e) => setFormulario({...formulario,sede_id:e.target.value,medico_id:'',hora:''})}><option value="">Selecciona una sede</option>{sedes.map((s)=><option key={s.id} value={s.id}>{s.nombre} · {s.direccion}</option>)}</select></label>
        <label>Servicio *<select required value={formulario.servicio_id} onChange={(e) => setFormulario({...formulario,servicio_id:e.target.value,hora:''})}><option value="">Selecciona un servicio</option>{servicios.filter((s)=>s.activo).map((s)=><option key={s.id} value={s.id}>{s.nombre} · {s.duracion_minutos} min</option>)}</select></label>
        <label>Médico *<select required disabled={!formulario.sede_id || usuario.rol==='medico'} value={formulario.medico_id} onChange={(e) => setFormulario({...formulario,medico_id:e.target.value,hora:''})}><option value="">Selecciona un médico</option>{medicos.map((m)=><option key={m.id} value={m.id}>{m.nombre}</option>)}</select></label>
        <label>Fecha *<input type="date" required value={formulario.fecha} onChange={(e) => setFormulario({...formulario,fecha:e.target.value,hora:''})} /></label>
        <label>Horario disponible *<select required disabled={!formulario.fecha || cargandoHorarios} value={formulario.hora} onChange={(e) => setFormulario({...formulario,hora:e.target.value})}><option value="">{cargandoHorarios ? 'Consultando...' : horarios.length ? 'Selecciona una hora' : 'No hay horarios disponibles'}</option>{horarios.map((h)=><option key={h} value={h}>{h}</option>)}</select></label>
        <label className="campo-ancho">Motivo<textarea rows={2} value={formulario.motivo_consulta} onChange={(e) => setFormulario({...formulario,motivo_consulta:e.target.value})} /></label>
        {error && <p className="login-error campo-ancho">{error}</p>}
        <div className="modal-acciones campo-ancho"><button type="button" className="boton-secundario" onClick={() => setModal(false)}>Cancelar</button><button className="boton-primario" disabled={!formulario.hora}><CalendarDays size={16} /> Agendar</button></div>
      </form>
    </div></div>}
  </div>;
}
