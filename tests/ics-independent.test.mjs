import test from "node:test";
import assert from "node:assert/strict";
import ICAL from "ical.js";
import { emptyState } from "../src/domain.js";
import { exportICS } from "../src/ics.js";
const entry = (
  id,
  profileId,
  date,
  start,
  end,
  kind = "shift",
  label = "Turno ficticio",
) => ({
  id,
  profileId,
  date,
  start,
  end,
  kind,
  label,
  updatedAt: "2026-10-21T12:00:00Z",
});
const parse = (text) =>
  new ICAL.Component(ICAL.parse(text))
    .getAllSubcomponents("vevent")
    .map((c) => new ICAL.Event(c));
test("parser independiente ICAL.js: UTC, noche, año nuevo, duración y UID", () => {
  const s = emptyState();
  s.entries = [
    entry("night", "p1", "2026-12-31", "22:00", "06:00"),
    entry("day", "p2", "2027-01-01", "08:00", "16:00"),
  ];
  const events = parse(exportICS(s));
  assert.equal(events.length, 2);
  const night = events.find((e) => e.uid === "night@turnos-en-comun.local");
  assert.equal(night.startDate.toString(), "2026-12-31T21:00:00Z");
  assert.equal(night.endDate.toString(), "2027-01-01T05:00:00Z");
  assert.equal(night.startDate.zone.tzid, "UTC");
  assert.equal(night.duration.toSeconds(), 28800);
  assert.equal(night.startDate.isDate, false);
  assert.equal(parse(exportICS(s, "p1")).length, 1);
  assert.equal(parse(exportICS(s, "p2"))[0].uid, "day@turnos-en-comun.local");
  assert.equal(parse(exportICS(s))[0].uid, night.uid);
});
test("parser independiente ICAL.js: libre DATE y final exclusivo", () => {
  const s = emptyState();
  s.entries = [entry("off", "p1", "2027-01-01", "", "", "off", "Libre")];
  const [e] = parse(exportICS(s));
  assert.equal(e.startDate.isDate, true);
  assert.equal(e.endDate.isDate, true);
  assert.equal(e.startDate.toString(), "2027-01-01");
  assert.equal(e.endDate.toString(), "2027-01-02");
  assert.equal(e.duration.toSeconds(), 86400);
  assert.equal(e.component.getFirstPropertyValue("transp"), "TRANSPARENT");
});
test("parser independiente ICAL.js: Unicode, escapado y plegado conservan SUMMARY", () => {
  const s = emptyState();
  s.profiles[0].name = "Ángela";
  const label = "Café, revisión; mañana\n" + "búho 🦉 ".repeat(7);
  s.entries = [
    entry("unicode", "p1", "2026-11-13", "08:00", "16:00", "shift", label),
  ];
  const text = exportICS(s),
    [e] = parse(text);
  assert.equal(e.summary, `Ángela · ${label}`);
  assert.equal(
    e.description,
    `Horas registradas en Europe/Madrid. Exportación manual; no sincroniza.`,
  );
  assert.equal(
    parse(new ICAL.Component(ICAL.parse(text)).toString())[0].summary,
    e.summary,
  );
});
test("parser independiente ICAL.js: verano, zona distinta y cruces de fecha UTC", () => {
  const s = emptyState();
  s.entries = [entry("summer", "p1", "2026-07-01", "00:30", "08:30")];
  let [e] = parse(exportICS(s));
  assert.equal(e.startDate.toString(), "2026-06-30T22:30:00Z");
  assert.equal(e.duration.toSeconds(), 28800);
  s.settings.timezone = "America/New_York";
  s.entries = [entry("ny", "p2", "2026-11-13", "08:00", "16:00")];
  [e] = parse(exportICS(s));
  assert.equal(e.startDate.toString(), "2026-11-13T13:00:00Z");
  assert.equal(e.endDate.toString(), "2026-11-13T21:00:00Z");
});
