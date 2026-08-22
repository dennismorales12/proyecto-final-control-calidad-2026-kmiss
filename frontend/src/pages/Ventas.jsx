import { useEffect, useState } from 'react';
import { BarChart3, Ban, CalendarRange, Package, Plus, ReceiptText, ShoppingCart, Trash2, TrendingUp, Users, X } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function Ventas() {
  const [ventas, setVentas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [fechaFiltro, setFechaFiltro] = useState(new Date().toISOString().split('T')[0]);
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [mesDashboard, setMesDashboard] = useState(new Date().toISOString().slice(0, 7));
  const [dashboard, setDashboard] = useState(null);
  const [cargandoDashboard, setCargandoDashboard] = useState(true);

  // Estado del carrito
  const [carrito, setCarrito] = useState([]);
  const [pacienteId, setPacienteId] = useState('');
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [descuento, setDescuento] = useState(0);
  const [itemSeleccionado, setItemSeleccionado] = useState('');
  const [cantidadSeleccionada, setCantidadSeleccionada] = useState(1);
  const [error, setError] = useState('');

  const { usuario } = useAuth();
  const puedeVender = ['administrador', 'recepcion'].includes(usuario?.rol);

  async function cargarVentas(fecha) {
    setCargando(true);
    try {
      setVentas(await api.ventas.listar(fecha ? { fecha } : {}));
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  }

  async function cargarDashboard(mes = mesDashboard) {
    setCargandoDashboard(true);
    try {
      setDashboard(await api.ventas.dashboard(mes));
    } catch (err) {
      console.error(err);
    } finally {
      setCargandoDashboard(false);
    }
  }

  useEffect(() => {
    cargarVentas(fechaFiltro);
    cargarDashboard(mesDashboard);
    api.productos.listar().then((p) => setProductos(p.filter((x) => x.activo))).catch(console.error);
    api.servicios.listar().then((s) => setServicios(s.filter((x) => x.activo))).catch(console.error);
    api.pacientes.listar().then(setPacientes).catch(console.error);
  }, []);

  useEffect(() => { cargarVentas(fechaFiltro); }, [fechaFiltro]);
  useEffect(() => { cargarDashboard(mesDashboard); }, [mesDashboard]);

  function abrirNuevaVenta() {
    setCarrito([]);
    setPacienteId('');
    setMetodoPago('efectivo');
    setDescuento(0);
    setItemSeleccionado('');
    setCantidadSeleccionada(1);
    setError('');
    setModalAbierto(true);
  }

  function agregarAlCarrito() {
    if (!itemSeleccionado) return;
    const [tipo, id] = itemSeleccionado.split(':');
    const origen = tipo === 'producto' ? productos : servicios;
    const item = origen.find((x) => String(x.id) === id);
    if (!item) return;

    setCarrito((prev) => [
      ...prev,
      {
        clave: `${tipo}-${id}-${Date.now()}`,
        producto_id: tipo === 'producto' ? item.id : null,
        servicio_id: tipo === 'servicio' ? item.id : null,
        descripcion: item.nombre,
        cantidad: cantidadSeleccionada,
        precio_unitario: Number(item.precio),
      },
    ]);
    setItemSeleccionado('');
    setCantidadSeleccionada(1);
  }

  function quitarDelCarrito(clave) {
    setCarrito((prev) => prev.filter((i) => i.clave !== clave));
  }

  const subtotal = carrito.reduce((acc, i) => acc + i.cantidad * i.precio_unitario, 0);
  const total = Math.max(subtotal - (Number(descuento) || 0), 0);

  async function confirmarVenta() {
    setError('');
    if (carrito.length === 0) {
      setError('Agrega al menos un producto o servicio al carrito');
      return;
    }
    try {
      await api.ventas.crear({
        paciente_id: pacienteId || null,
        metodo_pago: metodoPago,
        descuento: Number(descuento) || 0,
        items: carrito.map(({ producto_id, servicio_id, descripcion, cantidad, precio_unitario }) =>
          ({ producto_id, servicio_id, descripcion, cantidad, precio_unitario })),
      });
      setModalAbierto(false);
      cargarVentas(fechaFiltro);
      cargarDashboard(mesDashboard);
    } catch (err) {
      setError(err.message);
    }
  }

  async function anularVenta(id) {
    if (!confirm('¿Anular esta venta? El stock de productos se restituirá.')) return;
    try {
      await api.ventas.anular(id);
      cargarVentas(fechaFiltro);
      cargarDashboard(mesDashboard);
    } catch (err) {
      alert(err.message);
    }
  }

  const maximoDia = Math.max(1, ...(dashboard?.dias || []).map((dia) => Number(dia.total)));
  const maximoProducto = Math.max(1, ...(dashboard?.productos || []).map((producto) => Number(producto.unidades)));
  const maximoCliente = Math.max(1, ...(dashboard?.clientes || []).map((cliente) => Number(cliente.total)));
  const nombreMes = new Date(`${mesDashboard}-01T12:00:00`).toLocaleDateString('es-GT', { month: 'long', year: 'numeric' });

  return (
    <div className="pagina">
      <header className="pagina-encabezado">
        <div>
          <h1>Ventas</h1>
          <p>{ventas.length} venta{ventas.length !== 1 ? 's' : ''} en la fecha seleccionada</p>
        </div>
        {puedeVender && (
          <button className="boton-primario" onClick={abrirNuevaVenta}>
            <ShoppingCart size={17} strokeWidth={2} /> Nueva venta
          </button>
        )}
      </header>

      <section className="ventas-dashboard">
        <div className="ventas-dashboard-encabezado">
          <div><h2>Resumen de ventas</h2><p>Resultados de {nombreMes}</p></div>
          <label><CalendarRange size={16} /><input type="month" value={mesDashboard} onChange={(e) => setMesDashboard(e.target.value)} /></label>
        </div>

        {cargandoDashboard || !dashboard ? <p className="texto-vacio">Calculando indicadores…</p> : <>
          <div className="ventas-indicadores">
            <article><span><TrendingUp size={17} /> Ventas del mes</span><strong>Q{Number(dashboard.resumen.total_mes).toFixed(2)}</strong></article>
            <article><span><ReceiptText size={17} /> Operaciones</span><strong>{dashboard.resumen.cantidad_ventas}</strong></article>
            <article><span><BarChart3 size={17} /> Ticket promedio</span><strong>Q{Number(dashboard.resumen.ticket_promedio).toFixed(2)}</strong></article>
            <article><span><Users size={17} /> Clientes</span><strong>{dashboard.resumen.clientes}</strong></article>
          </div>

          <div className="ventas-panel ventas-tendencia">
            <div className="ventas-panel-titulo"><div><h3>Comportamiento diario</h3><p>Ingresos confirmados por día</p></div></div>
            <div className="ventas-grafico">
              {dashboard.dias.map((dia) => {
                const numero = Number(dia.fecha.slice(-2));
                return <div className="ventas-grafico-dia" key={dia.fecha} title={`${dia.fecha}: Q${Number(dia.total).toFixed(2)} · ${dia.ventas} venta(s)`}>
                  <div className="ventas-grafico-barra" style={{ height: `${Math.max(Number(dia.total) > 0 ? 8 : 2, (Number(dia.total) / maximoDia) * 100)}%` }}></div>
                  <span>{numero === 1 || numero % 5 === 0 ? numero : ''}</span>
                </div>;
              })}
            </div>
          </div>

          <div className="ventas-ranking-grid">
            <div className="ventas-panel">
              <div className="ventas-panel-titulo"><div><h3><Package size={16} /> Productos más vendidos</h3><p>Por unidades durante el mes</p></div></div>
              {dashboard.productos.length === 0 ? <p className="texto-vacio">Sin productos vendidos.</p> : <div className="ventas-ranking">{dashboard.productos.map((producto, indice) => <div key={producto.producto_id}>
                <span className="ventas-posicion">{indice + 1}</span><div><strong>{producto.descripcion}</strong><span>{producto.unidades} unidades · Q{Number(producto.importe).toFixed(2)}</span><i style={{ width: `${(Number(producto.unidades) / maximoProducto) * 100}%` }} /></div>
              </div>)}</div>}
            </div>

            <div className="ventas-panel">
              <div className="ventas-panel-titulo"><div><h3><Users size={16} /> Clientes con mayor compra</h3><p>Por total comprado durante el mes</p></div></div>
              {dashboard.clientes.length === 0 ? <p className="texto-vacio">Sin ventas asociadas a clientes.</p> : <div className="ventas-ranking">{dashboard.clientes.map((cliente, indice) => <div key={cliente.id}>
                <span className="ventas-posicion">{indice + 1}</span><div><strong>{cliente.nombre_completo}</strong><span>{cliente.compras} compra(s) · Q{Number(cliente.total).toFixed(2)}</span><i style={{ width: `${(Number(cliente.total) / maximoCliente) * 100}%` }} /></div>
              </div>)}</div>}
            </div>

            <div className="ventas-panel">
              <div className="ventas-panel-titulo"><div><h3><ReceiptText size={16} /> Métodos de pago</h3><p>Distribución de ingresos</p></div></div>
              {dashboard.metodos.length === 0 ? <p className="texto-vacio">Sin movimientos en el mes.</p> : <div className="ventas-metodos">{dashboard.metodos.map((metodo) => <div key={metodo.metodo_pago}><span>{metodo.metodo_pago}</span><strong>Q{Number(metodo.total).toFixed(2)}</strong><small>{metodo.ventas} venta(s)</small></div>)}</div>}
            </div>
          </div>
        </>}
      </section>

      <div className="ventas-detalle-titulo"><div><h2>Detalle de ventas</h2><p>Consulta las operaciones de una fecha específica</p></div></div>

      <div className="barra-busqueda">
        <input type="date" value={fechaFiltro} onChange={(e) => setFechaFiltro(e.target.value)} />
      </div>

      <div className="tabla-contenedor">
        {cargando ? (
          <p className="texto-vacio">Cargando…</p>
        ) : ventas.length === 0 ? (
          <p className="texto-vacio">No hay ventas para esta fecha.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Hora</th>
                <th>Paciente</th>
                <th>Vendido por</th>
                <th>Método</th>
                <th>Total</th>
                <th>Estado</th>
                {usuario?.rol === 'administrador' && <th></th>}
              </tr>
            </thead>
            <tbody>
              {ventas.map((v) => (
                <tr key={v.id}>
                  <td>{new Date(v.creado_en).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td>{v.paciente_nombre || <span className="texto-tenue">Sin asociar</span>}</td>
                  <td className="texto-tenue">{v.vendedor_nombre}</td>
                  <td className="texto-tenue" style={{ textTransform: 'capitalize' }}>{v.metodo_pago}</td>
                  <td>Q{Number(v.total).toFixed(2)}</td>
                  <td>
                    <span className={`etiqueta-estado ${v.estado === 'anulada' ? 'estado-cancelada' : 'estado-atendida'}`}>
                      {v.estado === 'anulada' ? 'Anulada' : 'Completada'}
                    </span>
                  </td>
                  {usuario?.rol === 'administrador' && (
                    <td className="tabla-acciones">
                      {v.estado !== 'anulada' && (
                        <button onClick={() => anularVenta(v.id)} title="Anular" className="boton-peligro">
                          <Ban size={16} strokeWidth={1.75} />
                        </button>
                      )}
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
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-encabezado">
              <h2>Nueva venta</h2>
              <button className="modal-cerrar" onClick={() => setModalAbierto(false)}><X size={18} /></button>
            </div>

            <div className="formulario-grid">
              <label className="campo-ancho">Paciente (opcional)
                <select value={pacienteId} onChange={(e) => setPacienteId(e.target.value)}>
                  <option value="">Venta sin asociar a paciente</option>
                  {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nombre_completo}</option>)}
                </select>
              </label>

              <label>Agregar producto o servicio
                <select value={itemSeleccionado} onChange={(e) => setItemSeleccionado(e.target.value)}>
                  <option value="">Selecciona…</option>
                  {productos.length > 0 && (
                    <optgroup label="Productos">
                      {productos.map((p) => (
                        <option key={`producto:${p.id}`} value={`producto:${p.id}`}>
                          {p.nombre} — Q{Number(p.precio).toFixed(2)} (stock: {p.stock_actual})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {servicios.length > 0 && (
                    <optgroup label="Servicios">
                      {servicios.map((s) => (
                        <option key={`servicio:${s.id}`} value={`servicio:${s.id}`}>
                          {s.nombre} — Q{Number(s.precio).toFixed(2)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>

              <label>Cantidad
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="number" min="1" value={cantidadSeleccionada}
                    onChange={(e) => setCantidadSeleccionada(Number(e.target.value))} style={{ flex: 1 }} />
                  <button type="button" className="boton-secundario" onClick={agregarAlCarrito}>
                    <Plus size={15} strokeWidth={2} />
                  </button>
                </div>
              </label>
            </div>

            <div style={{ marginTop: 16, marginBottom: 16 }}>
              {carrito.length === 0 ? (
                <p className="texto-vacio" style={{ padding: '12px 0' }}>El carrito está vacío.</p>
              ) : (
                <table className="tabla" style={{ boxShadow: 'none', border: '1px solid var(--color-border)', borderRadius: 8 }}>
                  <thead>
                    <tr><th>Artículo</th><th>Cant.</th><th>Precio</th><th>Subtotal</th><th></th></tr>
                  </thead>
                  <tbody>
                    {carrito.map((item) => (
                      <tr key={item.clave}>
                        <td>{item.descripcion}</td>
                        <td>{item.cantidad}</td>
                        <td>Q{item.precio_unitario.toFixed(2)}</td>
                        <td>Q{(item.cantidad * item.precio_unitario).toFixed(2)}</td>
                        <td className="tabla-acciones">
                          <button onClick={() => quitarDelCarrito(item.clave)} className="boton-peligro">
                            <Trash2 size={14} strokeWidth={1.75} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="formulario-grid">
              <label>Método de pago
                <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="transferencia">Transferencia</option>
                </select>
              </label>
              <label>Descuento (Q)
                <input type="number" min="0" step="0.01" value={descuento}
                  onChange={(e) => setDescuento(e.target.value)} />
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', borderTop: '1px solid var(--color-border)', marginTop: 8 }}>
              <span style={{ fontWeight: 600, color: 'var(--color-primary)', fontFamily: 'var(--fuente-display)', fontSize: 18 }}>Total</span>
              <span style={{ fontFamily: 'var(--fuente-datos)', fontWeight: 600, fontSize: 20, color: 'var(--color-primary)' }}>Q{total.toFixed(2)}</span>
            </div>

            {error && <p className="login-error">{error}</p>}

            <div className="modal-acciones">
              <button type="button" className="boton-secundario" onClick={() => setModalAbierto(false)}>Cancelar</button>
              <button type="button" className="boton-primario" onClick={confirmarVenta}>Confirmar venta</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
