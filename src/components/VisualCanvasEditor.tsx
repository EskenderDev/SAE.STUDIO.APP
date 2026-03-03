import { useEffect, useMemo, useRef, useState } from "react";
import type { EditorDocumentSummary, EditorElementDefinition, UpsertEditorElementPayload } from "@/lib/api/client";
import { createEditorApi } from "@/lib/api/client";

type Props = {
  xml: string;
  onXmlChange: (xml: string) => void;
  apiBaseUrl: string;
  timeoutMs: number;
};

type Kind = "sae" | "glabels";
type Obj = { id: string; xmlIndex: number | null; type: string; x: number; y: number; w: number; h: number; content: string };
type Parsed = { kind: Kind; widthPt: number; heightPt: number; objects: Obj[]; xmlDocument: XMLDocument };
type DragState = { mode: "move" | "resize"; id: string; handle?: string; startX: number; startY: number; x: number; y: number; w: number; h: number };

const MIN = 4;
const HANDLES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
const TYPES = ["text", "barcode", "box", "line", "ellipse", "image"] as const;
const ICON: Record<(typeof TYPES)[number], string> = {
  text: "T",
  barcode: "||#",
  box: "[]",
  line: "__",
  ellipse: "()",
  image: "IMG",
};

const n = (v: string | null | undefined, f: number) => {
  const p = Number.parseFloat((v ?? "").replace("pt", ""));
  return Number.isFinite(p) ? p : f;
};
const pt = (v: number) => v.toFixed(4).replace(/\.?0+$/, "");
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

function parse(xml: string): Parsed {
  const d = new DOMParser().parseFromString(xml, "application/xml");
  if (d.querySelector("parsererror")) throw new Error("XML invalido.");
  const root = d.documentElement.nodeName.toLowerCase();
  if (root === "saelabels") {
    const rect = d.documentElement.getElementsByTagName("label_rectangle")[0];
    const objects = Array.from(d.documentElement.getElementsByTagName("objects")[0]?.getElementsByTagName("object") ?? []).map((e, i) => ({
      id: `o-${i}`, xmlIndex: i, type: (e.getAttribute("type") ?? "text").toLowerCase(),
      x: n(e.getAttribute("x_pt"), 0), y: n(e.getAttribute("y_pt"), 0), w: n(e.getAttribute("w_pt"), 40), h: n(e.getAttribute("h_pt"), 20),
      content: e.getElementsByTagName("content")[0]?.textContent?.trim() ?? "",
    }));
    return { kind: "sae", widthPt: n(rect?.getAttribute("width_pt"), 200), heightPt: n(rect?.getAttribute("height_pt"), 100), objects, xmlDocument: d };
  }
  if (root === "glabels-document" || root === "glabels-template" || root === "template") {
    const t = d.documentElement.nodeName === "Template" ? d.documentElement : d.documentElement.getElementsByTagName("Template")[0];
    const rect = t?.getElementsByTagName("Label-rectangle")[0];
    const objects = Array.from(d.documentElement.getElementsByTagName("Objects")[0]?.children ?? []).filter((x) => x.nodeName.startsWith("Object-")).map((e, i) => ({
      id: `o-${i}`, xmlIndex: i, type: e.nodeName.replace("Object-", "").toLowerCase(),
      x: n(e.getAttribute("x"), 0), y: n(e.getAttribute("y"), 0), w: n(e.getAttribute("w"), 40), h: n(e.getAttribute("h"), 20),
      content: e.getElementsByTagName("p")[0]?.textContent?.trim() ?? e.getAttribute("data") ?? "",
    }));
    return { kind: "glabels", widthPt: n(rect?.getAttribute("width"), 200), heightPt: n(rect?.getAttribute("height"), 100), objects, xmlDocument: d };
  }
  throw new Error("Solo saelabels/glabels.");
}

export default function VisualCanvasEditor({ xml, onXmlChange, apiBaseUrl, timeoutMs }: Props) {
  const [zoom, setZoom] = useState(2);
  const [error, setError] = useState("");
  const [objects, setObjects] = useState<Obj[]>([]);
  const [selected, setSelected] = useState("");
  const [drag, setDrag] = useState<DragState | null>(null);
  const [elements, setElements] = useState<EditorElementDefinition[]>([]);
  const [documents, setDocuments] = useState<EditorDocumentSummary[]>([]);
  const [docId, setDocId] = useState("");
  const [docName, setDocName] = useState("");
  const [status, setStatus] = useState("");
  const [editingElementId, setEditingElementId] = useState("");
  const [elementForm, setElementForm] = useState<UpsertEditorElementPayload>({
    key: "text",
    name: "Texto",
    category: "basic",
    objectType: "text",
    defaultWidthPt: 90,
    defaultHeightPt: 24,
    defaultContent: "${texto}",
  });
  const boardRef = useRef<HTMLDivElement | null>(null);
  const editorApi = useMemo(() => createEditorApi(apiBaseUrl, { timeoutMs }), [apiBaseUrl, timeoutMs]);
  const parseResult = useMemo(() => {
    try { return { parsed: parse(xml), parseError: "" }; } catch (e) { return { parsed: null, parseError: e instanceof Error ? e.message : "Error parseando." }; }
  }, [xml]);
  const parsed = parseResult.parsed;
  const viewError = parseResult.parseError || error;

  const refresh = async () => {
    const [els, docs] = await Promise.all([editorApi.listElements(), editorApi.listDocuments()]);
    setElements(els);
    setDocuments(docs);
  };

  useEffect(() => {
    if (!parsed) return;
    setObjects(parsed.objects);
    setSelected("");
    setError("");
  }, [parsed]);

  useEffect(() => {
    const run = async () => {
      try { await refresh(); } catch (e) { setStatus(e instanceof Error ? e.message : "No se pudo cargar libreria."); }
    };
    void run();
  }, [editorApi]);

  useEffect(() => {
    if (!drag) return;
    const move = (ev: MouseEvent) => {
      const dx = (ev.clientX - drag.startX) / zoom;
      const dy = (ev.clientY - drag.startY) / zoom;
      setObjects((prev) => prev.map((o) => {
        if (o.id !== drag.id) return o;
        if (drag.mode === "move") return { ...o, x: Math.max(0, drag.x + dx), y: Math.max(0, drag.y + dy) };
        const h = drag.handle ?? "se";
        let x = drag.x, y = drag.y, w = drag.w, hh = drag.h;
        if (h.includes("e")) w = Math.max(MIN, drag.w + dx);
        if (h.includes("s")) hh = Math.max(MIN, drag.h + dy);
        if (h.includes("w")) { const r = drag.x + drag.w; x = Math.max(0, drag.x + dx); w = Math.max(MIN, r - x); }
        if (h.includes("n")) { const b = drag.y + drag.h; y = Math.max(0, drag.y + dy); hh = Math.max(MIN, b - y); }
        return { ...o, x, y, w, h: hh };
      }));
    };
    const up = () => setDrag(null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, [drag, zoom]);

  const applyXml = (): string | null => {
    if (!parsed) return null;
    const next = parsed.xmlDocument.cloneNode(true) as XMLDocument;
    if (parsed.kind === "sae") {
      let node = next.documentElement.getElementsByTagName("objects")[0];
      if (!node) { node = next.createElement("objects"); next.documentElement.appendChild(node); }
      const xmlObjs = Array.from(node.getElementsByTagName("object"));
      for (const o of objects) {
        const ex = o.xmlIndex !== null ? xmlObjs[o.xmlIndex] : undefined;
        if (ex) {
          ex.setAttribute("x_pt", pt(o.x)); ex.setAttribute("y_pt", pt(o.y)); ex.setAttribute("w_pt", pt(o.w)); ex.setAttribute("h_pt", pt(o.h));
          const c = ex.getElementsByTagName("content")[0] ?? next.createElement("content");
          c.textContent = o.content;
          if (!c.parentElement) ex.appendChild(c);
        } else {
          const e = next.createElement("object");
          e.setAttribute("type", o.type); e.setAttribute("x_pt", pt(o.x)); e.setAttribute("y_pt", pt(o.y)); e.setAttribute("w_pt", pt(o.w)); e.setAttribute("h_pt", pt(o.h));
          e.setAttribute("style", o.type === "barcode" ? "code128" : "");
          e.setAttribute("color", "0xff"); e.setAttribute("dx_pt", "0"); e.setAttribute("dy_pt", "0"); e.setAttribute("show_text", "false"); e.setAttribute("checksum", "false");
          const c = next.createElement("content"); c.textContent = o.content; e.appendChild(c);
          node.appendChild(e);
        }
      }
    } else {
      let node = next.documentElement.getElementsByTagName("Objects")[0];
      if (!node) { node = next.createElement("Objects"); next.documentElement.appendChild(node); }
      const xmlObjs = Array.from(node.children).filter((x) => x.nodeName.startsWith("Object-"));
      for (const o of objects) {
        const ex = o.xmlIndex !== null ? (xmlObjs[o.xmlIndex] as Element | undefined) : undefined;
        if (ex) {
          ex.setAttribute("x", `${pt(o.x)}pt`); ex.setAttribute("y", `${pt(o.y)}pt`); ex.setAttribute("w", `${pt(o.w)}pt`); ex.setAttribute("h", `${pt(o.h)}pt`);
        } else {
          const tag = o.type === "text" ? "Object-text" : o.type === "barcode" ? "Object-barcode" : o.type === "box" ? "Object-box" : o.type === "line" ? "Object-line" : o.type === "ellipse" ? "Object-ellipse" : "Object-image";
          const e = next.createElement(tag);
          e.setAttribute("x", `${pt(o.x)}pt`); e.setAttribute("y", `${pt(o.y)}pt`); e.setAttribute("w", `${pt(o.w)}pt`); e.setAttribute("h", `${pt(o.h)}pt`);
          e.setAttribute("a0", "1"); e.setAttribute("a1", "0"); e.setAttribute("a2", "0"); e.setAttribute("a3", "1"); e.setAttribute("a4", "0"); e.setAttribute("a5", "0");
          e.setAttribute("lock_aspect_ratio", o.type === "image" ? "true" : "false"); e.setAttribute("shadow", "false");
          if (o.type === "text") { e.setAttribute("color", "0xff"); e.setAttribute("font_family", "Sans"); e.setAttribute("font_size", "10"); e.setAttribute("align", "left"); e.setAttribute("valign", "top"); const p = next.createElement("p"); p.textContent = o.content || "${texto}"; e.appendChild(p); }
          if (o.type === "barcode") { e.setAttribute("style", "code128"); e.setAttribute("data", o.content || "${barcode}"); e.setAttribute("text", "true"); e.setAttribute("checksum", "false"); }
          if (o.type === "box" || o.type === "ellipse") { e.setAttribute("fill_color", "0xffffff"); e.setAttribute("line_color", "0xff"); e.setAttribute("line_width", "1pt"); }
          if (o.type === "line") { e.setAttribute("dx", `${pt(o.w)}pt`); e.setAttribute("dy", "0pt"); e.setAttribute("line_color", "0xff"); e.setAttribute("line_width", "1pt"); }
          if (o.type === "image") e.setAttribute("src", o.content ?? "");
          node.appendChild(e);
        }
      }
    }
    const nextXml = new XMLSerializer().serializeToString(next);
    onXmlChange(nextXml);
    return nextXml;
  };

  const saveDoc = async () => {
    if (!parsed || !docName.trim()) { setStatus("Nombre requerido."); return; }
    try {
      const xmlToSave = applyXml() ?? xml;
      const saved = await editorApi.saveDocument({ id: docId || undefined, name: docName.trim(), kind: parsed.kind, xml: xmlToSave });
      setDocId(saved.id);
      setDocName(saved.name);
      setStatus(`Guardado: ${saved.name}`);
      await refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "No se pudo guardar.");
    }
  };

  const saveElement = async () => {
    if (!elementForm.key.trim() || !elementForm.name.trim()) {
      setStatus("Key y nombre son requeridos.");
      return;
    }
    try {
      await editorApi.saveElement({
        ...elementForm,
        id: editingElementId || undefined,
        key: elementForm.key.trim(),
        name: elementForm.name.trim(),
      });
      setEditingElementId("");
      setElementForm({ key: "text", name: "Texto", category: "basic", objectType: "text", defaultWidthPt: 90, defaultHeightPt: 24, defaultContent: "${texto}" });
      setStatus("Elemento guardado.");
      await refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "No se pudo guardar elemento.");
    }
  };

  const editElement = (el: EditorElementDefinition) => {
    setEditingElementId(el.id);
    setElementForm({
      id: el.id,
      key: el.key,
      name: el.name,
      category: el.category,
      objectType: el.objectType,
      defaultWidthPt: el.defaultWidthPt,
      defaultHeightPt: el.defaultHeightPt,
      defaultContent: el.defaultContent,
    });
  };

  const deleteElement = async (id: string) => {
    try {
      await editorApi.deleteElement(id);
      if (editingElementId === id) {
        setEditingElementId("");
      }
      setStatus("Elemento eliminado.");
      await refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "No se pudo eliminar elemento.");
    }
  };

  if (viewError) return <p className="editorError">{viewError}</p>;
  if (!parsed) return null;

  const sel = objects.find((o) => o.id === selected);

  return (
    <section className="editorStudio">
      <header className="studioTopbar">
        <div className="toolbarGroup">
          <label className="zoomLabel">Zoom
            <input type="range" min={1} max={5} step={0.25} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
          </label>
          <span className="zoomBadge">{zoom.toFixed(2)}x</span>
          <button type="button" className="mini" onClick={applyXml}>Aplicar XML</button>
        </div>

        <div className="toolbarGroup docs">
          <input value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="Nombre documento" />
          <select value={docId} onChange={(e) => setDocId(e.target.value)}>
            <option value="">Documentos guardados</option>
            {documents.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.kind})</option>)}
          </select>
          <button type="button" className="mini" onClick={saveDoc}>Guardar</button>
          <button type="button" className="mini secondary" onClick={async () => { if (!docId) return; const d = await editorApi.getDocument(docId); setDocName(d.name); onXmlChange(d.xml); }} disabled={!docId}>Cargar</button>
          <button type="button" className="mini secondary" onClick={async () => { if (!docId) return; await editorApi.deleteDocument(docId); setDocId(""); setDocName(""); await refresh(); }} disabled={!docId}>Eliminar</button>
        </div>
      </header>

      <div className="studioBody">
        <aside className="leftSidebar">
          <h3>Elementos</h3>
          <div className="paletteGrid">
            {elements.map((el) => (
              <div key={el.id} className="paletteCard">
                <button
                  type="button"
                  className="iconBtn"
                  title={`${el.name} (${el.objectType})`}
                  draggable
                  onDragStart={(e) => {
                    const raw = JSON.stringify(el);
                    e.dataTransfer.setData("application/saelabel-element", raw);
                    e.dataTransfer.setData("text/plain", raw);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                >
                  <span className="ico">{ICON[el.objectType]}</span>
                  <small>{el.name}</small>
                </button>
                <div className="paletteActions">
                  <button type="button" className="mini secondary" onClick={() => editElement(el)}>Edit</button>
                  <button type="button" className="mini secondary" onClick={() => void deleteElement(el.id)}>Del</button>
                </div>
              </div>
            ))}
          </div>

          <h4>{editingElementId ? "Editar elemento" : "Nuevo elemento"}</h4>
          <div className="elementForm">
            <input value={elementForm.name} placeholder="Nombre" onChange={(e) => setElementForm((p) => ({ ...p, name: e.target.value }))} />
            <input value={elementForm.key} placeholder="Key" onChange={(e) => setElementForm((p) => ({ ...p, key: e.target.value }))} />
            <input value={elementForm.category} placeholder="Categoria" onChange={(e) => setElementForm((p) => ({ ...p, category: e.target.value }))} />
            <select value={elementForm.objectType} onChange={(e) => setElementForm((p) => ({ ...p, objectType: e.target.value as UpsertEditorElementPayload["objectType"] }))}>
              {TYPES.map((t) => <option key={t} value={t}>{cap(t)}</option>)}
            </select>
            <div className="sizeRow">
              <input type="number" value={elementForm.defaultWidthPt} onChange={(e) => setElementForm((p) => ({ ...p, defaultWidthPt: Number(e.target.value) || 1 }))} />
              <input type="number" value={elementForm.defaultHeightPt} onChange={(e) => setElementForm((p) => ({ ...p, defaultHeightPt: Number(e.target.value) || 1 }))} />
            </div>
            <input value={elementForm.defaultContent} placeholder="Contenido por defecto" onChange={(e) => setElementForm((p) => ({ ...p, defaultContent: e.target.value }))} />
            <div className="formActions">
              <button type="button" className="mini" onClick={saveElement}>Guardar elemento</button>
              <button type="button" className="mini secondary" onClick={() => { setEditingElementId(""); setElementForm({ key: "text", name: "Texto", category: "basic", objectType: "text", defaultWidthPt: 90, defaultHeightPt: 24, defaultContent: "${texto}" }); }}>Reset</button>
            </div>
          </div>
        </aside>

        <main className="canvasArea">
          <div className="canvasViewport">
            <div
              ref={boardRef}
              className="canvasBoard"
              style={{ width: `${parsed.widthPt * zoom}px`, height: `${parsed.heightPt * zoom}px` }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }}
              onDrop={(e) => {
                e.preventDefault();
                const raw = e.dataTransfer.getData("application/saelabel-element") || e.dataTransfer.getData("text/plain");
                if (!raw || !boardRef.current) return;
                const el = JSON.parse(raw) as EditorElementDefinition;
                const r = boardRef.current.getBoundingClientRect();
                const x = (e.clientX - r.left) / zoom;
                const y = (e.clientY - r.top) / zoom;
                setObjects((prev) => [...prev, {
                  id: `new-${crypto.randomUUID()}`,
                  xmlIndex: null,
                  type: el.objectType,
                  x, y,
                  w: Math.max(MIN, el.defaultWidthPt),
                  h: Math.max(MIN, el.defaultHeightPt),
                  content: el.defaultContent || "",
                }]);
              }}
            >
              {objects.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={`canvasObject ${selected === o.id ? "selected" : ""}`}
                  style={{ left: `${o.x * zoom}px`, top: `${o.y * zoom}px`, width: `${Math.max(10, o.w * zoom)}px`, height: `${Math.max(10, o.h * zoom)}px` }}
                  onMouseDown={(e) => setDrag({ mode: "move", id: o.id, startX: e.clientX, startY: e.clientY, x: o.x, y: o.y, w: o.w, h: o.h })}
                  onClick={() => setSelected(o.id)}
                >
                  <span>{o.type}</span>
                  <small>{o.content || "(sin contenido)"}</small>
                  {HANDLES.map((h) => (
                    <span
                      key={h}
                      className={`resizeHandle ${h}`}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setSelected(o.id);
                        setDrag({ mode: "resize", id: o.id, handle: h, startX: e.clientX, startY: e.clientY, x: o.x, y: o.y, w: o.w, h: o.h });
                      }}
                    />
                  ))}
                </button>
              ))}
            </div>
          </div>
        </main>

        <aside className="rightSidebar">
          <h3>Inspector</h3>
          {sel ? (
            <div className="inspectorFields">
              <label>X<input type="number" value={sel.x} onChange={(e) => setObjects((p) => p.map((x) => (x.id === sel.id ? { ...x, x: Number(e.target.value) || 0 } : x)))} /></label>
              <label>Y<input type="number" value={sel.y} onChange={(e) => setObjects((p) => p.map((x) => (x.id === sel.id ? { ...x, y: Number(e.target.value) || 0 } : x)))} /></label>
              <label>W<input type="number" value={sel.w} onChange={(e) => setObjects((p) => p.map((x) => (x.id === sel.id ? { ...x, w: Math.max(MIN, Number(e.target.value) || MIN) } : x)))} /></label>
              <label>H<input type="number" value={sel.h} onChange={(e) => setObjects((p) => p.map((x) => (x.id === sel.id ? { ...x, h: Math.max(MIN, Number(e.target.value) || MIN) } : x)))} /></label>
              <label className="full">Contenido<input type="text" value={sel.content} onChange={(e) => setObjects((p) => p.map((x) => (x.id === sel.id ? { ...x, content: e.target.value } : x)))} /></label>
            </div>
          ) : <p>Selecciona un objeto.</p>}
          {status ? <p className="status">{status}</p> : null}
          <div className="meta"><strong>Doc:</strong> {parsed.kind}<strong>Size:</strong> {parsed.widthPt} x {parsed.heightPt} pt<strong>Objs:</strong> {objects.length}</div>
        </aside>
      </div>
    </section>
  );
}

