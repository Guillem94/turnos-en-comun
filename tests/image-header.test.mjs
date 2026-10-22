import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { imageHeader, checkDimensions } from "../src/image-header.js";
const data = (name) => {
  const b = readFileSync(new URL("./images/" + name, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};
test("firmas reales de BMP, GIF y TIFF sin depender de extensión ni MIME", () => {
  for (const [file, format] of [
    ["calendar.bmp", "bmp"],
    ["calendar.gif", "gif"],
    ["calendar.tiff", "tiff"],
    ["monthly.png", "png"],
  ])
    assert.equal(imageHeader(data(file)).format, format);
});
test("rechaza dimensiones peligrosas, SVG, PDF y encabezados truncados", () => {
  for (const values of [
    [0, 10],
    [-1, 10],
    [1.5, 2],
    [100000, 100000],
    [NaN, 1],
  ])
    assert.throws(() => checkDimensions(...values));
  for (const s of ['<svg onload="alert(1)"/>', "%PDF-1.7 unsupported", "x"])
    assert.throws(() => imageHeader(new TextEncoder().encode(s).buffer));
  const b = data("monthly.png");
  new DataView(b).setUint32(16, 100000);
  assert.throws(() => imageHeader(b), /16 megapíxeles/);
});
test("secuencia HEIF temporal queda explícitamente no soportada", () => {
  const a = new Uint8Array(24),
    v = new DataView(a.buffer);
  v.setUint32(0, 24);
  a.set(new TextEncoder().encode("ftypmsf1"), 4);
  a.set(new TextEncoder().encode("msf1hevc"), 16);
  assert.throws(() => imageHeader(a.buffer), /Secuencia HEIF temporal/);
});
test("AVIF vincula dimensiones a propiedad primaria; rechaza datos truncados, huérfanos y colecciones", () => {
  const good = data("calendar.avif");
  assert.equal(imageHeader(good).format, "avif");
  const bytes = new Uint8Array(good),
    text = new TextDecoder("latin1").decode(bytes);
  const ispe = text.indexOf("ispe"),
    ipma = text.indexOf("ipma"),
    iinf = text.indexOf("iinf");
  assert.ok(ispe > 0 && ipma > 0 && iinf > 0);
  const huge = good.slice(0);
  new DataView(huge).setUint32(ispe + 8, 100000);
  assert.throws(() => imageHeader(huge), /16 megapíxeles/);
  const orphan = good.slice(0);
  new Uint8Array(orphan)[ipma + 15] = 127;
  assert.throws(() => imageHeader(orphan), /huérfana/);
  const multiple = good.slice(0);
  new DataView(multiple).setUint16(iinf + 8, 2);
  assert.throws(() => imageHeader(multiple), /varios elementos/);
  assert.throws(
    () => imageHeader(good.slice(0, good.byteLength - 20)),
    /truncado/,
  );
  const forged = good.slice(0);
  new Uint8Array(forged).set(new TextEncoder().encode("xxxx"), ispe);
  assert.throws(() => imageHeader(forged), /dimensiones primarias/);
});
