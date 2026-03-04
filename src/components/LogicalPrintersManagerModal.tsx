import { useEffect, useMemo, useState } from "react";
import { labelsApi, createLabelsApi } from "@/lib/api/client";
import type { LogicalPrinterDto, UpsertLogicalPrinterRequest } from "@/lib/api/client";

interface LogicalPrintersManagerModalProps {
  onClose: () => void;
  apiBaseUrl?: string;
}

const labelStyle: React.CSSProperties = {
  display: 'block', margin: 0, fontSize: '0.85rem', fontWeight: 500
};
const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', marginTop: '0.4rem', padding: '0.5rem', boxSizing: 'border-box'
};

export default function LogicalPrintersManagerModal({ onClose, apiBaseUrl }: LogicalPrintersManagerModalProps) {
  const api = useMemo(
    () => (apiBaseUrl ? createLabelsApi(apiBaseUrl) : labelsApi),
    [apiBaseUrl]
  );

  const [printers, setPrinters] = useState<LogicalPrinterDto[]>([]);
  const [systemPrinters, setSystemPrinters] = useState<string[]>([]);
  const [sysPrintersLoading, setSysPrintersLoading] = useState(true);
  const [sysPrintersError, setSysPrintersError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const emptyForm = (): UpsertLogicalPrinterRequest => ({
    name: "", description: "", physicalPrinter: "",
    isActive: true, copies: 1, paperWidth: 80, mediaType: "receipt"
  });

  const [form, setForm] = useState<UpsertLogicalPrinterRequest>(emptyForm());

  const fetchData = async () => {
    setLoading(true); setSysPrintersLoading(true);
    setSysPrintersError(null); setError(null);
    try {
      const [sysPrintersResult, logPrintersResult] = await Promise.allSettled([
        api.getSystemPrinters(),
        api.getLogicalPrinters(),
      ]);
      if (sysPrintersResult.status === 'fulfilled') {
        setSystemPrinters(sysPrintersResult.value);
      } else {
        setSysPrintersError('No se pudo cargar la lista de impresoras del sistema.');
      }
      if (logPrintersResult.status === 'fulfilled') {
        setPrinters(logPrintersResult.value);
      } else {
        setError((logPrintersResult.reason as any)?.message || 'Error al cargar impresoras lógicas.');
      }
    } finally {
      setLoading(false); setSysPrintersLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [api]);

  const handleEdit = (printer: LogicalPrinterDto) => {
    setEditingId(printer.id);
    setForm({
      id: printer.id, name: printer.name, description: printer.description,
      physicalPrinter: printer.physicalPrinter, isActive: printer.isActive,
      copies: printer.copies ?? 1,
      paperWidth: printer.paperWidth ?? 80,
      mediaType: printer.mediaType ?? "receipt",
    });
  };

  const handleAddNew = () => {
    setEditingId("new");
    setForm({
      ...emptyForm(),
      physicalPrinter: systemPrinters.length > 0 ? systemPrinters[0] : "",
    });
  };

  const handleSave = async () => {
    if (!form.name || !form.physicalPrinter) {
      setError("El nombre y la impresora física son obligatorios."); return;
    }
    setError(null);
    try {
      await api.upsertLogicalPrinter(form);
      setEditingId(null);
      await fetchData();
    } catch (e: any) {
      setError(e.message || "Error al guardar la impresora.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Está seguro que desea eliminar esta impresora lógica?")) return;
    setError(null);
    try {
      await api.deleteLogicalPrinter(id);
      await fetchData();
    } catch (e: any) {
      setError(e.message || "Error al eliminar la impresora.");
    }
  };

  // Badge colors for mediaType
  const mediaBadge = (t?: string) => t === "label"
    ? { bg: "#dbeafe", color: "#1e40af", text: "Etiqueta" }
    : { bg: "#d1fae5", color: "#065f46", text: "Tiquete" };

  return (
    <div className="modalBackdrop" onClick={onClose} style={{ zIndex: 3000 }}>
      <div className="modalCard" style={{ width: '640px', maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Impresoras Lógicas
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '1rem' }}>
          Mapea nombres lógicos (ej. "Cocina") a impresoras físicas. El servidor local usará estos nombres como proxy.
        </p>

        {error && (
          <div style={{ padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {loading && !printers.length ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>Cargando impresoras...</div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {editingId ? (
              <div style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '1rem', background: 'var(--bg-card)' }}>
                <h4 style={{ margin: '0 0 1rem 0' }}>{editingId === 'new' ? 'Nueva Impresora' : 'Editar Impresora'}</h4>
                <div style={{ display: 'grid', gap: '0.75rem' }}>

                  {/* Nombre lógico */}
                  <label style={labelStyle}>Nombre Lógico
                    <input style={inputStyle} value={form.name} placeholder="Ej. Cocina, Barra..."
                      onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                  </label>

                  {/* Descripción */}
                  <label style={labelStyle}>Descripción (Opcional)
                    <input style={inputStyle} value={form.description || ''} placeholder="Ej. Impresora de cocina principal"
                      onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                  </label>

                  {/* Impresora física */}
                  <label style={labelStyle}>Impresora Física
                    <select style={inputStyle} value={form.physicalPrinter}
                      onChange={e => { if (e.target.value) setForm(p => ({ ...p, physicalPrinter: e.target.value })); }}>
                      {sysPrintersLoading ? (
                        <option value="">Cargando impresoras del sistema...</option>
                      ) : sysPrintersError || systemPrinters.length === 0 ? (
                        <option value="">No se cargaron — escribe el nombre abajo</option>
                      ) : (
                        <>
                          <option value="">-- Seleccionar del sistema --</option>
                          {systemPrinters.map(p => <option key={p} value={p}>{p}</option>)}
                        </>
                      )}
                    </select>
                    <input style={{ ...inputStyle, marginTop: '0.3rem' }} value={form.physicalPrinter}
                      placeholder="O escribe el nombre exacto en Windows"
                      onChange={e => setForm(p => ({ ...p, physicalPrinter: e.target.value }))} />
                    {sysPrintersError && (
                      <span style={{ fontSize: '0.75rem', color: '#b45309' }}>{sysPrintersError}</span>
                    )}
                  </label>

                  {/* Fila: Tipo medio + Ancho papel + Copias */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                    <label style={labelStyle}>Tipo de medio
                      <select style={inputStyle} value={form.mediaType || 'receipt'}
                        onChange={e => setForm(p => ({ ...p, mediaType: e.target.value }))}>
                        <option value="receipt">Tiquete (receipt)</option>
                        <option value="label">Etiqueta (label)</option>
                      </select>
                    </label>
                    <label style={labelStyle}>Ancho de papel
                      <select style={inputStyle} value={form.paperWidth || 80}
                        onChange={e => setForm(p => ({ ...p, paperWidth: parseInt(e.target.value) }))}>
                        <option value={80}>80 mm</option>
                        <option value={58}>58 mm</option>
                      </select>
                    </label>
                    <label style={labelStyle}>Copias
                      <input type="number" style={inputStyle} min={1} max={99} value={form.copies || 1}
                        onChange={e => setForm(p => ({ ...p, copies: Math.max(1, parseInt(e.target.value) || 1) }))} />
                    </label>
                  </div>

                  {/* Activa */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.25rem 0 0', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.isActive}
                      onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} />
                    Impresora Activa
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                  <button type="button" className="secondary" onClick={() => setEditingId(null)}>Cancelar</button>
                  <button type="button" className="primary" onClick={handleSave}>Guardar</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="button" className="primary" onClick={handleAddNew}
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>+ Nueva Impresora</button>
                </div>

                {printers.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', background: 'var(--bg-subtle)', borderRadius: '6px' }}>
                    No hay impresoras lógicas configuradas.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {printers.map(printer => {
                      const badge = mediaBadge(printer.mediaType);
                      return (
                        <div key={printer.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--bg-subtle)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                          <div>
                            <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              {printer.name}
                              <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', background: badge.bg, color: badge.color, borderRadius: '99px' }}>
                                {badge.text}
                              </span>
                              {!printer.isActive && (
                                <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.3rem', background: '#fee2e2', color: '#991b1b', borderRadius: '4px' }}>Inactiva</span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.2rem', display: 'flex', gap: '1rem' }}>
                              <span>Física: <strong>{printer.physicalPrinter}</strong></span>
                              <span>{printer.paperWidth ?? 80}mm</span>
                              <span>{printer.copies ?? 1} copia{(printer.copies ?? 1) > 1 ? 's' : ''}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button type="button" className="secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={() => handleEdit(printer)}>Editar</button>
                            <button type="button" className="danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={() => handleDelete(printer.id)}>Eliminar</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="modalActions" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
          <button type="button" className="secondary" onClick={onClose} disabled={!!editingId}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
