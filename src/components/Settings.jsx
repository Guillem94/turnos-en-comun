import React, { useState, useEffect } from "react";
import { validateBackup, active, conflicts } from "../domain.js";
export default function Settings({
  state,
  onSave,
  onExportJSON,
  onRestoreJSON,
  onExportICS,
  onRestoreEntry,
  mode,
}) {
  const [draft, setDraft] = useState(structuredClone(state)),
    [error, setError] = useState("");
  useEffect(() => {
    setDraft(structuredClone(state));
  }, [state.profiles, state.settings]);
  function submit(e) {
    e.preventDefault();
    try {
      const next = validateBackup({
        ...state,
        profiles: draft.profiles,
        settings: draft.settings,
      });
      onSave(next);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  const deleted = state.entries.filter((e) => e.deletedAt);
  return (
    <div className="settings-layout">
      <form className="settings-section form-stack" onSubmit={submit}>
        <h2>Personas y preferencias</h2>
        <p className="muted">
          Horas locales de una zona común. Cambiar la zona conserva las fechas y
          horas escritas; cambia su interpretación al exportar.
        </p>
        {draft.profiles.map((p, i) => (
          <div className="profile-form form-row" key={p.id}>
            <label>
              Nombre de la persona {i + 1}
              <input
                required
                maxLength={40}
                value={p.name}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    profiles: draft.profiles.map((x, j) =>
                      j === i ? { ...x, name: e.target.value } : x,
                    ),
                  })
                }
              />
            </label>
            <label>
              Color de {p.name}
              <input
                type="color"
                value={p.color}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    profiles: draft.profiles.map((x, j) =>
                      j === i ? { ...x, color: e.target.value } : x,
                    ),
                  })
                }
              />
            </label>
          </div>
        ))}
        <label>
          Zona horaria IANA
          <input
            required
            list="timezones"
            value={draft.settings.timezone}
            onChange={(e) =>
              setDraft({
                ...draft,
                settings: { ...draft.settings, timezone: e.target.value },
              })
            }
          />
          <datalist id="timezones">
            <option>Europe/Madrid</option>
            <option>Atlantic/Canary</option>
            <option>Etc/UTC</option>
            <option>America/Mexico_City</option>
            <option>America/Argentina/Buenos_Aires</option>
          </datalist>
        </label>
        <h3>Franja para encontrar tiempo libre</h3>
        <div className="form-row">
          <label>
            Desde
            <input
              required
              type="time"
              value={draft.settings.windowStart}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  settings: { ...draft.settings, windowStart: e.target.value },
                })
              }
            />
          </label>
          <label>
            Hasta
            <input
              required
              type="time"
              value={draft.settings.windowEnd}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  settings: { ...draft.settings, windowEnd: e.target.value },
                })
              }
            />
          </label>
          <label>
            Mínimo (minutos)
            <input
              type="number"
              min="1"
              max="1440"
              required
              value={draft.settings.minMinutes}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  settings: {
                    ...draft.settings,
                    minMinutes: Number(e.target.value),
                  },
                })
              }
            />
          </label>
        </div>
        <p className="hint">
          La franja termina el mismo día y debe acabar después del inicio.
        </p>
        <label className="check">
          <input
            type="checkbox"
            checked={draft.settings.assumeFree}
            onChange={(e) =>
              setDraft({
                ...draft,
                settings: { ...draft.settings, assumeFree: e.target.checked },
              })
            }
          />
          Estimar libre fuera de turnos, incluso en días sin confirmar
        </label>
        <p className="hint">
          Desactivado por defecto: solo se muestran coincidencias cuando ambos
          han confirmado su día.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="primary" type="submit">
          Guardar preferencias
        </button>
      </form>
      <div>
        <section className="settings-section">
          <h2>Copias y calendario móvil</h2>
          <p>
            Datos de{" "}
            {mode === "demo" ? "la demostración ficticia" : "este navegador"}.
            El almacenamiento local no sincroniza dispositivos ni cuentas. No
            hay login ni notificaciones push.
          </p>
          <div className="form-stack">
            <button onClick={onExportJSON}>Exportar copia JSON</button>
            <label className="file-label">
              Restaurar copia JSON
              <input
                type="file"
                accept="application/json,.json"
                onChange={onRestoreJSON}
              />
            </label>
            <hr />
            <label>
              Exportar calendario
              <select id="export-person" defaultValue="all">
                <option value="all">Ambas personas</option>
                {state.profiles.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() =>
                onExportICS(document.getElementById("export-person").value)
              }
            >
              Descargar .ics
            </button>
            <p className="hint">
              Importa el archivo en tu calendario móvil. Es una exportación
              manual; las ediciones posteriores no se sincronizan. UID estable:
              el tratamiento de reimportaciones depende de tu calendario.
            </p>
          </div>
        </section>
        <section className="settings-section">
          <h2>
            Papelera <small>({deleted.length})</small>
          </h2>
          <p className="hint">
            Los registros borrados se conservan en este navegador y en la copia
            JSON.
          </p>
          {deleted.length === 0 ? (
            <p className="muted">No hay registros eliminados.</p>
          ) : (
            deleted.map((e) => {
              const issues = conflicts(state, e);
              return (
                <div className="trash-row" key={e.id}>
                  <span>
                    <strong>
                      {state.profiles.find((p) => p.id === e.profileId).name}
                    </strong>{" "}
                    · {e.date}
                    <small>
                      {e.label} {e.start}–{e.end}
                    </small>
                    {issues.length > 0 && (
                      <small className="error">{issues.join(", ")}</small>
                    )}
                  </span>
                  <button
                    disabled={issues.length > 0}
                    onClick={() => onRestoreEntry(e.id)}
                  >
                    Recuperar
                  </button>
                </div>
              );
            })
          )}
        </section>
        <section className="settings-section">
          <h2>Sobre este MVP</h2>
          <p>
            Aplicación independiente. Sin telemetría ni servicios externos. OCR
            limitado a cuadrículas regulares legibles y texto de días/horas;
            siempre requiere revisión.
          </p>
          <p className="hint">
            {active(state).length} registros activos · esquema JSON v1. Licencia
            propuesta: MIT, pendiente de decisión del propietario; sin
            publicación.
          </p>
        </section>
      </div>
    </div>
  );
}
