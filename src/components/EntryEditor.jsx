import React, { useState } from "react";
import Modal from "./Modal.jsx";
import { id, checkEntry, conflicts } from "../domain.js";
export default function EntryEditor({
  state,
  initial,
  onSave,
  onDelete,
  onClose,
}) {
  const [entry, setEntry] = useState(initial),
    [complete, setComplete] = useState(false),
    [override, setOverride] = useState(false),
    [error, setError] = useState("");
  const change = (k, v) => {
    setEntry({ ...entry, [k]: v });
    setOverride(false);
    setError("");
  };
  const warnings = checkEntry(entry) ? [] : conflicts(state, entry);
  function submit(e) {
    e.preventDefault();
    const err = checkEntry(entry);
    if (err) return setError(err);
    if (warnings.includes("duplicado"))
      return setError("Ya existe este registro. No se guardó otro duplicado.");
    if (warnings.length && !override)
      return setError("Revisa el aviso y confirma para guardar.");
    onSave(
      {
        ...entry,
        id: entry.id || id(),
        start: entry.kind === "off" ? "" : entry.start,
        end: entry.kind === "off" ? "" : entry.end,
        updatedAt: new Date().toISOString(),
      },
      complete,
    );
  }
  return (
    <Modal
      title={initial.id ? "Editar registro" : "Añadir turno o día libre"}
      onClose={onClose}
    >
      <form onSubmit={submit} className="form-stack">
        <label>
          Persona
          <select
            aria-label="Persona"
            value={entry.profileId}
            onChange={(e) => change("profileId", e.target.value)}
          >
            {state.profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div className="form-row">
          <label>
            Fecha
            <input
              required
              type="date"
              min="1900-01-01"
              max="2100-12-31"
              value={entry.date}
              onChange={(e) => change("date", e.target.value)}
            />
          </label>
          <label>
            Tipo
            <select
              aria-label="Tipo"
              value={entry.kind}
              onChange={(e) => change("kind", e.target.value)}
            >
              <option value="shift">Turno de trabajo</option>
              <option value="off">Día libre confirmado</option>
            </select>
          </label>
        </div>
        <label>
          Nombre del registro
          <input
            maxLength={100}
            value={entry.label}
            onChange={(e) => change("label", e.target.value)}
            placeholder="Ej. Mañana"
          />
        </label>
        {entry.kind === "shift" && (
          <>
            <div className="form-row">
              <label>
                Entrada
                <input
                  required
                  type="time"
                  value={entry.start}
                  onChange={(e) => change("start", e.target.value)}
                />
              </label>
              <label>
                Salida
                <input
                  required
                  type="time"
                  value={entry.end}
                  onChange={(e) => change("end", e.target.value)}
                />
              </label>
            </div>
            <p className="hint">
              Salida anterior a entrada: termina al día siguiente. Horas locales
              en {state.settings.timezone}.
            </p>
            <label className="check">
              <input
                type="checkbox"
                checked={complete}
                onChange={(e) => setComplete(e.target.checked)}
              />
              He registrado todos los turnos de esta persona en este día. El
              resto se puede considerar libre.
            </label>
          </>
        )}
        {warnings.length > 0 && (
          <div className="warning">
            Aviso: {warnings.join(", ")}.
            {!warnings.includes("duplicado") && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={override}
                  onChange={(e) => setOverride(e.target.checked)}
                />
                He revisado el solape y quiero guardarlo.
              </label>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <footer className="actions">
          {initial.id && (
            <button
              type="button"
              className="danger"
              onClick={() => onDelete(initial.id)}
            >
              Mover a papelera
            </button>
          )}
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary" type="submit">
            Guardar registro
          </button>
        </footer>
      </form>
    </Modal>
  );
}
