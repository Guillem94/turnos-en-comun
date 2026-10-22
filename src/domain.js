export const id = () => crypto.randomUUID();
export const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const dateOK = (s) =>
  typeof s === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  s >= "1900-01-01" &&
  s <= "2100-12-31" &&
  Number.isFinite(Date.parse(`${s}T00:00:00Z`)) &&
  new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
export const timeOK = (s) =>
  typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export const minute = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
export const civil = (d) => Date.parse(`${d}T00:00:00Z`) / 60000;
export const addDays = (d, n) =>
  new Date((civil(d) + n * 1440) * 60000).toISOString().slice(0, 10);
export const timeLabel = (m) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const prettyDate = (d) =>
  new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${d}T12:00:00Z`));
export const defaultLegend = {
  M: { kind: "shift", start: "08:00", end: "16:00" },
  T: { kind: "shift", start: "14:00", end: "22:00" },
  N: { kind: "shift", start: "22:00", end: "06:00" },
  L: { kind: "off", start: "", end: "" },
};
export function emptyState() {
  return {
    schemaVersion: 1,
    profiles: [
      { id: "p1", name: "Persona 1", color: "#256a9a" },
      { id: "p2", name: "Persona 2", color: "#a24c70" },
    ],
    entries: [],
    coverage: [],
    settings: {
      timezone: "Europe/Madrid",
      windowStart: "07:00",
      windowEnd: "23:00",
      minMinutes: 30,
      assumeFree: false,
    },
    onboarded: false,
  };
}
export function entryRange(e) {
  const start = civil(e.date) + minute(e.start);
  let end = civil(e.date) + minute(e.end);
  if (end < start) end += 1440;
  return [start, end];
}
export const active = (s) => s.entries.filter((e) => !e.deletedAt);
export function entriesOn(s, d) {
  const a = civil(d),
    b = a + 1440;
  return active(s).filter((e) =>
    e.kind === "off"
      ? e.date === d
      : entryRange(e)[0] < b && entryRange(e)[1] > a,
  );
}
export function confirmed(s, p, d) {
  return (
    s.settings.assumeFree ||
    s.coverage.some((c) => c.profileId === p && c.date === d) ||
    active(s).some((e) => e.profileId === p && e.date === d && e.kind === "off")
  );
}
export function commonFree(s, d) {
  const unknown = s.profiles
    .filter((p) => !confirmed(s, p.id, d))
    .map((p) => p.name);
  if (unknown.length) return { unknown, intervals: [], assumed: false };
  const base = civil(d),
    a = base + minute(s.settings.windowStart),
    b = base + minute(s.settings.windowEnd);
  const busy = active(s)
    .filter((e) => e.kind === "shift")
    .map(entryRange)
    .filter(([x, y]) => x < b && y > a)
    .map(([x, y]) => [Math.max(a, x), Math.min(b, y)])
    .sort((x, y) => x[0] - y[0]);
  let cursor = a;
  const intervals = [];
  for (const [x, y] of busy) {
    if (x > cursor && x - cursor >= s.settings.minMinutes)
      intervals.push([timeLabel(cursor - base), timeLabel(x - base)]);
    cursor = Math.max(cursor, y);
  }
  if (b - cursor >= s.settings.minMinutes)
    intervals.push([timeLabel(cursor - base), timeLabel(b - base)]);
  return { unknown: [], intervals, assumed: s.settings.assumeFree };
}
export function checkEntry(e) {
  if (!e || !dateOK(e.date) || !["shift", "off"].includes(e.kind))
    return "Fecha o tipo no válido.";
  if (
    e.kind === "shift" &&
    (!timeOK(e.start) || !timeOK(e.end) || e.start === e.end)
  )
    return "Indica horas válidas y distintas. Si la salida es anterior, termina al día siguiente.";
  if (typeof e.label !== "string" || e.label.length > 100)
    return "El nombre del turno debe tener hasta 100 caracteres.";
  return "";
}
export function conflicts(s, e, extra = []) {
  return [...active(s), ...extra]
    .filter((x) => x.id !== e.id && x.profileId === e.profileId)
    .map((x) => {
      if (
        x.date === e.date &&
        x.kind === e.kind &&
        (e.kind === "off" || (x.start === e.start && x.end === e.end))
      )
        return "duplicado";
      if (x.kind === "off" || e.kind === "off") {
        const off = x.kind === "off" ? x : e,
          shift = x.kind === "shift" ? x : e;
        if (shift.kind === "off") return "";
        const [a, b] = entryRange(shift);
        return a < civil(off.date) + 1440 && b > civil(off.date)
          ? "conflicto con día libre"
          : "";
      }
      const [a, b] = entryRange(x),
        [c, d] = entryRange(e);
      return a < d && c < b ? "solape" : "";
    })
    .filter(Boolean);
}
export function validateBackup(raw) {
  const fail = (msg) => {
    throw new Error(`Copia no válida: ${msg}`);
  };
  if (
    !raw ||
    raw.schemaVersion !== 1 ||
    !Array.isArray(raw.profiles) ||
    raw.profiles.length !== 2
  )
    fail("versión o perfiles");
  const str = (v, n) => typeof v === "string" && v.length > 0 && v.length <= n;
  const validId = (v) => str(v, 80) && /^[a-zA-Z0-9_-]+$/.test(v);
  const profiles = raw.profiles.map((p) => {
    if (
      !p ||
      !validId(p.id) ||
      !str(p.name, 40) ||
      !/^#[0-9a-f]{6}$/i.test(p.color)
    )
      fail("perfil");
    return { id: p.id, name: p.name, color: p.color };
  });
  if (new Set(profiles.map((p) => p.id)).size !== 2)
    fail("identificadores de perfil repetidos");
  const refs = new Set(profiles.map((p) => p.id)),
    settings = raw.settings;
  if (
    !settings ||
    !timeOK(settings.windowStart) ||
    !timeOK(settings.windowEnd) ||
    settings.windowStart >= settings.windowEnd ||
    !Number.isInteger(settings.minMinutes) ||
    settings.minMinutes < 1 ||
    settings.minMinutes > 1440 ||
    typeof settings.assumeFree !== "boolean"
  )
    fail("franja");
  try {
    new Intl.DateTimeFormat("es", { timeZone: settings.timezone }).format();
  } catch {
    fail("zona horaria");
  }
  if (!str(settings.timezone, 80)) fail("zona horaria");
  if (
    !Array.isArray(raw.entries) ||
    raw.entries.length > 10000 ||
    !Array.isArray(raw.coverage) ||
    raw.coverage.length > 20000
  )
    fail("demasiados registros");
  const entries = raw.entries.map((e) => {
    if (
      !e ||
      !validId(e.id) ||
      !refs.has(e.profileId) ||
      checkEntry(e) ||
      !str(e.updatedAt, 30) ||
      !Number.isFinite(Date.parse(e.updatedAt)) ||
      (e.deletedAt && !Number.isFinite(Date.parse(e.deletedAt)))
    )
      fail("turno o referencia huérfana");
    return {
      id: e.id,
      profileId: e.profileId,
      date: e.date,
      kind: e.kind,
      start: e.kind === "off" ? "" : e.start,
      end: e.kind === "off" ? "" : e.end,
      label: e.label,
      updatedAt: e.updatedAt,
      ...(e.deletedAt ? { deletedAt: e.deletedAt } : {}),
    };
  });
  if (new Set(entries.map((e) => e.id)).size !== entries.length)
    fail("turnos repetidos");
  const coverage = raw.coverage.map((c) => {
    if (!c || !refs.has(c.profileId) || !dateOK(c.date))
      fail("confirmación huérfana");
    return { profileId: c.profileId, date: c.date };
  });
  if (
    new Set(coverage.map((c) => c.profileId + c.date)).size !== coverage.length
  )
    fail("confirmaciones repetidas");
  if (typeof raw.onboarded !== "boolean") fail("onboarding");
  return {
    schemaVersion: 1,
    profiles,
    entries,
    coverage,
    settings: {
      timezone: settings.timezone,
      windowStart: settings.windowStart,
      windowEnd: settings.windowEnd,
      minMinutes: settings.minMinutes,
      assumeFree: settings.assumeFree,
    },
    onboarded: raw.onboarded,
  };
}
export function demoState(month = localToday().slice(0, 7)) {
  const s = emptyState();
  s.onboarded = true;
  s.profiles[0].name = "Ana";
  s.profiles[1].name = "Luis";
  const count = new Date(`${month}-01T12:00:00Z`);
  count.setUTCMonth(count.getUTCMonth() + 1);
  count.setUTCDate(0);
  for (let day = 1; day <= count.getUTCDate(); day++)
    for (let p = 0; p < 2; p++) {
      const d = `${month}-${String(day).padStart(2, "0")}`;
      const code = ["M", "T", "L", "N", "L", "M", "L"][(day + p * 2) % 7];
      const l = defaultLegend[code],
        profileId = s.profiles[p].id,
        nightBefore = s.entries.some(
          (e) =>
            e.profileId === profileId &&
            e.kind === "shift" &&
            e.end < e.start &&
            addDays(e.date, 1) === d,
        );
      if (!(l.kind === "off" && nightBefore))
        s.entries.push({
          id: `demo-${p}-${d}`,
          profileId,
          date: d,
          ...l,
          label: code === "L" ? "Libre" : `Turno ${code}`,
          updatedAt: "2026-10-21T12:00:00Z",
        });
      s.coverage.push({ profileId, date: d });
    }
  return s;
}
