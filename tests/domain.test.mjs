import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyState,
  commonFree,
  entryRange,
  addDays,
  validateBackup,
  demoState,
  conflicts,
  confirmed,
} from "../src/domain.js";
import { exportICS, wallToInstant, fold } from "../src/ics.js";
const e = (profileId, date, start, end, id = "e") => ({
  id,
  profileId,
  date,
  start,
  end,
  kind: "shift",
  label: "Turno",
  updatedAt: "2026-10-21T12:00:00Z",
});
test("ventana acotada, todos los turnos y extremos semiabiertos", () => {
  const s = emptyState();
  s.settings.assumeFree = true;
  s.settings.minMinutes = 1;
  s.entries = [
    e("p1", "2026-11-13", "08:00", "16:00", "a"),
    e("p2", "2026-11-13", "14:00", "22:00", "b"),
  ];
  assert.deepEqual(commonFree(s, "2026-11-13").intervals, [
    ["07:00", "08:00"],
    ["22:00", "23:00"],
  ]);
});
test("nocturno previo, solapes y cambio de día", () => {
  const s = emptyState();
  s.settings = {
    ...s.settings,
    assumeFree: true,
    windowStart: "00:00",
    windowEnd: "12:00",
  };
  s.entries = [
    e("p1", "2026-11-12", "22:00", "06:00", "a"),
    e("p2", "2026-11-13", "05:00", "09:00", "b"),
  ];
  assert.deepEqual(commonFree(s, "2026-11-13").intervals, [["09:00", "12:00"]]);
  assert.equal(entryRange(s.entries[0])[1] - entryRange(s.entries[0])[0], 480);
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});
test("sin datos no es libre; confirmación independiente y días libres", () => {
  const s = emptyState();
  assert.equal(commonFree(s, "2026-11-13").unknown.length, 2);
  s.coverage = [{ profileId: "p1", date: "2026-11-13" }];
  assert.equal(confirmed(s, "p1", "2026-11-13"), true);
  s.entries = [{ ...e("p2", "2026-11-13", "", ""), kind: "off" }];
  assert.deepEqual(commonFree(s, "2026-11-13").intervals, [["07:00", "23:00"]]);
});
test("varios turnos, adyacentes, eliminados y mínimo", () => {
  const s = emptyState();
  s.settings.assumeFree = true;
  s.entries = [
    e("p1", "2026-11-13", "07:00", "09:00", "a"),
    e("p1", "2026-11-13", "10:00", "12:00", "b"),
    e("p2", "2026-11-13", "12:00", "14:00", "c"),
    {
      ...e("p2", "2026-11-13", "14:00", "23:00", "d"),
      deletedAt: "2026-10-21T12:00:00Z",
    },
  ];
  assert.deepEqual(commonFree(s, "2026-11-13").intervals, [
    ["09:00", "10:00"],
    ["14:00", "23:00"],
  ]);
});
test("copia equivalente, corrupta, versión, huérfanos y fechas imposibles", () => {
  const s = demoState("2026-11");
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(s))), s);
  for (const mutate of [
    (x) => (x.schemaVersion = 2),
    (x) => (x.entries[0].profileId = "orphan"),
    (x) => (x.entries[0].date = "2026-02-30"),
    (x) => (x.settings.windowEnd = "06:00"),
    (x) => (x.coverage[0].profileId = "unknown"),
  ]) {
    const raw = structuredClone(s);
    mutate(raw);
    assert.throws(() => validateBackup(raw));
  }
  assert.throws(() => JSON.parse("{"));
});
test("duplicados, solapes nocturnos y libre en conflicto", () => {
  const s = emptyState();
  const a = e("p1", "2026-11-12", "22:00", "06:00", "a");
  s.entries = [a];
  assert.deepEqual(conflicts(s, { ...a, id: "b" }), ["duplicado"]);
  assert.deepEqual(conflicts(s, e("p1", "2026-11-13", "05:00", "09:00", "b")), [
    "solape",
  ]);
  assert.deepEqual(
    conflicts(s, { ...a, id: "b", date: "2026-11-13", kind: "off" }),
    ["conflicto con día libre"],
  );
});
test("ICS estable, UTC correcto, nocturnos y días enteros", () => {
  const s = emptyState();
  s.entries = [
    e("p1", "2026-12-31", "22:00", "06:00", "stable"),
    { ...e("p2", "2027-01-01", "", "", "off"), kind: "off" },
  ];
  const ics = exportICS(s);
  assert.match(ics, /UID:stable@/);
  assert.match(ics, /DTSTART:20261231T210000Z/);
  assert.match(ics, /DTEND:20270101T050000Z/);
  assert.match(ics, /DTEND;VALUE=DATE:20270102/);
  assert.equal(ics, exportICS(s));
  assert.ok(!exportICS(s, "p1").includes("UID:off@"));
});
test("DST inexistente y ambigua se rechazan, fechas conservadas en zonas", () => {
  assert.throws(
    () => wallToInstant("2026-03-29", "02:30", "Europe/Madrid"),
    /inexistente/,
  );
  assert.throws(
    () => wallToInstant("2026-10-25", "02:30", "Europe/Madrid"),
    /ambigua/,
  );
  assert.equal(
    wallToInstant("2026-11-13", "00:00", "Europe/Madrid"),
    "20261112T230000Z",
  );
  assert.equal(
    wallToInstant("2026-11-13", "08:00", "America/New_York"),
    "20261113T130000Z",
  );
});
test("ICS pliega líneas por octetos UTF8 y escapa texto", () => {
  for (const row of fold("SUMMARY:" + "á".repeat(100)).split("\r\n"))
    assert.ok(new TextEncoder().encode(row).length <= 75);
  const s = emptyState();
  s.entries = [
    { ...e("p1", "2026-11-13", "08:00", "16:00"), label: "a,b; c\nEND:VEVENT" },
  ];
  assert.match(exportICS(s), /a\\,b\\; c\\nEND:VEVENT/);
});
