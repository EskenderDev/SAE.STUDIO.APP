import { useEffect, useMemo, useRef, useState } from "react";
import { createLabelsApi, DEFAULT_API_BASE_URL } from "@/lib/api/client";
import VisualCanvasEditor from "@/components/VisualCanvasEditor";

type Action = "parse" | "convert-to-glabels" | "convert-from-glabels";
type ViewMode = "api" | "visual";

const sampleSaeXml =
  `<saelabels version="1.0"><template brand="SAE" description="Demo" part="P-1" size="custom"><label_rectangle width_pt="144" height_pt="72" round_pt="0" x_waste_pt="0" y_waste_pt="0" /><layout dx_pt="0" dy_pt="0" nx="1" ny="1" x0_pt="0" y0_pt="0" /></template><objects /><variables /></saelabels>`;
const sampleGlabelsXml =
  `<Glabels-document version="4.0"><Template brand="Demo" description="Demo" part="P-1" size="custom"><Label-rectangle width="144pt" height="72pt"><Layout dx="144pt" dy="72pt" nx="1" ny="1" x0="0pt" y0="0pt"/></Label-rectangle></Template><Objects/><Variables/><Data/></Glabels-document>`;

const STORAGE = {
  apiBaseUrl: "saelabel.app.apiBaseUrl",
  action: "saelabel.app.action",
  xml: "saelabel.app.xml",
  history: "saelabel.app.history",
  timeoutMs: "saelabel.app.timeoutMs",
  sessions: "saelabel.app.sessions",
};

type HistoryItem = {
  id: string;
  createdAt: string;
  action: Action;
  ok: boolean;
  elapsedMs: number;
  errorMessage?: string;
};

type SessionItem = {
  id: string;
  name: string;
  createdAt: string;
  apiBaseUrl: string;
  action: Action;
  xml: string;
  timeoutMs: number;
};

function sanitizeXmlInput(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .replace(/^\s*```(?:xml)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

function getExpectedRoots(action: Action): string[] {
  if (action === "convert-from-glabels") {
    return ["glabels-document", "glabels-template", "template"];
  }
  return ["saelabels"];
}

function validateXmlInput(action: Action, rawXml: string): { ok: true; normalizedXml: string } | { ok: false; error: string } {
  const normalizedXml = sanitizeXmlInput(rawXml);
  if (!normalizedXml) {
    return { ok: false, error: "Debes ingresar XML para procesar." };
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(normalizedXml, "application/xml");
  const parserError = document.querySelector("parsererror");
  if (parserError) {
    return { ok: false, error: "XML invalido. Revisa formato y etiquetas." };
  }

  const rootName = document.documentElement?.nodeName?.toLowerCase() ?? "";
  const expectedRoots = getExpectedRoots(action);
  if (!expectedRoots.includes(rootName)) {
    return {
      ok: false,
      error: `Raiz invalida para '${action}'. Esperado: ${expectedRoots.map((x) => `<${x}>`).join(", ")} y llego <${rootName || "vacia"}>.`,
    };
  }

  return { ok: true, normalizedXml };
}

export default function LabelWorkbench() {
  const [viewMode, setViewMode] = useState<ViewMode>("api");
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE_URL);
  const [timeoutMs, setTimeoutMs] = useState(30000);
  const [xml, setXml] = useState(sampleSaeXml);
  const [action, setAction] = useState<Action>("parse");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pingStatus, setPingStatus] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedApiBaseUrl = window.localStorage.getItem(STORAGE.apiBaseUrl);
    const savedAction = window.localStorage.getItem(STORAGE.action) as Action | null;
    const savedXml = window.localStorage.getItem(STORAGE.xml);
    const savedHistory = window.localStorage.getItem(STORAGE.history);
    const savedTimeoutMs = window.localStorage.getItem(STORAGE.timeoutMs);
    const savedSessions = window.localStorage.getItem(STORAGE.sessions);

    if (savedApiBaseUrl) setApiBaseUrl(savedApiBaseUrl);
    if (savedAction) setAction(savedAction);
    if (savedXml) setXml(savedXml);
    if (savedTimeoutMs && !Number.isNaN(Number(savedTimeoutMs))) setTimeoutMs(Number(savedTimeoutMs));
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory) as HistoryItem[]);
      } catch {
        setHistory([]);
      }
    }
    if (savedSessions) {
      try {
        setSessions(JSON.parse(savedSessions) as SessionItem[]);
      } catch {
        setSessions([]);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE.apiBaseUrl, apiBaseUrl);
  }, [apiBaseUrl]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE.action, action);
  }, [action]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE.xml, xml);
  }, [xml]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE.history, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE.timeoutMs, String(timeoutMs));
  }, [timeoutMs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE.sessions, JSON.stringify(sessions));
  }, [sessions]);

  const buttonLabel = useMemo(() => {
    if (action === "parse") return "Probar parse";
    if (action === "convert-to-glabels") return "Convertir a glabels";
    return "Convertir desde glabels";
  }, [action]);

  const resultExtension = action === "parse" ? "json" : "xml";
  const labelsApi = useMemo(() => createLabelsApi(apiBaseUrl, { timeoutMs }), [apiBaseUrl, timeoutMs]);

  const applyExample = () => {
    setXml(action === "convert-from-glabels" ? sampleGlabelsXml : sampleSaeXml);
    setError("");
    setResult("");
    setPingStatus("");
  };

  const createNewDocument = (kind: "sae" | "glabels") => {
    setXml(kind === "sae" ? sampleSaeXml : sampleGlabelsXml);
    setAction(kind === "sae" ? "parse" : "convert-from-glabels");
    setError("");
    setResult("");
    setPingStatus("");
  };

  const addHistoryItem = (item: HistoryItem) => {
    setHistory((prev) => [item, ...prev].slice(0, 20));
  };

  const saveSession = () => {
    if (typeof window === "undefined") return;
    const name = window.prompt("Nombre de la sesion");
    if (!name || !name.trim()) return;
    setSessions((prev) => [
      {
        id: crypto.randomUUID(),
        name: name.trim(),
        createdAt: new Date().toISOString(),
        apiBaseUrl,
        action,
        xml,
        timeoutMs,
      },
      ...prev,
    ].slice(0, 30));
  };

  const loadSession = () => {
    const selected = sessions.find((x) => x.id === selectedSessionId);
    if (!selected) return;
    setApiBaseUrl(selected.apiBaseUrl);
    setAction(selected.action);
    setXml(selected.xml);
    setTimeoutMs(selected.timeoutMs);
    setError("");
    setResult("");
    setPingStatus("");
  };

  const deleteSession = () => {
    if (!selectedSessionId) return;
    setSessions((prev) => prev.filter((x) => x.id !== selectedSessionId));
    setSelectedSessionId("");
  };

  const run = async () => {
    const validation = validateXmlInput(action, xml);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    const normalizedXml = validation.normalizedXml;
    setXml(normalizedXml);
    const startedAt = Date.now();
    setLoading(true);
    setError("");
    setResult("");
    setPingStatus("");

    try {
      if (action === "parse") {
        const parsed = await labelsApi.parse({ xml: normalizedXml });
        setResult(JSON.stringify(parsed, null, 2));
      } else if (action === "convert-to-glabels") {
        const converted = await labelsApi.convertToGlabels({ xml: normalizedXml });
        setResult(converted);
      } else {
        const converted = await labelsApi.convertFromGlabels({ xml: normalizedXml });
        setResult(converted);
      }
      addHistoryItem({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        action,
        ok: true,
        elapsedMs: Date.now() - startedAt,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Error desconocido";
      setError(message);
      addHistoryItem({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        action,
        ok: false,
        elapsedMs: Date.now() - startedAt,
        errorMessage: message,
      });
    } finally {
      setLoading(false);
    }
  };

  const copyResult = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
    } catch {
      setError("No se pudo copiar al portapapeles.");
    }
  };

  const downloadResult = () => {
    if (!result || typeof window === "undefined") return;
    const mimeType = action === "parse" ? "application/json;charset=utf-8" : "application/xml;charset=utf-8";
    const blob = new Blob([result], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `resultado.${resultExtension}`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadInput = () => {
    if (!xml || typeof window === "undefined") return;
    const cleanXml = sanitizeXmlInput(xml);
    if (!cleanXml) {
      setError("No hay XML valido para descargar.");
      return;
    }

    const blob = new Blob([cleanXml], { type: "application/xml;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "entrada.xml";
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const importInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setXml(sanitizeXmlInput(text));
      setError("");
      setResult("");
    } catch {
      setError("No se pudo leer el archivo.");
    } finally {
      event.target.value = "";
    }
  };

  const pingBackend = async () => {
    setPingStatus("Probando conexion...");
    try {
      const response = await fetch(`${apiBaseUrl.replace(/\/+$/, "")}/openapi/v1.json`, {
        method: "GET",
      });
      if (response.ok) {
        setPingStatus(`Conexion OK (${response.status})`);
      } else {
        setPingStatus(`Backend responde con ${response.status}`);
      }
    } catch {
      setPingStatus("No hay conexion con el backend.");
    }
  };

  return (
    <section className={`panel ${viewMode === "visual" ? "visualMode" : ""}`}>
      <h1>SAELABEL App Studio</h1>
      <p>Modo API para conversiones y modo visual para editar objetos en canvas.</p>

      <div className="viewToggle">
        <button
          type="button"
          className={viewMode === "api" ? "active" : "secondary"}
          onClick={() => setViewMode("api")}
        >
          API Workbench
        </button>
        <button
          type="button"
          className={viewMode === "visual" ? "active" : "secondary"}
          onClick={() => setViewMode("visual")}
        >
          Editor visual
        </button>
      </div>

      <div className="row">
        <button type="button" className="secondary" onClick={() => createNewDocument("sae")}>
          Nuevo SAELABEL
        </button>
        <button type="button" className="secondary" onClick={() => createNewDocument("glabels")}>
          Nuevo glabels
        </button>
      </div>

      {viewMode === "visual" ? (
        <>
          <div className="row">
            <label className="grow">
              API Base URL
              <input
                type="text"
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                placeholder="https://localhost:7097"
              />
            </label>
          </div>
          <div className="row">
            <label className="grow">
              Accion (aplica para ejecutar API)
              <select value={action} onChange={(e) => setAction(e.target.value as Action)}>
                <option value="parse">parse</option>
                <option value="convert-to-glabels">convert-to-glabels</option>
                <option value="convert-from-glabels">convert-from-glabels</option>
              </select>
            </label>
            <button type="button" className="secondary" onClick={applyExample}>
              Cargar ejemplo
            </button>
          </div>
          <VisualCanvasEditor
            xml={xml}
            apiBaseUrl={apiBaseUrl}
            timeoutMs={timeoutMs}
            onXmlChange={(nextXml) => {
              setXml(nextXml);
              setError("");
            }}
          />
        </>
      ) : (
        <>

      <div className="row">
        <label className="grow">
          API Base URL
          <input
            type="text"
            value={apiBaseUrl}
            onChange={(e) => setApiBaseUrl(e.target.value)}
            placeholder="https://localhost:7097"
          />
        </label>
        <button type="button" className="secondary" onClick={pingBackend}>
          Probar conexion
        </button>
      </div>
      {pingStatus ? <p className="hint">{pingStatus}</p> : null}

      <div className="row">
        <label className="grow">
          Timeout (ms)
          <input
            type="number"
            min={1000}
            step={1000}
            value={timeoutMs}
            onChange={(e) => setTimeoutMs(Math.max(1000, Number(e.target.value) || 1000))}
          />
        </label>
        <button type="button" className="secondary" onClick={saveSession}>
          Guardar sesion
        </button>
      </div>

      <div className="row">
        <label className="grow">
          Sesion guardada
          <select value={selectedSessionId} onChange={(e) => setSelectedSessionId(e.target.value)}>
            <option value="">Selecciona una sesion</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.name} - {new Date(session.createdAt).toLocaleString()}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="secondary" onClick={loadSession} disabled={!selectedSessionId}>
          Cargar sesion
        </button>
        <button type="button" className="secondary" onClick={deleteSession} disabled={!selectedSessionId}>
          Eliminar sesion
        </button>
      </div>

      <div className="row">
        <label className="grow">
          Accion
          <select value={action} onChange={(e) => setAction(e.target.value as Action)}>
            <option value="parse">parse</option>
            <option value="convert-to-glabels">convert-to-glabels</option>
            <option value="convert-from-glabels">convert-from-glabels</option>
          </select>
        </label>
        <button type="button" className="secondary" onClick={applyExample}>
          Cargar ejemplo
        </button>
        <button type="button" className="secondary" onClick={() => fileInputRef.current?.click()}>
          Importar XML
        </button>
        <button type="button" className="secondary" onClick={downloadInput} disabled={!xml.trim()}>
          Descargar entrada
        </button>
      </div>
      <input ref={fileInputRef} type="file" accept=".xml,.txt" hidden onChange={importInput} />

      <label>
        XML de entrada
        <textarea value={xml} onChange={(e) => setXml(e.target.value)} rows={12} />
      </label>

      <div className="actions">
        <button type="button" onClick={run} disabled={loading}>
          {loading ? "Procesando..." : buttonLabel}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setResult("");
            setError("");
          }}
        >
          Limpiar salida
        </button>
      </div>

      {error ? <pre className="error">{error}</pre> : null}

      <div className="resultHeader">
        <h2>Resultado</h2>
        <div className="resultActions">
          <button type="button" className="secondary" onClick={copyResult} disabled={!result}>
            Copiar
          </button>
          <button type="button" className="secondary" onClick={downloadResult} disabled={!result}>
            Descargar
          </button>
        </div>
      </div>
      <pre>{result || "Sin resultado todavia."}</pre>

      <div className="historyHeader">
        <h2>Historial</h2>
        <button type="button" className="secondary" onClick={() => setHistory([])} disabled={history.length === 0}>
          Limpiar historial
        </button>
      </div>
      <ul className="history">
        {history.length === 0 ? (
          <li className="empty">Sin ejecuciones registradas.</li>
        ) : (
          history.map((item) => (
            <li key={item.id} className={item.ok ? "ok" : "fail"}>
              <span>{new Date(item.createdAt).toLocaleString()}</span>
              <span>{item.action}</span>
              <span>{item.elapsedMs} ms</span>
              <span>{item.ok ? "OK" : item.errorMessage ?? "Error"}</span>
            </li>
          ))
        )}
      </ul>
        </>
      )}

      <style>{`
        h1 {
          margin-top: 0;
          margin-bottom: 0.5rem;
        }
        h2 {
          margin: 0;
          font-size: 1rem;
        }
        p {
          color: #4d5a66;
          margin-top: 0;
          margin-bottom: 1rem;
        }
        .hint {
          margin: -0.25rem 0 0.8rem;
          font-size: 0.9rem;
          color: #2f4c61;
        }
        .viewToggle {
          display: flex;
          gap: 0.45rem;
          margin: 0.8rem 0 1rem;
        }
        label {
          display: block;
          margin-bottom: 0.75rem;
          font-weight: 600;
        }
        input, select, textarea {
          margin-top: 0.35rem;
          width: 100%;
          border: 1px solid #d8dee4;
          border-radius: 8px;
          font-family: Consolas, "Courier New", monospace;
          font-size: 0.9rem;
          padding: 0.6rem;
          box-sizing: border-box;
          background: #fff;
        }
        textarea {
          min-height: 260px;
          resize: vertical;
        }
        .row {
          display: flex;
          gap: 0.6rem;
          align-items: end;
          margin-bottom: 0.2rem;
        }
        .grow {
          flex: 1;
        }
        .actions {
          display: flex;
          gap: 0.6rem;
          margin-bottom: 0.85rem;
        }
        .resultHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.45rem;
        }
        .historyHeader {
          margin-top: 0.8rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .resultActions {
          display: flex;
          gap: 0.45rem;
        }
        button {
          background: #0f7b6c;
          color: white;
          border: 0;
          border-radius: 8px;
          padding: 0.6rem 1rem;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
        }
        button.secondary {
          background: #eff3f6;
          color: #20313d;
          border: 1px solid #d1dae2;
        }
        button.active {
          background: #0f7b6c;
          color: #fff;
          border: 1px solid #0f7b6c;
        }
        button:disabled {
          opacity: 0.7;
          cursor: default;
        }
        pre {
          margin-top: 0;
          background: #f2f6fa;
          border: 1px solid #d8dee4;
          border-radius: 8px;
          padding: 0.75rem;
          overflow: auto;
          max-height: 360px;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .error {
          border-color: #dd3b3b;
          color: #a11f1f;
          background: #fff0f0;
        }
        .history {
          margin: 0.45rem 0 0;
          padding: 0;
          list-style: none;
          border: 1px solid #d8dee4;
          border-radius: 8px;
          overflow: hidden;
        }
        .history li {
          display: grid;
          grid-template-columns: 1.4fr 1fr 0.7fr 2fr;
          gap: 0.5rem;
          padding: 0.55rem 0.65rem;
          border-top: 1px solid #e7edf2;
          font-size: 0.85rem;
          font-family: Consolas, "Courier New", monospace;
          background: #fff;
        }
        .history li:first-child {
          border-top: 0;
        }
        .history li.ok {
          border-left: 3px solid #0f7b6c;
        }
        .history li.fail {
          border-left: 3px solid #b73a3a;
          background: #fff7f7;
        }
        .history .empty {
          display: block;
          font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
          color: #4d5a66;
        }
        .editorPanel {
          border: 1px solid #d8dee4;
          border-radius: 10px;
          background: #f8fbfd;
          padding: 0.75rem;
        }
        .editorToolbar {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          margin-bottom: 0.7rem;
        }
        .libraryPanel {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.7rem;
          margin-bottom: 0.7rem;
        }
        .libraryPanel > div {
          border: 1px solid #d8dee4;
          border-radius: 8px;
          background: #fff;
          padding: 0.55rem;
        }
        .libraryPanel p {
          margin: 0 0 0.45rem;
          font-size: 0.82rem;
        }
        .libraryList {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }
        .libraryItem {
          min-width: 7.5rem;
          text-align: left;
          background: #f4f8fb;
          border: 1px solid #d5e0ea;
          border-radius: 8px;
          color: #1f3342;
          padding: 0.45rem;
          cursor: grab;
          display: flex;
          flex-direction: column;
          gap: 0.1rem;
        }
        .libraryItem small {
          font-size: 0.72rem;
          color: #4b6273;
        }
        .docControls {
          display: flex;
          gap: 0.4rem;
          margin-bottom: 0.4rem;
          align-items: center;
          flex-wrap: wrap;
        }
        .docStatus {
          margin: 0.2rem 0 0;
          font-size: 0.8rem;
          color: #21465d;
        }
        .editorToolbar label {
          margin-bottom: 0;
          flex: 1;
        }
        .editorViewport {
          border: 1px solid #ced9e3;
          background: #eaf0f5;
          border-radius: 8px;
          overflow: auto;
          padding: 0.75rem;
        }
        .editorGrid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 0.7rem;
          align-items: start;
        }
        .canvasBoard {
          position: relative;
          margin: 0 auto;
          background:
            linear-gradient(to right, rgba(15, 123, 108, 0.08) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(15, 123, 108, 0.08) 1px, transparent 1px),
            #ffffff;
          background-size: 20px 20px;
          border: 1px solid #b7c6d4;
          border-radius: 8px;
        }
        .canvasObject {
          position: absolute;
          border: 1px solid #0f7b6c;
          background: rgba(15, 123, 108, 0.12);
          color: #173444;
          border-radius: 6px;
          padding: 0.2rem 0.3rem;
          text-align: left;
          overflow: hidden;
          cursor: move;
          font-size: 0.72rem;
          display: flex;
          flex-direction: column;
          gap: 0.1rem;
        }
        .canvasObject.selected {
          border-color: #d95f02;
          background: rgba(217, 95, 2, 0.13);
        }
        .canvasObject small {
          font-size: 0.65rem;
          opacity: 0.85;
        }
        .resizeHandle {
          position: absolute;
          width: 9px;
          height: 9px;
          border-radius: 2px;
          border: 1px solid #123746;
          background: #ffffff;
        }
        .resizeHandle.n {
          top: -5px;
          left: calc(50% - 5px);
          cursor: ns-resize;
        }
        .resizeHandle.s {
          bottom: -5px;
          left: calc(50% - 5px);
          cursor: ns-resize;
        }
        .resizeHandle.e {
          right: -5px;
          top: calc(50% - 5px);
          cursor: ew-resize;
        }
        .resizeHandle.w {
          left: -5px;
          top: calc(50% - 5px);
          cursor: ew-resize;
        }
        .resizeHandle.ne {
          top: -5px;
          right: -5px;
          cursor: nesw-resize;
        }
        .resizeHandle.nw {
          top: -5px;
          left: -5px;
          cursor: nwse-resize;
        }
        .resizeHandle.se {
          right: -5px;
          bottom: -5px;
          cursor: nwse-resize;
        }
        .resizeHandle.sw {
          left: -5px;
          bottom: -5px;
          cursor: nesw-resize;
        }
        .inspector {
          border: 1px solid #d8dee4;
          border-radius: 8px;
          background: #fff;
          padding: 0.55rem;
        }
        .inspector h3,
        .variablesPanel h3 {
          margin: 0 0 0.55rem;
          font-size: 0.92rem;
        }
        .inspectorFields {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
        }
        .inspectorFields label {
          margin: 0;
          font-size: 0.8rem;
        }
        .inspectorFields .fullWidth {
          grid-column: 1 / -1;
        }
        .inspectorFields input {
          margin-top: 0.2rem;
        }
        .variablesPanel {
          margin-top: 0.75rem;
          border: 1px solid #d8dee4;
          border-radius: 8px;
          background: #fff;
          padding: 0.55rem;
        }
        .varHead, .varRow {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 1fr 0.8fr 1.4fr;
          gap: 0.35rem;
          align-items: center;
        }
        .varHead {
          font-size: 0.74rem;
          font-weight: 700;
          color: #3c5668;
          margin-bottom: 0.35rem;
        }
        .varRow {
          margin-bottom: 0.35rem;
        }
        .varRow input, .varRow select {
          margin-top: 0;
          padding: 0.4rem;
          font-size: 0.77rem;
        }
        .valid {
          font-size: 0.73rem;
          color: #13715f;
        }
        .invalid {
          font-size: 0.73rem;
          color: #ad1f1f;
        }
        .editorMeta {
          margin-top: 0.6rem;
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem 0.7rem;
          font-size: 0.83rem;
          color: #385060;
        }
        .editorError {
          border: 1px solid #dd3b3b;
          background: #fff1f1;
          color: #8d1d1d;
          border-radius: 8px;
          padding: 0.65rem 0.7rem;
        }
        .visualMode {
          min-height: calc(100vh - 3rem);
          display: flex;
          flex-direction: column;
        }
        .editorStudio {
          display: grid;
          grid-template-rows: auto 1fr;
          min-height: calc(100vh - 13rem);
          border: 1px solid #d8dee4;
          border-radius: 12px;
          overflow: hidden;
          background: #f3f8fc;
        }
        .studioTopbar {
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 0.5rem;
          align-items: center;
          background: #ffffff;
          border-bottom: 1px solid #d8dee4;
          padding: 0.45rem 0.55rem;
        }
        .toolbarGroup {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          min-width: 0;
        }
        .zoomLabel {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          margin: 0;
          font-size: 0.78rem;
          min-width: 10rem;
        }
        .zoomLabel input {
          margin: 0;
        }
        .zoomBadge {
          font-family: Consolas, "Courier New", monospace;
          font-size: 0.75rem;
          color: #32576d;
          min-width: 3.1rem;
        }
        .mini {
          padding: 0.35rem 0.55rem;
          font-size: 0.75rem;
          border-radius: 6px;
        }
        .docs input,
        .docs select {
          margin: 0;
          padding: 0.35rem;
          font-size: 0.76rem;
        }
        .docs input {
          min-width: 9rem;
        }
        .studioBody {
          display: grid;
          grid-template-columns: 250px minmax(0, 1fr) 280px;
          min-height: 0;
        }
        .leftSidebar,
        .rightSidebar {
          background: #fff;
          border-right: 1px solid #d8dee4;
          padding: 0.5rem;
          overflow: auto;
        }
        .rightSidebar {
          border-right: 0;
          border-left: 1px solid #d8dee4;
        }
        .leftSidebar h3,
        .rightSidebar h3 {
          margin: 0 0 0.45rem;
          font-size: 0.86rem;
        }
        .leftSidebar h4 {
          margin: 0.6rem 0 0.35rem;
          font-size: 0.8rem;
          color: #355264;
        }
        .paletteGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.3rem;
        }
        .paletteCard {
          border: 1px solid #d6e1e9;
          border-radius: 8px;
          padding: 0.3rem;
          background: #f7fbff;
        }
        .iconBtn {
          width: 100%;
          background: #eef6ff;
          border: 1px solid #cfdde9;
          color: #1b3448;
          border-radius: 6px;
          padding: 0.2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.05rem;
          cursor: grab;
        }
        .iconBtn .ico {
          font-family: Consolas, "Courier New", monospace;
          font-size: 0.72rem;
          font-weight: 700;
          line-height: 1.1;
        }
        .iconBtn small {
          font-size: 0.66rem;
          line-height: 1;
        }
        .paletteActions {
          margin-top: 0.25rem;
          display: flex;
          gap: 0.25rem;
          justify-content: center;
        }
        .elementForm {
          display: grid;
          gap: 0.3rem;
        }
        .elementForm input,
        .elementForm select {
          margin: 0;
          padding: 0.3rem;
          font-size: 0.74rem;
        }
        .sizeRow {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.3rem;
        }
        .formActions {
          display: flex;
          gap: 0.3rem;
        }
        .canvasArea {
          min-width: 0;
          min-height: 0;
          background: #e9f0f7;
          display: flex;
          flex-direction: column;
        }
        .canvasViewport {
          flex: 1;
          min-height: 0;
          overflow: auto;
          padding: 0.6rem;
        }
        .canvasBoard {
          margin: 0 auto;
        }
        .inspectorFields {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.35rem;
        }
        .inspectorFields label {
          margin: 0;
          font-size: 0.75rem;
        }
        .inspectorFields label input {
          margin: 0.15rem 0 0;
          padding: 0.3rem;
          font-size: 0.74rem;
        }
        .inspectorFields .full {
          grid-column: 1 / -1;
        }
        .status {
          margin: 0.45rem 0 0;
          font-size: 0.75rem;
          color: #274e67;
        }
        .meta {
          margin-top: 0.55rem;
          display: grid;
          gap: 0.2rem;
          font-size: 0.74rem;
          color: #304f62;
        }
        @media (max-width: 800px) {
          .row {
            flex-direction: column;
            align-items: stretch;
          }
          .actions, .resultActions, .viewToggle {
            flex-wrap: wrap;
          }
          .history li {
            grid-template-columns: 1fr;
          }
          .editorGrid {
            grid-template-columns: 1fr;
          }
          .libraryPanel {
            grid-template-columns: 1fr;
          }
          .studioTopbar {
            grid-template-columns: 1fr;
          }
          .studioBody {
            grid-template-columns: 1fr;
          }
          .leftSidebar,
          .rightSidebar {
            border: 0;
            border-top: 1px solid #d8dee4;
          }
          .varHead, .varRow {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}
