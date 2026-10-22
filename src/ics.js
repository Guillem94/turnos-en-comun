import { active, addDays } from "./domain.js";
const localParts = (ms, tz) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date(ms))
    .replace(" ", "T");
export function wallToInstant(date, time, timezone) {
  const want = `${date}T${time}`,
    approx = Date.parse(`${want}:00Z`),
    offsets = new Set();
  for (const h of [-36, -24, -12, 0, 12, 24, 36]) {
    const sample = approx + h * 3600000;
    offsets.add(Date.parse(`${localParts(sample, timezone)}:00Z`) - sample);
  }
  const found = [...offsets]
    .map((o) => approx - o)
    .filter((ms) => localParts(ms, timezone) === want);
  if (found.length !== 1)
    throw new Error(
      `La hora ${date} ${time} es ${found.length ? "ambigua" : "inexistente"} en ${timezone} por un cambio horario. Ajusta el turno antes de exportar.`,
    );
  return new Date(found[0])
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(".000", "");
}
const escape = (s) =>
  String(s)
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
export function fold(s) {
  const lines = [];
  let row = "";
  const enc = new TextEncoder();
  for (const ch of s) {
    if (enc.encode(row + ch).length > 75) {
      lines.push(row);
      row = " ";
    }
    row += ch;
  }
  lines.push(row);
  return lines.join("\r\n");
}
export function exportICS(s, profileId = "all") {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Turnos en Comun//MVP//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escape(profileId === "all" ? "Turnos en Común" : s.profiles.find((p) => p.id === profileId)?.name || "Turnos")}`,
    `X-WR-TIMEZONE:${s.settings.timezone}`,
  ];
  for (const e of active(s).filter(
    (e) => profileId === "all" || e.profileId === profileId,
  )) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@turnos-en-comun.local`,
      `DTSTAMP:${new Date(e.updatedAt)
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "")}`,
    );
    if (e.kind === "off")
      lines.push(
        `DTSTART;VALUE=DATE:${e.date.replace(/-/g, "")}`,
        `DTEND;VALUE=DATE:${addDays(e.date, 1).replace(/-/g, "")}`,
        "TRANSP:TRANSPARENT",
      );
    else
      lines.push(
        `DTSTART:${wallToInstant(e.date, e.start, s.settings.timezone)}`,
        `DTEND:${wallToInstant(e.end < e.start ? addDays(e.date, 1) : e.date, e.end, s.settings.timezone)}`,
        "TRANSP:OPAQUE",
      );
    lines.push(
      `SUMMARY:${escape(`${s.profiles.find((p) => p.id === e.profileId).name} · ${e.label || "Turno"}`)}`,
      `DESCRIPTION:${escape(`Horas registradas en ${s.settings.timezone}. Exportación manual; no sincroniza.`)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
