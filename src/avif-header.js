import { checkDimensions } from "./image-header.js";
// Deliberately narrow: one static AVIF item. Resolve its primary item's ispe
// association, never search arbitrary compressed bytes for dimension strings.
export function avifDimensions(buffer) {
  const a = new Uint8Array(buffer),
    v = new DataView(buffer);
  let seen = 0;
  const text = (p, n) => String.fromCharCode(...a.subarray(p, p + n));
  function boxes(start, end) {
    const out = [];
    for (let p = start; p < end;) {
      if (p + 8 > end || ++seen > 1024)
        throw new Error("Estructura AVIF inválida o demasiado compleja.");
      let size = v.getUint32(p),
        header = 8;
      if (size === 1) {
        if (p + 16 > end) throw new Error("AVIF truncado.");
        const n = v.getBigUint64(p + 8);
        if (n > BigInt(end - p)) throw new Error("AVIF truncado.");
        size = Number(n);
        header = 16;
      } else if (size === 0) size = end - p;
      if (size < header || p + size > end) throw new Error("AVIF truncado.");
      out.push({ type: text(p + 4, 4), start: p + header, end: p + size });
      p += size;
    }
    return out;
  }
  const need = (box, n) => {
    if (!box || box.start + n > box.end)
      throw new Error("Faltan metadatos AVIF verificables.");
    return box.start;
  };
  const one = (list, type) => {
    const found = list.filter((b) => b.type === type);
    if (found.length !== 1)
      throw new Error("Faltan metadatos AVIF únicos: " + type);
    return found[0];
  };
  const roots = boxes(0, a.length);
  if (roots.some((b) => b.type === "moov"))
    throw new Error(
      "AVIF animado no soportado. Exporta un fotograma como PNG.",
    );
  const meta = one(roots, "meta"),
    m = need(meta, 4);
  if (v.getUint32(m) !== 0)
    throw new Error("Versión de metadatos AVIF no soportada.");
  const items = boxes(m + 4, meta.end),
    pitm = one(items, "pitm"),
    p = need(pitm, 6),
    version = a[p];
  if (version > 1) throw new Error("Versión de elemento AVIF no soportada.");
  need(pitm, version ? 8 : 6);
  const primary = version ? v.getUint32(p + 4) : v.getUint16(p + 4);
  const iinf = one(items, "iinf"),
    inf = need(iinf, 6);
  if (a[inf] > 1) throw new Error("Versión de colección AVIF no soportada.");
  need(iinf, a[inf] ? 8 : 6);
  const count = a[inf] ? v.getUint32(inf + 4) : v.getUint16(inf + 4);
  if (count !== 1)
    throw new Error(
      "Colección AVIF con varios elementos no soportada. Exporta una imagen estática a PNG.",
    );
  const iprp = one(items, "iprp"),
    properties = boxes(iprp.start, iprp.end),
    ipco = one(properties, "ipco");
  const prop = boxes(ipco.start, ipco.end),
    ipma = one(properties, "ipma"),
    q = need(ipma, 8);
  if (a[q] > 1 || v.getUint32(q) & 0xfffffe)
    throw new Error("Asociaciones AVIF no soportadas.");
  const wide = !!(a[q + 3] & 1),
    entries = v.getUint32(q + 4);
  let cursor = q + 8,
    dimensions;
  if (entries !== 1) throw new Error("Colección AVIF no soportada.");
  const idBytes = a[q] ? 4 : 2;
  if (cursor + idBytes + 1 > ipma.end) throw new Error("AVIF truncado.");
  const id = a[q] ? v.getUint32(cursor) : v.getUint16(cursor);
  cursor += idBytes;
  const n = a[cursor++];
  if (id !== primary || cursor + n * (wide ? 2 : 1) > ipma.end)
    throw new Error("Asociación primaria AVIF inválida.");
  for (let i = 0; i < n; i++) {
    const index = wide ? v.getUint16(cursor) & 32767 : a[cursor] & 127;
    cursor += wide ? 2 : 1;
    if (index === 0) continue;
    const b = prop[index - 1];
    if (!b) throw new Error("Referencia AVIF huérfana.");
    if (b.type === "ispe") {
      const r = need(b, 12);
      if (v.getUint32(r) !== 0 || b.end - r !== 12 || dimensions)
        throw new Error("Dimensiones AVIF ambiguas.");
      const width = v.getUint32(r + 4),
        height = v.getUint32(r + 8);
      checkDimensions(width, height);
      dimensions = { width, height };
    }
  }
  if (!dimensions)
    throw new Error("AVIF sin dimensiones primarias verificables.");
  return dimensions;
}
