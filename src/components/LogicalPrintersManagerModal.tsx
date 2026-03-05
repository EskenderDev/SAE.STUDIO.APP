import { useEffect, useMemo, useState } from "react";
import { labelsApi, createLabelsApi } from "@/lib/api/client";
import type { LogicalPrinterDto, UpsertLogicalPrinterRequest } from "@/lib/api/client";

interface LogicalPrintersManagerModalProps {
  onClose: () => void;
  apiBaseUrl?: string;
}

// ─── Label presets (same as LabelWorkbench) ──────────────────────────────────
interface LabelPreset { id: string; name: string; widthMm: number; heightMm: number; description: string; }
const LABEL_PRESETS: LabelPreset[] = [
  { id: "custom",           name: "Personalizado",        widthMm: 0,      heightMm: 0,    description: "El documento manda el tamaño" },
  { id: "avery-5160",       name: "Avery 5160 (Dirección)",widthMm: 66.7,  heightMm: 25.4, description: "30 etiquetas por hoja" },
  { id: "avery-5163",       name: "Avery 5163 (Envío)",   widthMm: 101.6,  heightMm: 50.8, description: "10 etiquetas por hoja" },
  { id: "avery-5164",       name: "Avery 5164 (Envío)",   widthMm: 101.6,  heightMm: 84.7, description: "6 etiquetas por hoja" },
  { id: "dymo-30252",       name: "DYMO 30252 (Dirección)",widthMm: 54,    heightMm: 25,   description: "Rollo DYMO" },
  { id: "brother-dk-11201", name: "Brother DK-11201",     widthMm: 29,     heightMm: 90,   description: "Rollo Brother" },
  { id: "zebra-4x6",        name: "Zebra 4×6 Envío",      widthMm: 101.6,  heightMm: 152.4,description: "Rollo Zebra estándar" },
];

// ─── Styles ──────────────────────────────────────────────────────────────────
const FL: React.CSSProperties = {
  display: 'block', margin: 0, fontSize: '0.75rem', fontWeight: 700,
  color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em',
  marginBottom: '0.3rem',
};
const INP: React.CSSProperties = {
  display: 'block', width: '100%', padding: '0.6rem 0.75rem', boxSizing: 'border-box',
  borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface-alt, #f8fafc)',
  color: 'var(--text)',
  fontSize: '0.88rem', transition: 'border-color 0.2s, box-shadow 0.2s', outline: 'none',
};
const FIELD_GRID: React.CSSProperties = { display: 'grid', gap: '0.85rem' };

// ─── Toggle component (self-contained) ──────────────────────────────────────
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="toggleLabel" style={{ cursor: 'pointer' }}>
      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}>{label}</span>
      <span
        className="toggleTrack"
        data-checked={String(checked)}
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onKeyDown={e => (e.key === ' ' || e.key === 'Enter') && onChange(!checked)}
        style={{ cursor: 'pointer' }}
      >
        <span className="toggleThumb" />
      </span>
    </label>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
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

  // Extended form: labelPresetId for label type
  type FormState = UpsertLogicalPrinterRequest & { labelPresetId?: string };

  const emptyForm = (): FormState => ({
    name: "", description: "", physicalPrinter: "",
    isActive: true, copies: 1,
    paperWidth: undefined,   // optional — undefined = let document control
    mediaType: "receipt",
    labelPresetId: "custom",
  });

  const [form, setForm] = useState<FormState>(emptyForm());

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
      paperWidth: printer.paperWidth ?? undefined,
      mediaType: printer.mediaType ?? "receipt",
      labelPresetId: "custom",
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
      // Build final payload: strip labelPresetId, resolve paperWidth
      const { labelPresetId, ...rest } = form;
      let finalWidth = rest.paperWidth;

      if (form.mediaType === 'label') {
        const preset = LABEL_PRESETS.find(p => p.id === labelPresetId);
        if (preset && preset.widthMm > 0) {
          finalWidth = Math.round(preset.widthMm);
        } else {
          finalWidth = undefined; // custom => doc controls
        }
      }

      await api.upsertLogicalPrinter({ ...rest, paperWidth: finalWidth });
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (editingId) { setEditingId(null); setError(null); }
        else { onClose(); }
      }
      if (e.key === 'Enter') {
        const tag = (e.target as HTMLElement)?.tagName?.toUpperCase();
        if (tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (editingId) { e.preventDefault(); void handleSave(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editingId, onClose]);

  const mediaBadge = (t?: string) => t === "label"
    ? { bg: "var(--info-bg, #dbeafe)", color: "var(--info-text, #1e40af)", text: "Etiqueta" }
    : { bg: "var(--success-bg, #d1fae5)", color: "var(--success-text, #065f46)", text: "Tiquete" };

  const isLabel = form.mediaType === 'label';

  return (
    <div className="modalBackdrop" style={{ zIndex: 3000 }}>
      <div
        className="modalCard"
        style={{ width: '660px', maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
              <path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
            </svg>
            Impresoras Lógicas
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="closeBtn"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', borderRadius: '6px', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
            title="Cerrar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {error && (
          <div style={{ padding: '0.7rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {error}
          </div>
        )}

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {loading && !printers.length ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>Cargando impresoras...</div>
          ) : editingId ? (

            /* ── EDIT / NEW FORM ── */
            <div className="lpFormCard" style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '1.25rem', background: 'var(--surface, #fafafa)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <div style={{ width: 6, height: 20, background: 'var(--accent)', borderRadius: 3 }} />
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                  {editingId === 'new' ? 'Nueva Impresora' : 'Editar Impresora'}
                </h4>
              </div>

              <div style={FIELD_GRID}>
                {/* Row 1: Nombre + Descripción */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <span style={FL}>Nombre Lógico *</span>
                    <input style={INP} value={form.name} placeholder="Ej. Cocina, Barra..."
                      onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                      onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                      onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div>
                    <span style={FL}>Descripción</span>
                    <input style={INP} value={form.description || ''} placeholder="Opcional"
                      onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                      onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                      onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                  </div>
                </div>

                {/* Row 2: Impresora física */}
                <div>
                  <span style={FL}>Impresora Física *</span>
                  <select style={{ ...INP, marginBottom: '0.4rem' }} value={form.physicalPrinter}
                    onChange={e => { if (e.target.value) setForm(p => ({ ...p, physicalPrinter: e.target.value })); }}>
                    {sysPrintersLoading ? (
                      <option value="">Cargando impresoras del sistema...</option>
                    ) : sysPrintersError || systemPrinters.length === 0 ? (
                      <option value="">No disponibles — escribe abajo</option>
                    ) : (
                      <>
                        <option value="">— Seleccionar del sistema —</option>
                        {systemPrinters.map(p => <option key={p} value={p}>{p}</option>)}
                      </>
                    )}
                  </select>
                  <input style={INP} value={form.physicalPrinter}
                    placeholder="O escribe el nombre exacto en Windows"
                    onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                    onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    onChange={e => setForm(p => ({ ...p, physicalPrinter: e.target.value }))} />
                  {sysPrintersError && (
                    <span style={{ fontSize: '0.72rem', color: '#b45309', marginTop: '0.25rem', display: 'block' }}>{sysPrintersError}</span>
                  )}
                </div>

                {/* Row 3: Tipo de medio + Copias */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'start' }}>
                  <div>
                    <span style={FL}>Tipo de Medio</span>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem' }}>
                      {[
                        { value: 'receipt', icon: '🧾', label: 'Tiquete' },
                        { value: 'label',   icon: '🏷️', label: 'Etiqueta' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setForm(p => ({ ...p, mediaType: opt.value, paperWidth: undefined, labelPresetId: 'custom' }))}
                          style={{
                            flex: 1, padding: '0.65rem 0.5rem', borderRadius: 8, cursor: 'pointer',
                            border: `2px solid ${form.mediaType === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                            background: form.mediaType === opt.value ? 'var(--bg-subtle, rgba(15,118,110,0.07))' : 'var(--surface, #fff)',
                            color: form.mediaType === opt.value ? 'var(--accent)' : 'var(--text-muted, #64748b)',
                            fontWeight: form.mediaType === opt.value ? 700 : 500,
                            fontSize: '0.82rem', transition: 'all 0.15s',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
                          }}
                        >
                          <span style={{ fontSize: '1.1rem' }}>{opt.icon}</span>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span style={FL}>Copias</span>
                    <input type="number" style={{ ...INP, width: '80px' }} min={1} max={99} value={form.copies || 1}
                      onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                      onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                      onChange={e => setForm(p => ({ ...p, copies: Math.max(1, parseInt(e.target.value) || 1) }))} />
                  </div>
                </div>

                {/* Row 4: Paper width — context-aware */}
                {!isLabel ? (
                  /* Receipt: fixed width preset OR custom value */
                  <div>
                    <span style={FL}>Ancho de Papel</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.3rem' }}>
                      {[
                        { value: 80, label: '80 mm', sub: '42 columnas' },
                        { value: 58, label: '58 mm', sub: '32 columnas' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setForm(p => ({ ...p, paperWidth: opt.value }))}
                          style={{
                            padding: '0.6rem 0.75rem', borderRadius: 8, cursor: 'pointer',
                            border: `2px solid ${form.paperWidth === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                            background: form.paperWidth === opt.value ? 'var(--bg-subtle, rgba(15,118,110,0.07))' : 'var(--surface, #fff)',
                            color: form.paperWidth === opt.value ? 'var(--accent)' : 'var(--text)',
                            fontWeight: form.paperWidth === opt.value ? 700 : 500,
                            fontSize: '0.85rem', transition: 'all 0.15s', textAlign: 'center',
                          }}
                        >
                          <div>{opt.label}</div>
                          <div style={{ fontSize: '0.7rem', opacity: 0.65 }}>{opt.sub}</div>
                        </button>
                      ))}
                    </div>
                    <label className="customCheckbox" style={{ marginTop: '0.5rem', fontSize: '0.78rem' }}>
                      <input type="checkbox"
                        checked={form.paperWidth === undefined}
                        onChange={e => setForm(p => ({ ...p, paperWidth: e.target.checked ? undefined : 80 }))}
                      />
                      Sin restricción de ancho (el documento manda el tamaño)
                    </label>
                  </div>
                ) : (
                  /* Label: choose from presets */
                  <div>
                    <span style={FL}>Tamaño de Etiqueta</span>
                    <select style={{ ...INP, marginTop: '0.3rem' }} value={form.labelPresetId || 'custom'}
                      onChange={e => setForm(p => ({ ...p, labelPresetId: e.target.value }))}>
                      {LABEL_PRESETS.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}{p.widthMm > 0 ? ` — ${p.widthMm}×${p.heightMm} mm` : ''}
                        </option>
                      ))}
                    </select>
                    {form.labelPresetId === 'custom' ? (
                      <div className="lpInfoBox success" style={{ marginTop: '0.4rem', padding: '0.5rem 0.75rem', background: 'var(--success-bg, #f0fdf4)', borderRadius: 6, fontSize: '0.75rem', color: 'var(--success-text, #166534)', border: '1px solid var(--success-border, #bbf7d0)' }}>
                        📄 El tamaño lo controla el documento a imprimir
                      </div>
                    ) : (
                      <div className="lpInfoBox info" style={{ marginTop: '0.4rem', padding: '0.5rem 0.75rem', background: 'var(--info-bg, #eff6ff)', borderRadius: 6, fontSize: '0.75rem', color: 'var(--info-text, #1e40af)', border: '1px solid var(--info-border, #bfdbfe)' }}>
                        📐 {LABEL_PRESETS.find(p => p.id === form.labelPresetId)?.description}
                      </div>
                    )}
                  </div>
                )}

                {/* Row 5: Activa toggle */}
                <div style={{ paddingTop: '0.25rem', borderTop: '1px solid var(--border)' }}>
                  <Toggle
                    checked={form.isActive}
                    onChange={v => setForm(p => ({ ...p, isActive: v }))}
                    label="Impresora Activa"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" className="secondary" onClick={() => { setEditingId(null); setError(null); }}>Cancelar</button>
                <button type="button" className="primary" onClick={handleSave}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 4 }}><polyline points="20 6 9 17 4 12"/></svg>
                  Guardar
                </button>
              </div>
            </div>

          ) : (
            /* ── LIST VIEW ── */
            <>
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0 0 0.5rem', lineHeight: '1.4' }}>
                Asocia nombres lógicos (ej. "Cocina", "Barra") a impresoras físicas. Se usan como alias para impresión remota.
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" className="primary" onClick={handleAddNew}
                  style={{ fontSize: '0.85rem', padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: 10 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Añadir Impresora
                </button>
              </div>

              {printers.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)', background: '#f8fafc', borderRadius: '10px', border: '1px dashed var(--border)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🖨️</div>
                  No hay impresoras lógicas configuradas aún.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '0.6rem' }}>
                  {printers.map(printer => {
                    const badge = mediaBadge(printer.mediaType);
                    return (
                      <div className="lpPrinterItem" key={printer.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.9rem 1.1rem', background: 'var(--surface, #fff)', borderRadius: '12px',
                        border: '1px solid var(--border)', boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                        transition: 'all 0.2s', gap: '0.75rem'
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.9rem' }}>
                            {printer.name}
                            <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem', background: badge.bg, color: badge.color, borderRadius: '99px', fontWeight: 700 }}>
                              {badge.text}
                            </span>
                            {!printer.isActive && (
                              <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.4rem', background: '#fee2e2', color: '#991b1b', borderRadius: '4px', fontWeight: 700 }}>Inactiva</span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            <span>🖨 <strong>{printer.physicalPrinter}</strong></span>
                            {printer.paperWidth
                              ? <span>{printer.paperWidth}mm</span>
                              : <span style={{ fontStyle: 'italic' }}>ancho libre</span>
                            }
                            <span>{printer.copies ?? 1} copia{(printer.copies ?? 1) > 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                          <button type="button" className="secondary" style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem' }} onClick={() => handleEdit(printer)}>Editar</button>
                          <button type="button" className="danger" style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem' }} onClick={() => handleDelete(printer.id)}>Eliminar</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
