import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyState,
  commonFree,
  conflicts,
  dateOK,
  validateBackup,
} from "../src/domain.js";
import { exportICS, wallToInstant, fold } from "../src/ics.js";

const day = "2026-11-13";
const shift = (id, profileId, date, start, end) => ({
  id,
  profileId,
  date,
  start,
  end,
  kind: "shift",
  label: "Turno ficticio",
  updatedAt: "2026-10-21T12:00:00Z",
});
function state() {
  const s = emptyState();
  s.profiles[0].name = "Ana";
  s.profiles[1].name = "Luis";
  s.coverage = s.profiles.map((p) => ({ profileId: p.id, date: day }));
  return s;
}

test("JARVIS: Ana 08–16 / Luis 14–22 con cobertura explícita", () => {
  const s = state();
  s.entries = [
    shift("a", "p1", day, "08:00", "16:00"),
    shift("b", "p2", day, "14:00", "22:00"),
  ];
  assert.deepEqual(commonFree(s, day), {
    unknown: [],
    intervals: [
      ["07:00", "08:00"],
      ["22:00", "23:00"],
    ],
    assumed: false,
  });
});
test("JARVIS: noche 12nov22–13nov06 / Luis 13nov05–09", () => {
  const s = state();
  s.settings.windowStart = "00:00";
  s.settings.windowEnd = "12:00";
  s.entries = [
    shift("a", "p1", "2026-11-12", "22:00", "06:00"),
    shift("b", "p2", day, "05:00", "09:00"),
  ];
  assert.deepEqual(commonFree(s, day).intervals, [["09:00", "12:00"]]);
  s.coverage.pop();
  assert.deepEqual(commonFree(s, day).unknown, ["Luis"]);
  assert.deepEqual(commonFree(s, day).intervals, []);
});
test("JARVIS: mínimo inclusivo, hueco corto y turnos fuera de ventana", () => {
  const s = state();
  s.settings.windowStart = "07:00";
  s.settings.windowEnd = "10:00";
  s.entries = [
    shift("a", "p1", day, "07:30", "08:00"),
    shift("b", "p2", day, "08:29", "09:30"),
    shift("c", "p1", day, "10:00", "11:00"),
  ];
  assert.deepEqual(commonFree(s, day).intervals, [
    ["07:00", "07:30"],
    ["09:30", "10:00"],
  ]);
});
test("JARVIS: adyacencia no solapa y papelera no bloquea", () => {
  const s = state();
  s.entries = [shift("a", "p1", day, "08:00", "16:00")];
  assert.deepEqual(conflicts(s, shift("b", "p1", day, "16:00", "22:00")), []);
  s.entries[0].deletedAt = "2026-10-21T13:00:00Z";
  assert.deepEqual(conflicts(s, shift("b", "p1", day, "08:00", "16:00")), []);
  assert.deepEqual(commonFree(s, day).intervals, [["07:00", "23:00"]]);
});
test("JARVIS: JSON roundtrip, lista blanca y no mutación", () => {
  const s = state();
  s.entries = [shift("a", "p1", day, "22:00", "06:00")];
  const raw = JSON.parse(JSON.stringify(s));
  raw.image = "dato sintético descartable";
  const before = JSON.stringify(raw);
  assert.deepEqual(validateBackup(raw), s);
  assert.equal(JSON.stringify(raw), before);
});
test("JARVIS: JSON rechaza ids repetidos, cobertura repetida y tipos inválidos", () => {
  for (const mutate of [
    (s) => (s.profiles[1].id = "p1"),
    (s) => s.coverage.push({ ...s.coverage[0] }),
    (s) => s.entries.push({ ...s.entries[0] }),
    (s) => (s.settings.assumeFree = "false"),
    (s) => (s.settings.minMinutes = 0),
    (s) => (s.entries[0].start = "24:00"),
    (s) => (s.entries[0].end = s.entries[0].start),
    (s) => (s.settings.timezone = "Invalid/Zone"),
  ]) {
    const s = state();
    s.entries = [shift("a", "p1", day, "08:00", "16:00")];
    mutate(s);
    assert.throws(() => validateBackup(s));
  }
});
test("JARVIS: ICS noche, filtro, papelera, CRLF y Unicode", () => {
  const s = state();
  s.entries = [
    shift("a", "p1", "2026-11-12", "22:00", "06:00"),
    {
      ...shift("b", "p2", day, "05:00", "09:00"),
      deletedAt: "2026-10-21T13:00:00Z",
    },
  ];
  const ics = exportICS(s);
  assert.match(ics, /DTSTART:20261112T210000Z\r\n/);
  assert.match(ics, /DTEND:20261113T050000Z\r\n/);
  assert.ok(!ics.includes("UID:b@"));
  assert.ok(!exportICS(s, "p2").includes("BEGIN:VEVENT"));
  assert.ok(!ics.replaceAll("\r\n", "").includes("\n"));
  const line = "SUMMARY:" + "búho 🦉 ".repeat(30);
  const folded = fold(line);
  assert.equal(folded.replaceAll("\r\n ", ""), line);
  for (const row of folded.split("\r\n"))
    assert.ok(Buffer.byteLength(row, "utf8") <= 75);
});
test("JARVIS: ICS DST rechaza ambos casos y admite límites válidos", () => {
  assert.throws(
    () => wallToInstant("2026-03-29", "02:30", "Europe/Madrid"),
    /inexistente/,
  );
  assert.throws(
    () => wallToInstant("2026-10-25", "02:30", "Europe/Madrid"),
    /ambigua/,
  );
  assert.equal(
    wallToInstant("2026-03-29", "03:00", "Europe/Madrid"),
    "20260329T010000Z",
  );
});
test("JARVIS regresión corregida: dateOK devuelve false sin lanzar", () => {
  assert.equal(dateOK("2026-13-01"), false);
});
test("JARVIS regresión corregida: ICS no conserva CR aislado en texto", () => {
  const s = state();
  s.entries = [
    { ...shift("a", "p1", day, "08:00", "16:00"), label: "uno\rdos" },
  ];
  assert.ok(!exportICS(s).replaceAll("\r\n", "").includes("\r"));
});
