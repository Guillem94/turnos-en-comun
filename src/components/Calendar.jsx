import React from "react";
import {
  addDays,
  entriesOn,
  commonFree,
  prettyDate,
  localToday,
} from "../domain.js";
export function visibleDays(date, view) {
  const start = date.slice(0, 7) + "-01",
    weekday =
      (new Date(`${view === "week" ? date : start}T12:00:00Z`).getUTCDay() +
        6) %
      7;
  const first = addDays(view === "week" ? date : start, -weekday);
  return Array.from({ length: view === "week" ? 7 : 42 }, (_, i) =>
    addDays(first, i),
  );
}
export default function Calendar({
  state,
  date,
  view,
  setDate,
  setView,
  onSelect,
  onEdit,
}) {
  const days = visibleDays(date, view);
  const heading = new Intl.DateTimeFormat("es", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
  function nav(n) {
    if (view === "week") setDate(addDays(date, n * 7));
    else {
      const d = new Date(`${date.slice(0, 7)}-01T12:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() + n);
      setDate(d.toISOString().slice(0, 10));
    }
  }
  return (
    <section className="calendar-panel" aria-label="Calendario conjunto">
      <div className="calendar-toolbar">
        <div className="date-nav">
          <button
            className="icon-btn"
            aria-label="Periodo anterior"
            onClick={() => nav(-1)}
          >
            ‹
          </button>
          <h2>{heading}</h2>
          <button
            className="icon-btn"
            aria-label="Periodo siguiente"
            onClick={() => nav(1)}
          >
            ›
          </button>
        </div>
        <div className="toolbar-controls">
          <button onClick={() => setDate(localToday())}>Hoy</button>
          <label className="sr-only" htmlFor="goto">
            Ir a fecha
          </label>
          <input
            id="goto"
            aria-label="Ir a fecha"
            type="date"
            min="1900-01-01"
            max="2100-12-31"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
          <div className="segmented">
            <button
              aria-pressed={view === "month"}
              onClick={() => setView("month")}
            >
              Mes
            </button>
            <button
              aria-pressed={view === "week"}
              onClick={() => setView("week")}
            >
              Semana
            </button>
          </div>
        </div>
      </div>
      <div className={`weekdays ${view}`} aria-hidden="true">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="calendar-legend">
        {state.profiles.map((p) => (
          <span key={p.id}>
            <i style={{ background: p.color }} />
            {p.name}
          </span>
        ))}
        <span>Selecciona un día para ver los horarios</span>
      </div>
      <div className={`calendar-grid ${view}`}>
        {days.map((d) => {
          const items = entriesOn(state, d),
            free = commonFree(state, d),
            muted = view === "month" && d.slice(0, 7) !== date.slice(0, 7),
            weekday = new Intl.DateTimeFormat("es", {
              weekday: "short",
              timeZone: "UTC",
            }).format(new Date(`${d}T12:00:00Z`));
          return (
            <article
              className={`day ${muted ? "outside" : ""} ${d === date ? "selected" : ""}`}
              key={d}
              aria-label={prettyDate(d)}
            >
              <button
                className="day-number"
                aria-label={`${weekday} ${Number(d.slice(-2))} · seleccionar ${d}`}
                aria-pressed={d === date}
                onClick={() => onSelect(d)}
              >
                <span className="mobile-day">{weekday} </span>
                {Number(d.slice(-2))}
                {d === localToday() && <span className="today-dot" />}
              </button>
              <div className="day-events">
                {items.map((e) => {
                  const p = state.profiles.find((p) => p.id === e.profileId);
                  return (
                    <button
                      className="event"
                      style={{ "--person": p.color }}
                      key={e.id}
                      onClick={() => onEdit(e)}
                      title={`${p.name}: ${e.kind === "off" ? "Libre" : `${e.start}–${e.end}`}`}
                    >
                      <strong>{p.name}</strong>
                      <span>
                        {e.kind === "off"
                          ? "Libre"
                          : `${e.date !== d ? "↳ " : ""}${e.start}–${e.end}${e.end < e.start ? " +1" : ""}`}
                      </span>
                    </button>
                  );
                })}
              </div>
              {!free.unknown.length && free.intervals.length > 0 && (
                <span className="free-mark">
                  {free.assumed ? "Posible" : "En común"}
                </span>
              )}
              {free.unknown.length === 2 && items.length === 0 && (
                <span className="no-data">Sin datos</span>
              )}
            </article>
          );
        })}
      </div>
      <p className="calendar-foot">
        Mismo calendario, dos colores. Selecciona un día para revisar los
        detalles. “+1” indica salida al día siguiente.
      </p>
    </section>
  );
}
