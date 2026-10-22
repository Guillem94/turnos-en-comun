import test from "node:test";
import assert from "node:assert/strict";
import { interpretCells, interpretWords } from "../src/import-layout.js";
import { defaultLegend } from "../src/domain.js";
const ctx = { month: "2026-11", legend: defaultLegend },
  bbox = { x0: 0, y0: 0, x1: 100, y1: 70 };
test("glifo de día ambiguo conserva fecha nula; no completa por secuencia", () => {
  const r = interpretCells(
    [
      { row: 0, col: 0, text: "10 M", confidence: 99, bbox },
      { row: 0, col: 1, text: '1" N', confidence: 70, bbox },
      { row: 0, col: 2, text: "12 T", confidence: 99, bbox },
    ],
    ctx,
  );
  assert.equal(r.rows.length, 3);
  assert.equal(r.rows[1].date, null);
  assert.equal(r.rows[1].approved, false);
  assert.deepEqual(r.rows[1].evidence.bbox, bbox);
});
test("nombres repetidos en tabla se distinguen por fila para confirmar origen", () => {
  const r = interpretCells(
    [
      { row: 0, col: 0, text: "Employee" },
      { row: 0, col: 1, text: "12/11/2026" },
      { row: 0, col: 2, text: "13/11/2026" },
      { row: 1, col: 0, text: "Ana" },
      { row: 2, col: 0, text: "Ana" },
      { row: 1, col: 1, text: "M" },
      { row: 2, col: 1, text: "N" },
    ].map((c) => ({ ...c, bbox, confidence: 99 })),
    ctx,
  );
  assert.equal(r.format, "people-table");
  assert.deepEqual(r.people, ["Ana (fila 2)", "Ana (fila 3)"]);
  assert.notEqual(r.rows[0].sourcePerson, r.rows[1].sourcePerson);
});
test("lista con persona explícita y código sin día conserva hechos parciales", () => {
  const words = [
    {
      text: "Persona: Ana",
      confidence: 95,
      bbox: { x0: 0, y0: 0, x1: 250, y1: 30 },
    },
    {
      text: "12/11/2026 08:00-16:00",
      confidence: 95,
      bbox: { x0: 0, y0: 70, x1: 500, y1: 100 },
    },
    { text: "N", confidence: 95, bbox: { x0: 0, y0: 140, x1: 30, y1: 170 } },
  ];
  const r = interpretWords(words, ctx, 900, 600);
  assert.deepEqual(r.people, ["Ana"]);
  assert.equal(r.rows[0].sourcePerson, "Ana");
  assert.equal(r.rows[1].date, null);
  assert.equal(r.rows[1].start, "22:00");
  assert.equal(r.rows[1].approved, false);
});
