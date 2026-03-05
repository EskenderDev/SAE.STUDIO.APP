import { useEffect, useMemo, useState } from "react";
import { labelsApi, createLabelsApi } from "@/lib/api/client";
import type { LogicalPrinterDto, UpsertLogicalPrinterRequest, PhysicalPrinterConfig } from "@/lib/api/client";

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

// ─── Search Modal component ──────────────────────────────────────────────────
function PrinterSearchModal({ 
  onClose, 
  onSelect, 
  availablePrinters 
}: { 
  onClose: () => void; 
  onSelect: (p: string) => void; 
  availablePrinters: string[] 
}) {
  const [search, setSearch] = useState("");
  const filtered = availablePrinters.filter(p => p.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="modalBackdrop" style={{ zIndex: 4000, background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="modalCard" style={{ width: '400px', padding: '1.25rem' }} onClick={e => e.stopPropagation()}>
        <h4 style={{ margin: '0 0 1rem 0' }}>Buscar Impresora</h4>
        <input 
          autoFocus
          style={INP} 
          placeholder="Escribe para buscar..." 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
        />
        <div style={{ maxHeight: '300px', overflowY: 'auto', marginTop: '0.75rem', border: '1px solid var(--border)', borderRadius: '8px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>No se encontraron impresoras.</div>
          ) : (
            filtered.map(p => (
              <button
                key={p}
                className="printerSearchItem"
                style={{
                  display: 'block', width: '100%', padding: '0.75rem 1rem', background: 'none',
                  border: 'none', textAlign: 'left', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                  fontSize: '0.85rem', transition: 'background 0.2s', color: 'var(--text)'
                }}
                onClick={() => { onSelect(p); onClose(); }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle, #f1f5f9)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                {p}
              </button>
            ))
          )}
        </div>
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Size Selector Modal ──────────────────────────────────────────────────
function SizeSelectorModal({ 
  onClose, 
  onSelect, 
  mediaType,
  currentValue,
  isPrinterSpecific
}: { 
  onClose: () => void; 
  onSelect: (val: number | undefined) => void; 
  mediaType: "receipt" | "label";
  currentValue?: number;
  isPrinterSpecific?: boolean;
}) {
  const isLabel = mediaType === "label";

  return (
    <div className="modalBackdrop" style={{ zIndex: 4000, background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="modalCard" style={{ width: '450px', padding: '1.25rem' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h4 style={{ margin: 0 }}>Seleccionar {isLabel ? 'Tamaño de Etiqueta' : 'Ancho de Papel'}</h4>
            {isPrinterSpecific && <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Configuración específica para esta impresora</span>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ display: 'grid', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto', padding: '0.25rem' }}>
          {isPrinterSpecific && (
            <button
              className="sizeSelectItem"
              style={{
                display: 'flex', flexDirection: 'column', gap: '0.2rem', padding: '0.85rem 1rem',
                background: currentValue === undefined ? 'var(--accent-light, rgba(15,118,110,0.1))' : 'var(--bg-card, #1e293b)',
                border: `2px solid ${currentValue === undefined ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: '10px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
              }}
              onClick={() => { onSelect(undefined); onClose(); }}
            >
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: currentValue === undefined ? 'var(--accent)' : 'var(--text)' }}>
                Usar valor general (Heredado)
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Respeta la configuración principal de la impresora lógica</span>
            </button>
          )}

          {!isLabel ? (
            /* Receipt Widths */
            <>
              {[
                { value: 80, label: '80 mm', sub: 'Estándar térmico (42 cols)' },
                { value: 58, label: '58 mm', sub: 'Portátil / Mini (32 cols)' },
                { value: undefined, label: 'Ancho Libre', sub: 'Sin restricción' },
              ].map(opt => (
                <button
                  key={opt.label}
                  className="sizeSelectItem"
                  style={{
                    display: 'flex', flexDirection: 'column', gap: '0.2rem', padding: '0.85rem 1rem',
                    background: currentValue === opt.value ? 'var(--accent-light, rgba(15,118,110,0.1))' : 'var(--bg-card, #1e293b)',
                    border: `2px solid ${currentValue === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: '10px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
                  }}
                  onClick={() => { onSelect(opt.value); onClose(); }}
                >
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: currentValue === opt.value ? 'var(--accent)' : 'var(--text)' }}>{opt.label}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{opt.sub}</span>
                </button>
              ))}
            </>
          ) : (
            /* Label Presets */
            LABEL_PRESETS.map(preset => (
              <button
                key={preset.id}
                className="sizeSelectItem"
                style={{
                  display: 'flex', flexDirection: 'column', gap: '0.2rem', padding: '0.85rem 1rem',
                  background: (preset.id === 'custom' && !currentValue) || (preset.widthMm === currentValue) ? 'var(--accent-light, rgba(15,118,110,0.1))' : 'var(--bg-card, #1e293b)',
                  border: `2px solid ${(preset.id === 'custom' && !currentValue) || (preset.widthMm === currentValue) ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: '10px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
                }}
                onClick={() => { 
                  onSelect(preset.widthMm > 0 ? preset.widthMm : undefined); 
                  onClose(); 
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: ((preset.id === 'custom' && !currentValue) || (preset.widthMm === currentValue)) ? 'var(--accent)' : 'var(--text)' }}>
                  {preset.name}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                  {preset.widthMm > 0 ? `${preset.widthMm} × ${preset.heightMm} mm — ` : ''}{preset.description}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
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
    name: "", description: "", printers: [],
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
      printers: printer.printers || [], isActive: printer.isActive,
      copies: printer.copies ?? 1,
      paperWidth: printer.paperWidth ?? undefined,
      mediaType: printer.mediaType ?? "receipt",
      labelPresetId: "custom",
    });
  };
 
  const [showSearch, setShowSearch] = useState(false);
  const [showSizeSelector, setShowSizeSelector] = useState<{ type: 'global' | 'printer', index?: number } | null>(null);

  const handleAddNew = () => {
    setEditingId("new");
    setForm({
      ...emptyForm(),
      printers: [],
    });
  };

  const handleSave = async () => {
    if (!form.name || form.printers.length === 0) {
      setError("El nombre y al menos una impresora física son obligatorios."); return;
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
            <div className="lpFormCard" style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '1.25rem', background: 'var(--bg-card, #1e293b)' }}>
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

                {/* Row 2: Impresoras físicas (Multi-selección con buscador) */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ ...FL, marginBottom: 0 }}>Impresoras Configuradas *</span>
                    <button type="button" className="secondary" onClick={() => setShowSearch(true)} 
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', height: 'auto', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      Buscar Impresora
                    </button>
                  </div>
 
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {form.printers.length === 0 ? (
                      <div style={{ padding: '1rem', textAlign: 'center', borderRadius: 8, border: '1px dashed var(--border)', fontSize: '0.8rem', color: 'var(--muted)' }}>
                        No hay impresoras añadidas. Usa el botón de buscar o escribe abajo.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gap: '0.6rem' }}>
                        {(form.printers || []).map((p, idx) => (
                          <div key={idx} style={{ 
                            display: 'grid', gridTemplateColumns: '1fr 85px 120px 32px', gap: '0.75rem', 
                            alignItems: 'center', padding: '0.75rem 1rem', 
                            background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid var(--border)' 
                          }}>
                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }} title={p.name}>{p.name}</span>
                              <span style={{ fontSize: '0.65rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Impresora Física</span>
                            </div>
                            
                            {/* Per-printer Copies */}
                            <div title="Copias específicas para esta impresora">
                              <span style={{ ...FL, fontSize: '0.6rem', marginBottom: '0.2rem', textAlign: 'center' }}>Copias</span>
                              <input type="number" style={{ ...INP, padding: '0.3rem', textAlign: 'center', background: 'var(--bg-card, #0f172a)', height: '34px' }} 
                                min={1} value={p.copies || ''} placeholder={`Dft: ${form.copies}`} 
                                onChange={e => {
                                  const newList = [...form.printers];
                                  newList[idx] = { ...p, copies: parseInt(e.target.value) || undefined };
                                  setForm(f => ({ ...f, printers: newList }));
                                }} />
                            </div>

                            {/* Per-printer Size Selector */}
                            <div title="Tamaño específico para esta impresora">
                              <span style={{ ...FL, fontSize: '0.6rem', marginBottom: '0.2rem', textAlign: 'center' }}>{isLabel ? 'Tamaño' : 'Ancho'}</span>
                              <button
                                type="button"
                                onClick={() => setShowSizeSelector({ type: 'printer', index: idx })}
                                style={{
                                  ...INP, padding: '0.3rem 0.5rem', cursor: 'pointer', textAlign: 'center',
                                  background: 'var(--bg-card, #0f172a)', height: '34px', fontSize: '0.78rem',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem'
                                }}
                              >
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {p.paperWidth 
                                    ? (isLabel ? (LABEL_PRESETS.find(pr => pr.widthMm === p.paperWidth)?.name || `${p.paperWidth}mm`) : `${p.paperWidth}mm`)
                                    : `Dft: ${form.paperWidth || (isLabel ? 'Libre' : 'Libre')}`
                                  }
                                </span>
                              </button>
                            </div>

                            <button type="button" className="danger mini" style={{ padding: '0', height: '32px', width: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', alignSelf: 'end', marginBottom: '1px' }}
                              onClick={() => setForm(f => ({ ...f, printers: f.printers.filter((_, i) => i !== idx) }))}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
 
                  {sysPrintersError && (
                    <span style={{ fontSize: '0.72rem', color: '#f87171', marginTop: '0.25rem', display: 'block' }}>{sysPrintersError}</span>
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
                <div>
                  <span style={FL}>{isLabel ? 'Tamaño de Etiqueta (General)' : 'Ancho de Papel (General)'}</span>
                  <button
                    type="button"
                    onClick={() => setShowSizeSelector({ type: 'global' })}
                    style={{
                      ...INP, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: 'var(--bg-card, #1e293b)', borderColor: 'var(--border)', height: '42px'
                    }}
                  >
                    <span>
                      {isLabel 
                        ? (LABEL_PRESETS.find(p => p.widthMm === form.paperWidth)?.name || 'Personalizado')
                        : (form.paperWidth ? `${form.paperWidth} mm` : 'Ancho Libre')
                      }
                    </span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  
                  <div style={{ marginTop: '0.5rem' }}>
                    {isLabel ? (
                      <div className="lpInfoBox info" style={{ padding: '0.5rem 0.75rem', background: 'rgba(59, 130, 246, 0.05)', borderRadius: 6, fontSize: '0.75rem', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                        📐 {LABEL_PRESETS.find(p => p.widthMm === form.paperWidth)?.description || 'El tamaño lo controla el documento'}
                      </div>
                    ) : (
                      <div className="lpInfoBox info" style={{ padding: '0.5rem 0.75rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: 6, fontSize: '0.75rem', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                        🧾 {form.paperWidth ? `Optimizado para papel de ${form.paperWidth}mm` : 'Tamaño variable según contenido'}
                      </div>
                    )}
                  </div>
                </div>

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
                            <span>🖨 <strong>{(printer.printers || []).map(p => p.name).join(', ') || 'N/A'}</strong></span>
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
        
        {showSearch && (
          <PrinterSearchModal 
            availablePrinters={systemPrinters} 
            onClose={() => setShowSearch(false)}
            onSelect={(p: string) => {
              if (!form.printers.some(x => x.name === p)) {
                setForm(f => ({ ...f, printers: [...f.printers, { name: p }] }));
              }
            }}
          />
        )}

        {showSizeSelector && (
          <SizeSelectorModal 
            mediaType={form.mediaType as any}
            isPrinterSpecific={showSizeSelector.type === 'printer'}
            currentValue={showSizeSelector.type === 'global' ? (form.paperWidth ?? undefined) : (form.printers[showSizeSelector.index!].paperWidth ?? undefined)}
            onClose={() => setShowSizeSelector(null)}
            onSelect={(val: number | undefined) => {
              if (showSizeSelector.type === 'global') {
                setForm(f => ({ ...f, paperWidth: val }));
              } else {
                const newList = [...form.printers];
                const idx = showSizeSelector.index!;
                newList[idx] = { ...newList[idx], paperWidth: val };
                setForm(f => ({ ...f, printers: newList }));
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
