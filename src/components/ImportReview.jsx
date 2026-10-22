import React from "react";

export default function ImportReview({ rows, onEdit, onRemove, onEvidence }) {
  return (
    <div className="preview-table-wrap import-review-wrap">
      <table className="preview-table import-review-table">
        <caption className="review-caption">
          Registros candidatos para revisión
        </caption>
        <thead>
          <tr>
            <th scope="col">Revisado</th>
            <th scope="col">Fecha</th>
            <th scope="col">Tipo</th>
            <th scope="col">Entrada</th>
            <th scope="col">Salida</th>
            <th scope="col">Lectura y avisos</th>
            <th scope="col">Quitar</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.key}>
              <td className="review-approval-cell">
                <label className="review-approval">
                  <input
                    aria-label={`Revisado fila ${i + 1}`}
                    type="checkbox"
                    checked={r.approved}
                    disabled={!!r.invalid || r.issues.length > 0}
                    onChange={(e) =>
                      onEdit(r.key, "approved", e.target.checked)
                    }
                  />
                  <span className="review-mobile-title" aria-hidden="true">
                    Revisado fila {i + 1}
                  </span>
                </label>
              </td>
              <td className="review-field" data-label="Fecha">
                <span className="review-field-label" aria-hidden="true">
                  Fecha
                </span>
                <input
                  aria-label={`Fecha fila ${i + 1}`}
                  type="date"
                  value={r.date || ""}
                  onChange={(e) => onEdit(r.key, "date", e.target.value)}
                />
              </td>
              <td className="review-field" data-label="Tipo">
                <span className="review-field-label" aria-hidden="true">
                  Tipo
                </span>
                <select
                  aria-label={`Tipo fila ${i + 1}`}
                  value={r.kind || ""}
                  onChange={(e) => onEdit(r.key, "kind", e.target.value)}
                >
                  <option value="" disabled>
                    Pendiente
                  </option>
                  <option value="shift">Turno</option>
                  <option value="off">Libre</option>
                </select>
              </td>
              <td className="review-field" data-label="Entrada">
                <span className="review-field-label" aria-hidden="true">
                  Entrada
                </span>
                <input
                  aria-label={`Entrada fila ${i + 1}`}
                  type="time"
                  disabled={r.kind === "off"}
                  value={r.start || ""}
                  onChange={(e) => onEdit(r.key, "start", e.target.value)}
                />
              </td>
              <td className="review-field" data-label="Salida">
                <span className="review-field-label" aria-hidden="true">
                  Salida
                </span>
                <input
                  aria-label={`Salida fila ${i + 1}`}
                  type="time"
                  disabled={r.kind === "off"}
                  value={r.end || ""}
                  onChange={(e) => onEdit(r.key, "end", e.target.value)}
                />
              </td>
              <td className="review-reading-cell">
                <small>
                  {r.raw || "Fila manual"} · {r.source}
                </small>
                {r.sourcePerson && <small>Origen: {r.sourcePerson}</small>}
                {r.evidence?.header && (
                  <small>Cabecera: {r.evidence.header}</small>
                )}
                {r.evidence?.personHeader && (
                  <small>Persona en cabecera: {r.evidence.personHeader}</small>
                )}
                {r.evidence?.bbox && (
                  <button
                    type="button"
                    className="text-btn"
                    aria-label={`Ver evidencia fila ${i + 1}`}
                    onClick={() => onEvidence(r)}
                  >
                    Ver evidencia
                  </button>
                )}
                <span className="hint">{r.warning}</span>
                <strong className="error">
                  {r.invalid || r.issues.join(", ")}
                </strong>
              </td>
              <td className="review-remove-cell">
                <button
                  type="button"
                  aria-label={`Quitar fila ${i + 1}`}
                  onClick={() => onRemove(r.key)}
                >
                  <span className="review-remove-icon" aria-hidden="true">
                    ×
                  </span>
                  <span className="review-remove-label" aria-hidden="true">
                    Quitar fila
                  </span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
