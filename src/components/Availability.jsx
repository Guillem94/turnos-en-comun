import React from "react";
import { commonFree, addDays, prettyDate } from "../domain.js";
export default function Availability({ state, date, long = false, onSelect }) {
  const dates = long
    ? Array.from({ length: 14 }, (_, i) => addDays(date, i))
    : [date];
  return (
    <section className={long ? "availability-page" : "availability"}>
      <div className="section-title">
        <span className="overlap-icon" aria-hidden="true">
          ◎
        </span>
        <h2>Tiempo en común</h2>
      </div>
      <p className="muted">
        Dentro de {state.settings.windowStart}–{state.settings.windowEnd} ·
        mínimo {state.settings.minMinutes} min
      </p>
      {state.settings.assumeFree && (
        <p className="warning">
          Estimación activada: se supone libre todo tiempo sin turno. Puede
          faltar información.
        </p>
      )}
      {dates.map((d) => {
        const result = commonFree(state, d);
        return (
          <div key={d} className="free-day">
            <h3>{prettyDate(d)}</h3>
            {result.unknown.length ? (
              <p className="empty-note">
                Falta confirmar el día de {result.unknown.join(" y ")}. Sin
                datos no equivale a libre.
              </p>
            ) : result.intervals.length ? (
              <div className="free-slots">
                {result.intervals.map(([a, b]) => (
                  <div className="free-slot" key={a}>
                    <span>
                      {a} <span className="muted">—</span> {b}
                    </span>
                    <small>
                      {result.assumed
                        ? "Posible coincidencia"
                        : "Libre para ambos"}
                    </small>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-note">
                No hay coincidencias de esta duración en la franja.
              </p>
            )}
            {long && (
              <button className="text-btn" onClick={() => onSelect(d)}>
                Revisar este día
              </button>
            )}
          </div>
        );
      })}
      <p className="hint">
        Solo se resta el trabajo registrado. Descanso, desplazamientos u otros
        compromisos deben tenerse en cuenta al hacer planes.
      </p>
    </section>
  );
}
