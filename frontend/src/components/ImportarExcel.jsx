import { useRef, useState } from 'react';
import { Upload, X, CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * Botón de importación desde Excel, reutilizable.
 * Props:
 *  - onImportar: (archivo) => Promise<{ total, creados, actualizados?, creadas?, errores }>
 *  - alTerminar: () => void  (para recargar la lista tras importar)
 *  - columnas: string[]  (nombres de columnas esperadas, solo informativo)
 */
export default function ImportarExcel({ onImportar, alTerminar, columnas = [] }) {
  const inputRef = useRef(null);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  async function manejarArchivo(e) {
    const archivo = e.target.files[0];
    if (!archivo) return;
    setCargando(true);
    setError('');
    setResultado(null);
    try {
      const res = await onImportar(archivo);
      setResultado(res);
      alTerminar?.();
    } catch (err) {
      setError(err.message || 'No se pudo importar el archivo');
    } finally {
      setCargando(false);
      e.target.value = '';
    }
  }

  return (
    <>
      <button
        type="button"
        className="boton-secundario"
        onClick={() => inputRef.current?.click()}
        disabled={cargando}
        title={columnas.length ? `Columnas esperadas: ${columnas.join(', ')}` : undefined}
      >
        <Upload size={16} strokeWidth={2} /> {cargando ? 'Importando…' : 'Importar Excel'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={manejarArchivo}
      />

      {(resultado || error) && (
        <div className="modal-fondo" onClick={() => { setResultado(null); setError(''); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-encabezado">
              <h2>Resultado de la importación</h2>
              <button className="modal-cerrar" onClick={() => { setResultado(null); setError(''); }}><X size={18} /></button>
            </div>

            {error && (
              <p className="login-error" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <AlertCircle size={16} strokeWidth={2} /> {error}
              </p>
            )}

            {resultado && (
              <>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--color-success)', marginBottom: 12 }}>
                  <CheckCircle2 size={18} strokeWidth={2} />
                  <span>{resultado.total} fila{resultado.total !== 1 ? 's' : ''} procesada{resultado.total !== 1 ? 's' : ''}</span>
                </div>
                <ul style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 14, color: 'var(--color-text-muted)' }}>
                  {resultado.creados !== undefined && <li>{resultado.creados} creado{resultado.creados !== 1 ? 's' : ''}</li>}
                  {resultado.creadas !== undefined && <li>{resultado.creadas} creada{resultado.creadas !== 1 ? 's' : ''}</li>}
                  {resultado.actualizados !== undefined && <li>{resultado.actualizados} actualizado{resultado.actualizados !== 1 ? 's' : ''}</li>}
                </ul>
                {resultado.errores?.length > 0 && (
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-danger)', marginBottom: 6 }}>
                      {resultado.errores.length} fila{resultado.errores.length !== 1 ? 's' : ''} con problemas:
                    </p>
                    <ul style={{ maxHeight: 180, overflowY: 'auto', fontSize: 13, color: 'var(--color-text-muted)', paddingLeft: 18, margin: 0 }}>
                      {resultado.errores.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}
              </>
            )}

            <div className="modal-acciones">
              <button type="button" className="boton-primario" onClick={() => { setResultado(null); setError(''); }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
