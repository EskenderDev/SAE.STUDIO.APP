import { useEffect, useMemo, useState } from "react";
import { labelsApi, createLabelsApi } from "@/lib/api/client";
import type { LogicalPrinterDto, UpsertLogicalPrinterRequest } from "@/lib/api/client";

interface LogicalPrintersManagerModalProps {
  onClose: () => void;
  apiBaseUrl?: string;
}

export default function LogicalPrintersManagerModal({ onClose, apiBaseUrl }: LogicalPrintersManagerModalProps) {
  // Memoize the api instance so closures always get the same stable reference
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
  const [form, setForm] = useState<UpsertLogicalPrinterRequest>({
    name: "",
    description: "",
    physicalPrinter: "",
    isActive: true,
  });

  const fetchData = async () => {
    setLoading(true);
    setSysPrintersLoading(true);
    setSysPrintersError(null);
    setError(null);
    try {
      const [sysPrintersResult, logPrintersResult] = await Promise.allSettled([
        api.getSystemPrinters(),
        api.getLogicalPrinters(),
      ]);

      if (sysPrintersResult.status === 'fulfilled') {
        setSystemPrinters(sysPrintersResult.value);
      } else {
        setSysPrintersError('No se pudo cargar la lista de impresoras del sistema.');
        console.error('System printers fetch error:', sysPrintersResult.reason);
      }

      if (logPrintersResult.status === 'fulfilled') {
        setPrinters(logPrintersResult.value);
      } else {
        setError((logPrintersResult.reason as any)?.message || 'Error al cargar impresoras lógicas.');
      }
    } finally {
      setLoading(false);
      setSysPrintersLoading(false);
    }
  };

  // Re-fetch whenever the api instance changes (i.e. apiBaseUrl changes)
  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const handleEdit = (printer: LogicalPrinterDto) => {
    setEditingId(printer.id);
    setForm({
      id: printer.id,
      name: printer.name,
      description: printer.description,
      physicalPrinter: printer.physicalPrinter,
      isActive: printer.isActive,
    });
  };

  const handleAddNew = () => {
    setEditingId("new");
    setForm({
      name: "",
      description: "",
      physicalPrinter: systemPrinters.length > 0 ? systemPrinters[0] : "",
      isActive: true,
    });
  };

  const handleSave = async () => {
    if (!form.name || !form.physicalPrinter) {
      setError("El nombre y la impresora física son obligatorios.");
      return;
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

  return (
    <div className="modalBackdrop" onClick={onClose} style={{ zIndex: 3000 }}>
      <div className="modalCard" style={{ width: '600px', maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Impresoras Lógicas
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '1rem' }}>
          Mapea nombres lógicos (ej. "Cocina") a impresoras físicas del sistema.
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
                  <label style={{ display: 'block', margin: 0, fontSize: '0.85rem', fontWeight: 500 }}>Nombre Lógico
                    <input style={{ display: 'block', width: '100%', marginTop: '0.4rem', padding: '0.5rem' }} value={form.name} placeholder="Ej. Cocina, Barra..." onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
                  </label>
                  
                  <label style={{ display: 'block', margin: 0, fontSize: '0.85rem', fontWeight: 500 }}>Descripción (Opcional)
                    <input style={{ display: 'block', width: '100%', marginTop: '0.4rem', padding: '0.5rem' }} value={form.description || ''} placeholder="Ej. Impresora de la cocina principal" onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} />
                  </label>
                  
                  <label style={{ display: 'block', margin: 0, fontSize: '0.85rem', fontWeight: 500 }}>Impresora Física
                    {/* Dropdown from system printers */}
                    <select
                      style={{ display: 'block', width: '100%', marginTop: '0.4rem', padding: '0.5rem' }}
                      value={form.physicalPrinter}
                      onChange={(e) => { if (e.target.value) setForm(p => ({ ...p, physicalPrinter: e.target.value })); }}
                    >
                      {sysPrintersLoading ? (
                        <option value="">Cargando impresoras del sistema...</option>
                      ) : sysPrintersError || systemPrinters.length === 0 ? (
                        <option value="">No se cargaron — escribe el nombre abajo</option>
                      ) : (
                        <>
                          <option value="">-- Seleccionar del sistema --</option>
                          {systemPrinters.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </>
                      )}
                    </select>
                    {/* Manual text input — always visible */}
                    <input
                      style={{ display: 'block', width: '100%', marginTop: '0.4rem', padding: '0.5rem' }}
                      value={form.physicalPrinter}
                      placeholder="O escribe el nombre exacto en Windows"
                      onChange={(e) => setForm(p => ({ ...p, physicalPrinter: e.target.value }))}
                    />
                    {sysPrintersError && (
                      <span style={{ fontSize: '0.75rem', color: '#b45309' }}>{sysPrintersError} Verifica la URL en Config API.</span>
                    )}
                  </label>
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0 0 0', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.isActive} onChange={(e) => setForm(p => ({ ...p, isActive: e.target.checked }))} />
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
                  <button type="button" className="primary" onClick={handleAddNew} style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>+ Nueva Impresora</button>
                </div>
                
                {printers.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', background: 'var(--bg-subtle)', borderRadius: '6px' }}>
                    No hay impresoras lógicas configuradas.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {printers.map(printer => (
                      <div key={printer.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--bg-subtle)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                        <div>
                          <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {printer.name}
                            {!printer.isActive && <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.3rem', background: '#fee2e2', color: '#991b1b', borderRadius: '4px' }}>Inactiva</span>}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.2rem' }}>Física: {printer.physicalPrinter}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button type="button" className="secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={() => handleEdit(printer)}>Editar</button>
                          <button type="button" className="danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={() => handleDelete(printer.id)}>Eliminar</button>
                        </div>
                      </div>
                    ))}
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
