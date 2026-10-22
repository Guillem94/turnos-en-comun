import test from "node:test";
import assert from "node:assert/strict";
import { parseCell } from "../src/ocr.js";
import { defaultLegend, demoState, conflicts, active } from "../src/domain.js";
test("OCR desconocido/ambiguo permanece pendiente; no inferir día por posición", () => {
  for (const text of ["12 X", "N", "32 M", "1 M T"]) {
    const row = parseCell(text, 95, "2026-11");
    assert.equal(row.approved, false);
    assert.ok(row.warning);
  }
  assert.equal(parseCell("LUN", 90, "2026-11"), null);
  assert.equal(parseCell("", 90, "2026-11"), null);
});
test("leyenda personalizada y horarios explícitos locales", () => {
  const legend = {
    ...defaultLegend,
    M: { kind: "shift", start: "06:15", end: "14:45" },
  };
  assert.equal(parseCell("12 M", 95, "2026-11", legend).start, "06:15");
  const row = parseCell("13 22:00-06:00", 95, "2026-11");
  assert.equal(row.date, "2026-11-13");
  assert.equal(row.end, "06:00");
  assert.equal(row.approved, false);
  assert.match(parseCell("12 M", 50, "2026-11").warning, /dudosa/);
});
test("demo ficticia no contiene libres en conflicto con noches previas", () => {
  const s = demoState("2026-11");
  assert.equal(active(s).filter((e) => conflicts(s, e).length > 0).length, 0);
});
