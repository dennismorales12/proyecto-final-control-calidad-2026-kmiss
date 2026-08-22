import { useEffect, useState } from 'react';
import { Users, CalendarDays, Stethoscope, Clock } from 'lucide-react';
import { api } from '../services/api';

export default function Dashboard() {
  const [resumen, setResumen] = useState({ pacientes: 0, citasHoy: 0, servicios: 0, proximas: [] });
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargarResumen() {
      try {
        const hoy = new Date().toISOString().split('T')[0];
        const [pacientes, servicios, citasHoy] = await Promise.all([
          api.pacientes.listar(),
          api.servicios.listar(),
          api.citas.listar({ fecha: hoy }),
        ]);
        setResumen({
          pacientes: pacientes.length,
          servicios: servicios.length,
          citasHoy: citasHoy.length,
          proximas: citasHoy.slice(0, 5),
        });
      } catch (error) {
        console.error('Error al cargar el panel:', error);
      } finally {
        setCargando(false);
      }
    }
    cargarResumen();
  }, []);

  return (
    <div className="pagina">
      <header className="pagina-encabezado">
        <div>
          <h1>Panel general</h1>
          <p>Resumen de la actividad de hoy</p>
        </div>
      </header>

      <div className="tarjetas-resumen">
        <div className="tarjeta-metrica">
          <Users size={22} strokeWidth={1.5} />
          <div>
            <p className="metrica-valor">{cargando ? '—' : resumen.pacientes}</p>
            <p className="metrica-etiqueta">Pacientes registrados</p>
          </div>
        </div>
        <div className="tarjeta-metrica">
          <CalendarDays size={22} strokeWidth={1.5} />
          <div>
            <p className="metrica-valor">{cargando ? '—' : resumen.citasHoy}</p>
            <p className="metrica-etiqueta">Citas de hoy</p>
          </div>
        </div>
        <div className="tarjeta-metrica">
          <Stethoscope size={22} strokeWidth={1.5} />
          <div>
            <p className="metrica-valor">{cargando ? '—' : resumen.servicios}</p>
            <p className="metrica-etiqueta">Servicios activos</p>
          </div>
        </div>
      </div>

      <section className="panel-seccion">
        <h2>Próximas citas de hoy</h2>
        {cargando ? (
          <p className="texto-vacio">Cargando…</p>
        ) : resumen.proximas.length === 0 ? (
          <p className="texto-vacio">No hay citas programadas para hoy.</p>
        ) : (
          <ul className="lista-citas-resumen">
            {resumen.proximas.map((cita) => (
              <li key={cita.id}>
                <Clock size={16} strokeWidth={1.5} />
                <span className="cita-hora">
                  {new Date(cita.fecha_hora).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span>{cita.paciente_nombre}</span>
                <span className="texto-tenue">{cita.servicio_nombre}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
