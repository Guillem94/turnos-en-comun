import React, { useState, useRef, useEffect } from "react";
import Modal from "./Modal.jsx";
import ImportReview from "./ImportReview.jsx";
import { defaultLegend, checkEntry, conflicts, id } from "../domain.js";
import { recognizeCalendar, candidateRegionPreview } from "../ocr.js";
import { openImageInput } from "../image-input.js";
export default function ImageImporter({ state, date, onClose, onInsert }) {
  const [person, setPerson] = useState(state.profiles[0].id),
    [month, setMonth] = useState(date.slice(0, 7)),
    [legend, setLegend] = useState(structuredClone(defaultLegend)),
    [legendOK, setLegendOK] = useState(false),
    [image, setImage] = useState(null),
    [url, setUrl] = useState(""),
    [angle, setAngle] = useState(0),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [result, setResult] = useState(null),
    [rows, setRows] = useState([]),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false),
    [complete, setComplete] = useState(false),
    [format, setFormat] = useState("auto"),
    [selection, setSelection] = useState({
      left: 0,
      top: 0,
      right: 100,
      bottom: 100,
    }),
    [sourceName, setSourceName] = useState(""),
    [evidenceImage, setEvidenceImage] = useState(null),
    [container, setContainer] = useState(null),
    [frame, setFrame] = useState("");
  const controller = useRef();
  const inputSession = useRef();
  const inputGeneration = useRef(0);
  const inputAbort = useRef();
  useEffect(
    () => () => {
      controller.current?.abort();
      inputGeneration.current++;
      inputSession.current?.close();
      inputAbort.current?.abort();
    },
    [],
  );
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  function reset() {
    setResult(null);
    setRows([]);
    setConfirm(false);
    setError("");
    setSourceName("");
    setEvidenceImage(null);
  }
  async function upload(e) {
    reset();
    const f = e.target.files[0];
    if (!f) return;
    const generation = ++inputGeneration.current;
    inputAbort.current?.abort();
    inputAbort.current = new AbortController();
    inputSession.current?.close();
    inputSession.current = null;
    setContainer(null);
    setFrame("");
    setImage(null);
    setUrl("");
    setBusy(true);
    setStatus("Comprobando y decodificando la imagen localmente…");
    try {
      const session = await openImageInput(f, inputAbort.current.signal);
      if (generation !== inputGeneration.current) {
        session.close();
        return;
      }
      inputSession.current = session;
      setContainer({ format: session.format, frames: session.frames });
      if (session.frames.length === 1) {
        const decoded = await session.decode(0);
        if (generation !== inputGeneration.current) {
          URL.revokeObjectURL(decoded.url);
          return;
        }
        setFrame("0");
        setUrl(decoded.url);
        setImage(decoded.image);
      }
    } catch (err) {
      if (generation === inputGeneration.current && err.name !== "AbortError")
        setError(err.message);
    } finally {
      if (generation === inputGeneration.current) {
        setBusy(false);
        setStatus("");
      }
    }
  }
  async function selectFrame(value) {
    reset();
    setImage(null);
    setUrl("");
    setFrame(value);
    if (value === "") return;
    const generation = inputGeneration.current;
    setBusy(true);
    setStatus("Preparando la página o fotograma seleccionado…");
    try {
      const decoded = await inputSession.current.decode(Number(value));
      if (generation !== inputGeneration.current) {
        URL.revokeObjectURL(decoded.url);
        return;
      }
      setUrl(decoded.url);
      setImage(decoded.image);
    } catch (err) {
      if (generation === inputGeneration.current && err.name !== "AbortError")
        setError(err.message);
    } finally {
      if (generation === inputGeneration.current) {
        setBusy(false);
        setStatus("");
      }
    }
  }
  async function analyze() {
    reset();
    setBusy(true);
    controller.current = new AbortController();
    try {
      const r = await recognizeCalendar(image, {
        month,
        legend,
        angle: Number(angle),
        selection,
        format,
        onProgress: setStatus,
        signal: controller.current.signal,
      });
      if (!controller.current.signal.aborted) {
        setResult(r);
        setRows(r.rows.map((r) => ({ ...r, key: id() })));
      }
    } catch (e) {
      if (e.name !== "AbortError")
        setError(
          "No se pudo completar el OCR local. " +
            e.message +
            " Puedes introducir las filas manualmente.",
        );
    } finally {
      setBusy(false);
      setStatus("");
    }
  }
  function edit(key, k, v) {
    setRows(
      rows.map((r) =>
        r.key === key
          ? { ...r, [k]: v, approved: k === "approved" ? v : false }
          : r,
      ),
    );
    setConfirm(false);
  }
  const checked = [];
  const visibleRows = sourceName
    ? rows.filter(
        (r) =>
          r.sourcePerson === sourceName ||
          (!r.sourcePerson && r.source === "Manual"),
      )
    : rows;
  const reviewed = visibleRows.map((r) => {
    const e = { ...r, id: r.key, profileId: person };
    const invalid =
      checkEntry(e) ||
      ((r.sourcePerson || result?.people?.length) && !sourceName
        ? "Confirma la persona de origen de esta tabla antes de revisar."
        : "");
    const issues = invalid ? [] : conflicts(state, e, checked);
    if (r.approved && !invalid && !issues.length) checked.push(e);
    return { ...r, invalid, issues };
  });
  function insert() {
    const ready = reviewed.filter(
      (r) => r.approved && !r.invalid && !r.issues.length,
    );
    if (!confirm || !ready.length) return;
    onInsert(
      ready.map((r) => ({
        id: id(),
        profileId: person,
        date: r.date,
        kind: r.kind,
        start: r.kind === "off" ? "" : r.start,
        end: r.kind === "off" ? "" : r.end,
        label: r.label.slice(0, 100),
        updatedAt: new Date().toISOString(),
      })),
      complete,
    );
  }
  return (
    <Modal
      title="Importar imagen del calendario"
      onClose={() => {
        controller.current?.abort();
        onClose();
      }}
      wide
    >
      <div className="form-stack">
        <p>
          Lectura en este dispositivo con Tesseract.js. No se envían imágenes,
          texto ni turnos a proveedores. Detecta distintas disposiciones
          legibles: meses, semanas, listas y tablas por persona. Si faltan
          datos, quedan pendientes; no es una interpretación universal
          garantizada.
        </p>
        <div className="form-row">
          <label>
            Persona
            <select
              aria-label="Persona"
              disabled={busy}
              value={person}
              onChange={(e) => {
                setPerson(e.target.value);
                reset();
              }}
            >
              {state.profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mes y año
            <input
              required
              type="month"
              min="1900-01"
              max="2100-12"
              disabled={busy}
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                reset();
              }}
            />
          </label>
          <label>
            Corregir giro (-180 a 180°)
            <input
              type="number"
              min="-180"
              max="180"
              step="0.5"
              value={angle}
              disabled={busy}
              onChange={(e) => {
                setAngle(e.target.value);
                reset();
              }}
            />
          </label>
        </div>
        <details className="layout-options">
          <summary>Disposición y recorte local (opcional)</summary>
          <label>
            Formato esperado
            <select
              aria-label="Formato esperado"
              value={format}
              disabled={busy}
              onChange={(e) => {
                setFormat(e.target.value);
                reset();
              }}
            >
              <option value="auto">Detectar automáticamente</option>
              <option value="monthly">Mes con o sin bordes</option>
              <option value="weekly">Agenda semanal con fechas</option>
              <option value="list">Lista de fechas y horarios</option>
              <option value="people">Tabla de turnos por persona</option>
            </select>
          </label>
          <p className="hint">
            Recorta márgenes o una sola persona si hay ruido. Porcentajes de la
            imagen original; luego se aplica el giro. El recorte no completa
            información que falte.
          </p>
          <div className="form-row">
            {[
              ["left", "Izquierda"],
              ["top", "Arriba"],
              ["right", "Derecha"],
              ["bottom", "Abajo"],
            ].map(([key, label]) => (
              <label key={key}>
                {label} (%)
                <input
                  aria-label={`Recorte ${label}`}
                  disabled={busy}
                  type="number"
                  min="0"
                  max="100"
                  value={selection[key]}
                  onChange={(e) => {
                    setSelection({
                      ...selection,
                      [key]: Number(e.target.value),
                    });
                    reset();
                  }}
                />
              </label>
            ))}
          </div>
        </details>
        <details open={!result}>
          <summary>
            Leyenda de esta imagen · horarios de ejemplo, revísalos
          </summary>
          <div className="legend-editor">
            {Object.entries(legend).map(([code, v]) => (
              <div className="legend-row" key={code}>
                <strong>{code}</strong>
                <label>
                  Tipo {code}
                  <select
                    aria-label={"Tipo código " + code}
                    disabled={busy}
                    value={v.kind}
                    onChange={(e) => {
                      setLegend({
                        ...legend,
                        [code]: {
                          ...v,
                          kind: e.target.value,
                          start: v.start || "08:00",
                          end: v.end || "16:00",
                        },
                      });
                      setLegendOK(false);
                      reset();
                    }}
                  >
                    <option value="shift">Turno</option>
                    <option value="off">Libre</option>
                  </select>
                </label>
                {v.kind === "shift" && (
                  <>
                    <label>
                      Entrada {code}
                      <input
                        type="time"
                        disabled={busy}
                        value={v.start}
                        onChange={(e) => {
                          setLegend({
                            ...legend,
                            [code]: { ...v, start: e.target.value },
                          });
                          setLegendOK(false);
                          reset();
                        }}
                      />
                    </label>
                    <label>
                      Salida {code}
                      <input
                        type="time"
                        disabled={busy}
                        value={v.end}
                        onChange={(e) => {
                          setLegend({
                            ...legend,
                            [code]: { ...v, end: e.target.value },
                          });
                          setLegendOK(false);
                          reset();
                        }}
                      />
                    </label>
                  </>
                )}
              </div>
            ))}
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={legendOK}
              disabled={busy}
              onChange={(e) => setLegendOK(e.target.checked)}
            />
            Confirmo que M/T/N/L significan estos horarios en esta imagen. Los
            códigos distintos quedarán pendientes.
          </label>
        </details>
        <div className="image-tools">
          <label className="file-label">
            Elegir imagen
            <input
              aria-label="Elegir imagen del calendario"
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.heic,.heif,.avif,.bmp,.tif,.tiff,.gif,image/png,image/jpeg,image/webp,image/heic,image/heif,image/avif,image/bmp,image/tiff,image/gif"
              disabled={busy}
              onChange={upload}
            />
          </label>
          <button
            className="primary"
            disabled={
              !image ||
              !legendOK ||
              busy ||
              !month ||
              Object.values(legend).some(
                (l) =>
                  l.kind === "shift" &&
                  checkEntry({ ...l, date: month + "-01", label: "" }),
              )
            }
            onClick={analyze}
          >
            {busy ? "Analizando…" : "Analizar en este dispositivo"}
          </button>
        </div>
        <p className="hint">
          PNG, JPEG, WebP, HEIC/HEIF estático, AVIF estático de una imagen, BMP,
          TIFF y GIF. Conversión local; máximo 12 MB, 16 megapíxeles por imagen
          y 32 páginas o fotogramas (64 megapíxeles en conjunto). Las
          animaciones requieren un navegador con ImageDecoder. Decodificar el
          archivo no garantiza comprender su calendario. PDF, SVG, RAW y
          secuencias HEIF temporales no están soportados. AVIF animado o con
          varios elementos requiere exportar una imagen a PNG.
        </p>
        {container && (
          <div className="input-format">
            <p role="status">
              Archivo {container.format.toUpperCase()} ·{" "}
              {container.frames.length}
              {container.frames.length === 1
                ? " imagen"
                : " páginas o fotogramas"}
              .
            </p>
            {container.frames.length > 1 && (
              <label>
                Página o fotograma para revisar
                <select
                  aria-label="Página o fotograma para revisar"
                  disabled={busy}
                  value={frame}
                  onChange={(e) => selectFrame(e.target.value)}
                >
                  <option value="">Selecciona explícitamente una imagen</option>
                  {container.frames.map((f, i) => (
                    <option key={i} value={i}>
                      {i + 1}
                      {f.primary ? " (principal)" : ""}
                      {f.width ? ` · ${f.width} × ${f.height}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}
        {url && (
          <img
            className="import-image"
            src={url}
            alt="Imagen del calendario en revisión; no se guardará"
            style={{ transform: `rotate(${angle}deg)` }}
          />
        )}
        {busy && <p role="status">{status}</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {result && (
          <>
            <div className="warning">
              <strong>
                {state.profiles.find((p) => p.id === person).name} · {month}
              </strong>
              <p>{result.warning}</p>
              <p>
                Disposición:{" "}
                <strong>
                  {
                    {
                      "monthly-grid": "Mes con bordes",
                      "monthly-borderless": "Mes sin bordes",
                      weekly: "Agenda semanal",
                      "people-table": "Tabla por persona",
                      "people-columns": "Tabla con personas por columna",
                      "date-list": "Lista de fechas",
                      unknown: "Desconocida",
                    }[result.format]
                  }
                </strong>{" "}
                · {result.rows.length} candidatos
              </p>
            </div>
            {result.people?.length > 0 && (
              <label>
                {result.format === "people-columns"
                  ? "Columna de origen confirmada"
                  : "Fila de origen confirmada"}
                <select
                  aria-label={
                    result.format === "people-columns"
                      ? "Columna de origen confirmada"
                      : "Fila de origen confirmada"
                  }
                  value={sourceName}
                  onChange={(e) => {
                    setSourceName(e.target.value);
                    setRows(rows.map((r) => ({ ...r, approved: false })));
                    setConfirm(false);
                    setEvidenceImage(null);
                  }}
                >
                  <option value="">
                    Selecciona la persona de origen que quieres importar
                  </option>
                  {result.people.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <span className="hint">
                  Se importará solo esa{" "}
                  {result.format === "people-columns" ? "columna" : "fila"} para{" "}
                  {state.profiles.find((p) => p.id === person).name}. Los
                  nombres detectados no se enlazan automáticamente con perfiles.
                </span>
              </label>
            )}
            {evidenceImage && (
              <figure className="evidence-preview">
                <img
                  src={evidenceImage}
                  alt="Región OCR seleccionada para comprobar el candidato"
                />
                <figcaption>
                  Regiones de la imagen analizada: turno, fecha y persona de
                  origen cuando sus cabeceras estén disponibles. Comprueba que
                  corresponden al mismo registro.
                </figcaption>
              </figure>
            )}
            <p className="hint">
              Cada casilla “Revisado” autoriza esa fila, incluso si la lectura
              fue dudosa. Duplicados, errores y conflictos se excluyen. El resto
              del día solo será libre si lo confirmas al final.
            </p>
          </>
        )}
        {(result || error) && (
          <>
            <ImportReview
              rows={reviewed}
              onEdit={edit}
              onRemove={(key) => setRows(rows.filter((r) => r.key !== key))}
              onEvidence={(r) =>
                setEvidenceImage(
                  candidateRegionPreview(result?.canvas, r.evidence),
                )
              }
            />
            <button
              onClick={() =>
                setRows([
                  ...rows,
                  {
                    key: id(),
                    date: month + "-01",
                    kind: "shift",
                    start: "08:00",
                    end: "16:00",
                    label: "Manual",
                    raw: "",
                    source: "Manual",
                    sourcePerson: sourceName || null,
                    approved: false,
                  },
                ])
              }
            >
              Añadir fila manual
            </button>
            {result && (
              <details>
                <summary>
                  Texto OCR parcial (solo durante esta revisión)
                </summary>
                <pre>{result.raw || "No se reconoció texto."}</pre>
              </details>
            )}
            <label className="check">
              <input
                type="checkbox"
                checked={complete}
                onChange={(e) => setComplete(e.target.checked)}
              />
              Confirmo que las fechas seleccionadas contienen todos los turnos
              de esta persona. Considerar libre el resto de esos días.
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={confirm}
                onChange={(e) => setConfirm(e.target.checked)}
              />
              Confirmo persona, mes, leyenda y filas revisadas antes de
              insertar.
            </label>
          </>
        )}
        <footer className="actions">
          <span className="hint">
            La imagen se descarta al cerrar. Cancelar no cambia tus datos.
          </span>
          <button onClick={onClose}>Cancelar importación</button>
          <button
            className="primary"
            disabled={
              !confirm ||
              !reviewed.some(
                (r) => r.approved && !r.invalid && !r.issues.length,
              ) ||
              busy
            }
            onClick={insert}
          >
            Insertar filas revisadas (
            {
              reviewed.filter(
                (r) => r.approved && !r.invalid && !r.issues.length,
              ).length
            }
            )
          </button>
        </footer>
      </div>
    </Modal>
  );
}
