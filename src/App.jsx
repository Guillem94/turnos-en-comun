import React, { useState, lazy, Suspense } from "react";
import {
  emptyState,
  demoState,
  localToday,
  entriesOn,
  prettyDate,
  validateBackup,
  active,
  conflicts,
} from "./domain.js";
import { load, persist, download } from "./storage.js";
import { exportICS } from "./ics.js";
import Calendar from "./components/Calendar.jsx";
import Availability from "./components/Availability.jsx";
import EntryEditor from "./components/EntryEditor.jsx";
import Settings from "./components/Settings.jsx";
import Modal from "./components/Modal.jsx";
const ImageImporter = lazy(() => import("./components/ImageImporter.jsx"));
function init() {
  let mode = "personal";
  try {
    mode = sessionStorage.getItem("tec-mode") === "demo" ? "demo" : "personal";
    const saved = load(mode);
    return {
      mode,
      state: mode === "demo" && !saved.onboarded ? demoState() : saved,
      error: "",
    };
  } catch (e) {
    return {
      mode,
      state: emptyState(),
      error:
        "No se pudo leer la copia local. No se sobrescribirá. Exporta el contenido para recuperación antes de restaurar: " +
        e.message,
    };
  }
}
export default function App() {
  const [initial] = useState(init),
    [state, setState] = useState(initial.state),
    [mode, setMode] = useState(initial.mode),
    [readError, setReadError] = useState(initial.error),
    [date, setDate] = useState(localToday()),
    [view, setView] = useState("month"),
    [page, setPage] = useState("calendar"),
    [editor, setEditor] = useState(null),
    [importer, setImporter] = useState(false),
    [restore, setRestore] = useState(null),
    [message, setMessage] = useState(""),
    [history, setHistory] = useState([]),
    [names, setNames] = useState(["Ana", "Luis"]);
  function commit(next, msg) {
    if (readError) {
      setMessage("Resuelve la lectura de datos antes de guardar.");
      return false;
    }
    try {
      const valid = validateBackup(next);
      persist(mode, valid);
      setHistory((h) => [...h.slice(-19), state]);
      setState(valid);
      setMessage(msg);
      return true;
    } catch (e) {
      setMessage("No se guardó el cambio: " + e.message);
      return false;
    }
  }
  function switchMode() {
    const next = mode === "personal" ? "demo" : "personal";
    try {
      let saved = load(next);
      if (next === "demo" && !saved.onboarded)
        saved = demoState(date.slice(0, 7));
      setState(saved);
      setMode(next);
      sessionStorage.setItem("tec-mode", next);
      setHistory([]);
      setReadError("");
      setPage("calendar");
      setMessage(
        next === "demo"
          ? "Demostración ficticia. Tus datos personales están separados."
          : "Has vuelto a tus datos locales.",
      );
    } catch (e) {
      setMessage("No se pudo abrir el espacio: " + e.message);
    }
  }
  function saveEntry(entry, complete) {
    const original = state.entries.find((e) => e.id === entry.id),
      exists = !!original,
      moved =
        original &&
        (original.date !== entry.date ||
          original.profileId !== entry.profileId),
      coverage = state.coverage.filter(
        (c) =>
          !(c.profileId === entry.profileId && c.date === entry.date) &&
          !(
            moved &&
            c.profileId === original.profileId &&
            c.date === original.date
          ),
      );
    if (complete)
      coverage.push({ profileId: entry.profileId, date: entry.date });
    else
      coverage.push(
        ...state.coverage.filter(
          (c) => c.profileId === entry.profileId && c.date === entry.date,
        ),
      );
    if (
      commit(
        {
          ...state,
          entries: exists
            ? state.entries.map((e) => (e.id === entry.id ? entry : e))
            : [...state.entries, entry],
          coverage,
        },
        "Registro guardado en este navegador.",
      )
    )
      setEditor(null);
  }
  function removeEntry(entryId) {
    const e = state.entries.find((e) => e.id === entryId);
    if (
      commit(
        {
          ...state,
          entries: state.entries.map((x) =>
            x.id === entryId
              ? { ...x, deletedAt: new Date().toISOString() }
              : x,
          ),
          coverage: state.coverage.filter(
            (c) => !(c.profileId === e.profileId && c.date === e.date),
          ),
        },
        "Registro movido a la papelera. Puedes recuperarlo o deshacer.",
      )
    )
      setEditor(null);
  }
  function confirmDay(profileId, checked) {
    const coverage = state.coverage.filter(
      (c) => !(c.profileId === profileId && c.date === date),
    );
    if (checked) coverage.push({ profileId, date });
    commit(
      { ...state, coverage },
      checked ? "Día completo confirmado." : "Confirmación retirada.",
    );
  }
  function undo() {
    if (!history.length) return;
    try {
      const previous = history.at(-1);
      persist(mode, previous);
      setState(previous);
      setHistory(history.slice(0, -1));
      setMessage("Último cambio deshecho.");
    } catch (e) {
      setMessage("No se pudo deshacer: " + e.message);
    }
  }
  function insert(entries, complete) {
    const coverage = [...state.coverage];
    if (complete)
      for (const e of entries)
        if (
          !coverage.some(
            (c) => c.profileId === e.profileId && c.date === e.date,
          )
        )
          coverage.push({ profileId: e.profileId, date: e.date });
    if (
      commit(
        { ...state, entries: [...state.entries, ...entries], coverage },
        `${entries.length} registros importados tras revisión.`,
      )
    )
      setImporter(false);
  }
  async function restoreFile(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("La copia supera 5 MB.");
      const candidate = validateBackup(JSON.parse(await file.text()));
      setRestore(candidate);
    } catch (err) {
      setMessage(err.message);
    }
  }
  function exportCalendar(person) {
    try {
      download(
        `turnos-${person}.ics`,
        exportICS(state, person),
        "text/calendar;charset=utf-8",
      );
      setMessage(
        "Archivo .ics descargado. Impórtalo en tu calendario; no se sincroniza.",
      );
    } catch (e) {
      setMessage(e.message);
    }
  }
  const dayEntries = entriesOn(state, date);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("calendar");
          }}
        >
          <span className="brand-symbol" aria-hidden="true">
            <i />
            <i />
          </span>
          <span>
            Turnos
            <br />
            <strong>en Común</strong>
          </span>
        </a>
        <p className="brand-sub">Dos agendas. Un tiempo compartido.</p>
        <nav aria-label="Principal">
          {[
            ["calendar", "Calendario"],
            ["free", "Tiempo en común"],
            ["settings", "Datos y ajustes"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={page === key ? "nav-active" : ""}
              onClick={() => setPage(key)}
            >
              <span aria-hidden="true">
                {key === "calendar" ? "▦" : key === "free" ? "◎" : "⚙"}
              </span>
              {label}
            </button>
          ))}
        </nav>
        <div className="people-label">VUESTRAS AGENDAS</div>
        <div className="people-list">
          {state.profiles.map((p) => (
            <div key={p.id}>
              <span className="person-dot" style={{ background: p.color }} />
              <strong>{p.name}</strong>
              <button
                className="text-btn"
                aria-label={`Editar perfil ${p.name}`}
                onClick={() => setPage("settings")}
              >
                Editar
              </button>
            </div>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="local-note">
            <strong>Guardado en tu navegador</strong>
            <span>Sin cuentas. Sin sincronización.</span>
          </div>
          <button className="demo-btn" onClick={switchMode}>
            {mode === "demo" ? "Volver a mis datos" : "Explorar demo ficticia"}
          </button>
          <small>Proyecto independiente · MVP local</small>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            {page === "calendar"
              ? "Vuestro calendario"
              : page === "free"
                ? "Encontrad vuestro momento"
                : "Todo bajo vuestro control"}
          </span>
          <span className="mode-label">
            {mode === "demo"
              ? "Demostración · datos ficticios"
              : "Solo en este dispositivo"}
          </span>
        </header>
        <div className="main-content">
          {readError && (
            <div className="error" role="alert">
              <p>{readError}</p>
              <button
                onClick={() =>
                  download(
                    "datos-locales-sin-validar.txt",
                    localStorage.getItem(`turnos-en-comun:v1:${mode}`) || "",
                    "text/plain",
                  )
                }
              >
                Descargar datos sin modificar
              </button>
              <button onClick={() => setPage("settings")}>
                Abrir restauración
              </button>
            </div>
          )}
          {mode === "demo" && (
            <div className="demo-banner">
              <span>
                Estás en una demo con Ana y Luis, dos personas ficticias. Puedes
                probar y editar.
              </span>
              <button onClick={switchMode}>Salir de la demo</button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <h1>
                {page === "calendar"
                  ? "Haced sitio para coincidir."
                  : page === "free"
                    ? "Un momento para los dos."
                    : "Vuestras preferencias."}
              </h1>
              <p>
                {page === "calendar"
                  ? "Organizad los turnos y descubrid cuándo tenéis tiempo libre en común."
                  : page === "free"
                    ? "Próximos 14 días, según los turnos y días completos confirmados."
                    : "Perfiles, copias de seguridad y exportación al calendario."}
              </p>
            </div>
            {page !== "settings" && (
              <div className="heading-actions">
                <button onClick={() => setImporter(true)}>
                  Importar imagen
                </button>
                <button
                  className="primary"
                  onClick={() =>
                    setEditor({
                      profileId: state.profiles[0].id,
                      date,
                      kind: "shift",
                      label: "Turno",
                      start: "08:00",
                      end: "16:00",
                    })
                  }
                >
                  + Añadir turno
                </button>
              </div>
            )}
          </div>
          {message && (
            <div className="notice" role="status">
              <span>{message}</span>
              {history.length > 0 && <button onClick={undo}>Deshacer</button>}
              <button
                className="icon-btn"
                aria-label="Cerrar aviso"
                onClick={() => setMessage("")}
              >
                ×
              </button>
            </div>
          )}
          {page === "calendar" ? (
            <div className="calendar-layout">
              <Calendar
                state={state}
                date={date}
                view={view}
                setDate={setDate}
                setView={setView}
                onSelect={setDate}
                onEdit={setEditor}
              />
              <aside className="detail-panel">
                <Availability state={state} date={date} />
                <section className="day-detail">
                  <h2>{prettyDate(date)}</h2>
                  <p className="muted">Revisión de los dos calendarios</p>
                  {state.profiles.map((p) => {
                    const items = dayEntries.filter(
                        (e) => e.profileId === p.id,
                      ),
                      isOff = items.some(
                        (e) => e.kind === "off" && e.date === date,
                      );
                    return (
                      <div className="person-day" key={p.id}>
                        <h3>
                          <span
                            className="person-dot"
                            style={{ background: p.color }}
                          />
                          {p.name}
                        </h3>
                        {items.length ? (
                          items.map((e) => (
                            <button
                              className="detail-event"
                              key={e.id}
                              onClick={() => setEditor(e)}
                            >
                              <strong>{e.label || "Turno"}</strong>
                              <span>
                                {e.kind === "off"
                                  ? "Día libre confirmado"
                                  : `${e.start}–${e.end}${e.end < e.start ? " (+1 día)" : ""}${e.date !== date ? " · empezó el " + e.date : ""}`}
                              </span>
                            </button>
                          ))
                        ) : (
                          <p className="empty-note">No hay registros.</p>
                        )}
                        <label className="check small-check">
                          <input
                            type="checkbox"
                            disabled={isOff}
                            checked={
                              isOff ||
                              state.coverage.some(
                                (c) => c.profileId === p.id && c.date === date,
                              )
                            }
                            onChange={(e) => confirmDay(p.id, e.target.checked)}
                          />
                          Día completo confirmado
                        </label>
                      </div>
                    );
                  })}
                  <p className="hint">
                    Confirma el día solo si has añadido todos sus turnos. Un día
                    libre registrado ya lo confirma.
                  </p>
                </section>
              </aside>
            </div>
          ) : page === "free" ? (
            <Availability
              state={state}
              date={date}
              long
              onSelect={(d) => {
                setDate(d);
                setPage("calendar");
              }}
            />
          ) : (
            <Settings
              key={mode}
              state={state}
              mode={mode}
              onSave={(s) => commit(s, "Preferencias guardadas.")}
              onExportJSON={() =>
                download(
                  `turnos-copia-${mode}.json`,
                  JSON.stringify(state, null, 2),
                  "application/json",
                )
              }
              onRestoreJSON={restoreFile}
              onExportICS={exportCalendar}
              onRestoreEntry={(entryId) =>
                commit(
                  {
                    ...state,
                    entries: state.entries.map((e) =>
                      e.id === entryId
                        ? Object.fromEntries(
                            Object.entries(e).filter(
                              ([k]) => k !== "deletedAt",
                            ),
                          )
                        : e,
                    ),
                  },
                  "Registro recuperado. Revisa y confirma su día de nuevo.",
                )
              }
            />
          )}
          <footer className="main-footer">
            <span>
              Zona común: <strong>{state.settings.timezone}</strong> · las
              fechas se conservan como horas locales
            </span>
            <span>Vuestros datos se quedan aquí.</span>
            <a
              href={`${import.meta.env.BASE_URL}legal/index.html`}
              target="_blank"
              rel="noreferrer"
            >
              Licencias y fuentes
            </a>
          </footer>
        </div>
      </main>
      {!state.onboarded && !readError && (
        <Modal title="Vuestro tiempo empieza aquí">
          <div className="form-stack">
            <p>
              Organizad dos calendarios en este navegador. Los datos se guardan
              localmente: no hay sincronización entre dispositivos ni cuentas.
            </p>
            <p>
              Un día sin datos no se considera libre. Podréis confirmar cuándo
              están registrados todos sus turnos.
            </p>
            <div className="form-row">
              {names.map((name, i) => (
                <label key={i}>
                  Nombre de la persona {i + 1}
                  <input
                    maxLength={40}
                    value={name}
                    onChange={(e) =>
                      setNames(
                        names.map((n, j) => (j === i ? e.target.value : n)),
                      )
                    }
                  />
                </label>
              ))}
            </div>
            <p className="hint">
              Zona inicial: Europe/Madrid. Puedes cambiarla en Datos y ajustes.
            </p>
            <button
              className="primary"
              disabled={names.some((n) => !n.trim())}
              onClick={() =>
                commit(
                  {
                    ...state,
                    onboarded: true,
                    profiles: state.profiles.map((p, i) => ({
                      ...p,
                      name: names[i].trim(),
                    })),
                  },
                  "Bienvenidos. Añade un turno o prueba la demo.",
                )
              }
            >
              Crear mi calendario local
            </button>
            <button onClick={switchMode}>
              Probar demo con datos ficticios
            </button>
          </div>
        </Modal>
      )}
      {editor && (
        <EntryEditor
          state={state}
          initial={editor}
          onSave={saveEntry}
          onDelete={removeEntry}
          onClose={() => setEditor(null)}
        />
      )}
      {importer && (
        <Suspense
          fallback={<div role="status">Abriendo importador local…</div>}
        >
          <ImageImporter
            state={state}
            date={date}
            onClose={() => setImporter(false)}
            onInsert={insert}
          />
        </Suspense>
      )}
      {restore && (
        <Modal
          title="Revisar restauración JSON"
          onClose={() => setRestore(null)}
        >
          <div className="form-stack">
            <p>
              Copia válida de esquema v1:{" "}
              {restore.profiles.map((p) => p.name).join(" y ")};{" "}
              {active(restore).length} registros activos y{" "}
              {restore.entries.length - active(restore).length} en papelera.
            </p>
            <p className="hint">
              Avisos entre registros:{" "}
              {
                active(restore).filter((e) => conflicts(restore, e).length > 0)
                  .length
              }{" "}
              registros con duplicados o conflictos. Se conservan para revisión;
              compruébalos en el calendario tras restaurar.
            </p>
            <p className="warning">
              Reemplazará los datos del espacio{" "}
              {mode === "demo" ? "de demostración" : "personal"} en este
              navegador. Se valida toda la copia antes de guardar. Puedes
              exportar tu copia actual primero y deshacer durante esta sesión.
            </p>
            <button
              onClick={() =>
                download(
                  "copia-antes-de-restaurar.json",
                  JSON.stringify(state, null, 2),
                  "application/json",
                )
              }
            >
              Exportar copia actual
            </button>
            <button
              className="primary"
              onClick={() => {
                if (readError) {
                  try {
                    persist(mode, restore);
                    setState(restore);
                    setReadError("");
                    setRestore(null);
                    setMessage("Copia restaurada.");
                  } catch (e) {
                    setMessage(e.message);
                  }
                } else if (commit(restore, "Copia restaurada íntegramente."))
                  setRestore(null);
              }}
            >
              Confirmar restauración
            </button>
            <button onClick={() => setRestore(null)}>Cancelar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
