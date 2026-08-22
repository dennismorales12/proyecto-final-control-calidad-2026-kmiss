import { useEffect, useState } from 'react';
import { Ban, CheckCircle2, CreditCard, MessageCircle, PackageCheck, RotateCcw, Truck, UserCheck, X } from 'lucide-react';
import { api } from '../services/api';
import { APP_CONFIG } from '../config';

const ESTADOS = {
  nuevo: ['Nuevo', 'estado-programada'],
  contactado: ['Contactado', 'estado-confirmada'],
  esperando_pago: ['Esperando pago', 'estado-programada'],
  pagado: ['Pagado', 'estado-atendida'],
  preparando: ['Preparando', 'estado-confirmada'],
  entregado: ['Entregado', 'estado-atendida'],
  cancelado: ['Cancelado', 'estado-cancelada'],
  vencido: ['Reserva vencida', 'estado-cancelada'],
};

const CON_RESERVA = ['nuevo', 'contactado', 'esperando_pago'];

function telefonoWhatsApp(telefono) {
  const digitos = String(telefono || '').replace(/\D/g, '');
  return digitos.length === 8 ? `502${digitos}` : digitos;
}

function fecha(valor) {
  return valor ? new Date(valor).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

export default function Pedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [cargando, setCargando] = useState(true);
  const [pedidoAbierto, setPedidoAbierto] = useState(null);
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [confirmandoPago, setConfirmandoPago] = useState(false);
  const [referenciaPago, setReferenciaPago] = useState('');

  async function cargarPedidos(estado = filtro) {
    setCargando(true);
    try {
      setPedidos(await api.pedidos.listar(estado ? { estado } : {}));
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargarPedidos(filtro); }, [filtro]);

  async function verDetalle(id) {
    try {
      setPedidoAbierto(await api.pedidos.obtener(id));
      setConfirmandoPago(false);
      setReferenciaPago('');
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function ejecutar(accion) {
    setProcesando(true);
    setError('');
    try {
      await accion();
      setPedidoAbierto(null);
      await cargarPedidos(filtro);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  }

  function contactar(pedido) {
    const mensaje = encodeURIComponent(
      `Hola, ${pedido.nombre_cliente}. Te contactamos de ${APP_CONFIG.nombreEmpresa} por tu pedido #${pedido.id} de Q${Number(pedido.total).toFixed(2)}. Queremos coordinar el pago y la entrega.`
    );
    window.open(`https://wa.me/${telefonoWhatsApp(pedido.telefono)}?text=${mensaje}`, '_blank', 'noopener,noreferrer');
  }

  function confirmarPago(pedido) {
    ejecutar(() => api.pedidos.confirmarPago(pedido.id, referenciaPago.trim() || null));
  }

  function cancelar(pedido) {
    const motivo = window.prompt('Motivo de cancelación:', '') ?? null;
    if (motivo === null) return;
    ejecutar(() => api.pedidos.cancelar(pedido.id, motivo));
  }

  const estadoActual = pedidoAbierto ? ESTADOS[pedidoAbierto.estado] : null;

  return (
    <div className="pagina">
      <header className="pagina-encabezado">
        <div>
          <h1>Pedidos de la tienda</h1>
          <p>Seguimiento de reservas, contacto, pago y entrega</p>
        </div>
      </header>

      {error && <p className="login-error">{error}</p>}

      <div className="barra-busqueda pedidos-filtro">
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="">Todos los pedidos</option>
          {Object.entries(ESTADOS).map(([valor, [etiqueta]]) => <option key={valor} value={valor}>{etiqueta}</option>)}
        </select>
      </div>

      <div className="tabla-contenedor">
        {cargando ? <p className="texto-vacio">Cargando…</p> : pedidos.length === 0 ? (
          <p className="texto-vacio">No hay pedidos en este estado.</p>
        ) : (
          <table className="tabla">
            <thead><tr><th>Pedido</th><th>Cliente</th><th>Contacto</th><th>Total</th><th>Reserva</th><th>Estado</th></tr></thead>
            <tbody>
              {pedidos.map((pedido) => (
                <tr key={pedido.id} className={pedido.estado === 'nuevo' ? 'fila-destacada' : ''} onClick={() => verDetalle(pedido.id)}>
                  <td>#{pedido.id}<div className="texto-tenue">{fecha(pedido.creado_en)}</div></td>
                  <td>{pedido.nombre_cliente}</td>
                  <td>{pedido.telefono}</td>
                  <td>Q{Number(pedido.total).toFixed(2)}</td>
                  <td className="texto-tenue">{CON_RESERVA.includes(pedido.estado) ? fecha(pedido.reserva_expira_en) : '—'}</td>
                  <td><span className={`etiqueta-estado ${ESTADOS[pedido.estado]?.[1]}`}>{ESTADOS[pedido.estado]?.[0]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pedidoAbierto && (
        <div className="modal-fondo" onClick={() => setPedidoAbierto(null)}>
          <div className="modal pedido-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-encabezado">
              <div><h2>Pedido #{pedidoAbierto.id}</h2><span className={`etiqueta-estado ${estadoActual?.[1]}`}>{estadoActual?.[0]}</span></div>
              <button className="modal-cerrar" onClick={() => setPedidoAbierto(null)} title="Cerrar"><X size={18} /></button>
            </div>

            <div className="pedido-contacto">
              <div><strong>{pedidoAbierto.nombre_cliente}</strong><span>{pedidoAbierto.telefono}</span></div>
              <div><strong>NIT</strong><span>{pedidoAbierto.nit_cliente || 'Pendiente'}</span></div>
              <div><strong>Entrega</strong><span>{pedidoAbierto.direccion_envio}</span></div>
              <div><strong>Pago preferido</strong><span>{pedidoAbierto.metodo_pago_preferido}</span></div>
              {pedidoAbierto.email && <div><strong>Correo</strong><span>{pedidoAbierto.email}</span></div>}
            </div>

            {CON_RESERVA.includes(pedidoAbierto.estado) && (
              <p className="aviso-reserva">Inventario reservado hasta {fecha(pedidoAbierto.reserva_expira_en)}.</p>
            )}
            {pedidoAbierto.referencia_pago && <p className="texto-tenue">Referencia de pago: {pedidoAbierto.referencia_pago}</p>}
            {pedidoAbierto.notas && <p className="texto-tenue">Notas: {pedidoAbierto.notas}</p>}

            <div className="tabla-contenedor pedido-detalles">
              <table className="tabla">
                <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead>
                <tbody>{pedidoAbierto.detalles.map((linea) => (
                  <tr key={linea.id}><td>{linea.descripcion}</td><td>{linea.cantidad}</td><td>Q{Number(linea.precio_unitario).toFixed(2)}</td><td>Q{Number(linea.subtotal).toFixed(2)}</td></tr>
                ))}</tbody>
              </table>
            </div>
            <div className="pedido-total"><span>Total</span><strong>Q{Number(pedidoAbierto.total).toFixed(2)}</strong></div>

            {confirmandoPago && (
              <div className="confirmacion-pago">
                <div><strong>Confirmar pago recibido</strong><p>Esta acción generará la venta y descontará definitivamente el inventario.</p></div>
                <label>Referencia del pago (opcional)
                  <input value={referenciaPago} onChange={(e) => setReferenciaPago(e.target.value)} placeholder="Transferencia, recibo o comprobante" />
                </label>
                <div className="modal-acciones">
                  <button className="boton-secundario" disabled={procesando} onClick={() => setConfirmandoPago(false)}>Volver</button>
                  <button className="boton-primario" disabled={procesando} onClick={() => confirmarPago(pedidoAbierto)}><CheckCircle2 size={16} /> {procesando ? 'Confirmando…' : 'Sí, confirmar pago'}</button>
                </div>
              </div>
            )}

            {error && <p className="login-error">{error}</p>}
            {!confirmandoPago && <div className="modal-acciones pedido-acciones">
              {CON_RESERVA.includes(pedidoAbierto.estado) && <button className="boton-primario" disabled={procesando} onClick={() => contactar(pedidoAbierto)}><MessageCircle size={16} /> Abrir WhatsApp</button>}
              {pedidoAbierto.estado === 'nuevo' && <button className="boton-secundario" disabled={procesando} onClick={() => ejecutar(() => api.pedidos.contactar(pedidoAbierto.id))}><UserCheck size={16} /> Marcar como contactado</button>}
              {['contactado', 'esperando_pago'].includes(pedidoAbierto.estado) && <button className="boton-secundario" disabled={procesando} onClick={() => ejecutar(() => api.pedidos.reabrir(pedidoAbierto.id))}><RotateCcw size={16} /> Regresar a nuevo</button>}
              {['nuevo', 'contactado'].includes(pedidoAbierto.estado) && <button className="boton-secundario" disabled={procesando} onClick={() => ejecutar(() => api.pedidos.esperandoPago(pedidoAbierto.id))}><CreditCard size={16} /> Esperando pago</button>}
              {CON_RESERVA.includes(pedidoAbierto.estado) && <button className="boton-primario" disabled={procesando} onClick={() => setConfirmandoPago(true)}><CheckCircle2 size={16} /> Confirmar pago</button>}
              {CON_RESERVA.includes(pedidoAbierto.estado) && <button className="boton-secundario accion-peligro" disabled={procesando} onClick={() => cancelar(pedidoAbierto)}><Ban size={16} /> Cancelar</button>}
              {pedidoAbierto.estado === 'pagado' && <button className="boton-primario" disabled={procesando} onClick={() => ejecutar(() => api.pedidos.preparar(pedidoAbierto.id))}><PackageCheck size={16} /> Preparar pedido</button>}
              {['pagado', 'preparando'].includes(pedidoAbierto.estado) && <button className="boton-primario" disabled={procesando} onClick={() => ejecutar(() => api.pedidos.entregar(pedidoAbierto.id))}><Truck size={16} /> Marcar entregado</button>}
            </div>}
          </div>
        </div>
      )}
    </div>
  );
}
