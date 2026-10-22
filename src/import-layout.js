import { dateOK, timeOK, defaultLegend } from "./domain.js";
const norm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
const pad = (n) => String(n).padStart(2, "0");
const months = [
  "ENERO",
  "FEBRERO",
  "MARZO",
  "ABRIL",
  "MAYO",
  "JUNIO",
  "JULIO",
  "AGOSTO",
  "SEPTIEMBRE",
  "OCTUBRE",
  "NOVIEMBRE",
  "DICIEMBRE",
];
export const instructionLike = (s) =>
  /https?:\/\/|powershell|ignore\b|instructions?\b|ejecuta|ignora|\b(?:delete|curl|shell|send data|rm -rf)\b/i.test(
    s,
  );
export function readDatePrefix(text, month) {
  const t = String(text)
    .trim()
    .replace(
      /^(?:LUN(?:ES)?|MAR(?:TES)?|MI[EÉ](?:RCOLES)?|JUE(?:VES)?|VIE(?:RNES)?|S[AÁ]B(?:ADO)?|DOM(?:INGO)?)[,.]?\s+/i,
      "",
    );
  let m,
    date = null,
    context = false;
  if ((m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?=\s|$)/)))
    date = `${m[1]}-${m[2]}-${m[3]}`;
  else if ((m = t.match(/^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{4}))?(?=\s|$)/))) {
    const year = m[3] || month?.slice(0, 4);
    date = year ? `${year}-${pad(m[2])}-${pad(m[1])}` : null;
    context = !m[3];
  } else if (
    (m = norm(t).match(
      /^(\d{1,2})\s+(?:DE\s+)?([A-Z]+)(?:\s+(?:DE\s+)?(\d{4}))?(?=\s|$)/,
    )) &&
    months.includes(m[2])
  ) {
    const year = m[3] || month?.slice(0, 4);
    date = year
      ? `${year}-${pad(months.indexOf(m[2]) + 1)}-${pad(m[1])}`
      : null;
    context = !m[3];
  } else if ((m = t.match(/^(\d{1,2})(?=\s|[):]|$)/))) {
    date = month ? `${month}-${pad(m[1])}` : null;
    context = true;
  }
  if (!m) return null;
  return {
    date: dateOK(date) ? date : null,
    rest: t
      .slice(m[0].length)
      .replace(/^[\s):]+/, "")
      .trim(),
    context,
    raw: m[0],
  };
}
export function parsePayload(text, legend = defaultLegend) {
  const raw = String(text).trim().replace(/[–—]/g, "-");
  if (!raw) return [];
  const code = norm(raw).replace(/\s+/g, "");
  if (["LIBRE", "DESCANSO", "OFF"].includes(code))
    return [{ kind: "off", start: null, end: null, label: "Libre" }];
  if (Object.hasOwn(legend, code)) {
    const l = legend[code];
    return [
      {
        kind: l.kind,
        start: l.kind === "off" ? null : l.start,
        end: l.kind === "off" ? null : l.end,
        label: code,
      },
    ];
  }
  const ranges = [
    ...raw.matchAll(
      /\b(\d{1,2}[:.]\d{2})\s*(?:-|\ba\b|\bto\b)\s*(\d{1,2}[:.]\d{2})\b/gi,
    ),
  ];
  const residue = raw
    .replace(
      /\b(\d{1,2}[:.]\d{2})\s*(?:-|\ba\b|\bto\b)\s*(\d{1,2}[:.]\d{2})\b/gi,
      "",
    )
    .replace(/(?:turno|horario|shift)|[\s,;|+]/gi, "");
  if (ranges.length && !residue)
    return ranges.map((m) => ({
      kind: "shift",
      start: m[1].replace(".", ":").padStart(5, "0"),
      end: m[2].replace(".", ":").padStart(5, "0"),
      label: "Turno importado",
    }));
  return [
    {
      kind: null,
      start: null,
      end: null,
      label: "Pendiente",
      problem: "Código u horario desconocido: corrige la fila.",
    },
  ];
}
function candidates(
  text,
  confidence,
  ctx,
  evidence,
  headerDate = null,
  sourcePerson = null,
) {
  if (!String(text).trim() || instructionLike(text)) return [];
  if (
    /^(LUN|MAR|MI[ÉE]|JUE|VIE|S[ÁA]B|DOM)(?:ES|TES|RCOLES|VES|RNES|ADO|INGO)?$/i.test(
      text.trim(),
    )
  )
    return [];
  const parsed = headerDate
    ? {
        date: headerDate.date,
        rest: text,
        context: headerDate.context,
        raw: headerDate.raw,
      }
    : readDatePrefix(text, ctx.month);
  if (!parsed) return [];
  return parsePayload(parsed.rest, ctx.legend).map((l) => {
    const warnings = [
      !parsed.date ? "Fecha incompleta o imposible: asigna una fecha." : "",
      /^\d{1,2}[/.]\d{1,2}/.test(parsed.raw)
        ? "Fechas con barras/puntos interpretadas día/mes/año: confirma el orden."
        : "",
      parsed.context
        ? "Fecha completada con el contexto confirmado: compruébala."
        : "",
      l.problem || "",
      confidence < 80 ? "Lectura dudosa: comprueba la región." : "",
    ].filter(Boolean);
    return {
      date: parsed.date,
      kind: l.kind,
      start: l.start,
      end: l.end,
      label: l.label,
      raw: text,
      confidence: Math.round(confidence),
      source: evidence.source,
      sourcePerson: sourcePerson || null,
      warning: warnings.join(" "),
      approved: false,
      evidence: {
        bbox: evidence.bbox,
        text,
        header: headerDate?.raw || null,
        headerBox: headerDate?.bbox || null,
      },
    };
  });
}
export function parseCellV2(text, confidence, month, legend, source = "celda") {
  const list = candidates(
    text,
    confidence,
    { month, legend },
    { source, bbox: null },
  );
  if (list.length) return list[0];
  if (
    !String(text).trim() ||
    /^(LUN|MAR|MI[ÉE]|JUE|VIE|S[ÁA]B|DOM)\b/i.test(text) ||
    instructionLike(text)
  )
    return null;
  return {
    date: null,
    kind: null,
    start: null,
    end: null,
    label: "Pendiente",
    raw: text,
    confidence,
    source,
    sourcePerson: null,
    warning:
      "Día no reconocido: asigna una fecha. Código u horario desconocido: corrige la fila.",
    approved: false,
    evidence: { bbox: null, text, header: null, headerBox: null },
  };
}
const cellDate = (c, month) => {
  if (!/[/.]|\d{4}-/.test(c.text)) return null;
  const d = readDatePrefix(c.text, month);
  return d && !d.rest && d.date ? { ...d, bbox: c.bbox } : null;
};
export function interpretCells(cells, ctx) {
  const rows = [];
  const top = cells.filter((c) => c.row === 0);
  const corner = top.filter((c) => c.col === 0);
  if (
    corner.length === 1 &&
    /^(FECHA|DIA|DATE|DAY)$/.test(norm(corner[0].text))
  ) {
    // Coordinates, never array order, define ownership. Ambiguous columns
    // are excluded; missing/ambiguous row dates remain explicitly unresolved.
    const names = top
      .filter(
        (c) =>
          Number.isInteger(c.col) &&
          c.col > 0 &&
          top.filter((h) => h.col === c.col).length === 1 &&
          /^[\p{L}][\p{L}\p{M} .'-]{0,59}$/u.test(c.text.trim()) &&
          !instructionLike(c.text) &&
          !Object.hasOwn(ctx.legend || defaultLegend, norm(c.text)) &&
          !["LIBRE", "OFF", "DESCANSO", "FECHA", "DIA", "DATE", "DAY"].includes(
            norm(c.text),
          ),
      )
      .sort((a, b) => a.col - b.col);
    const people = names.map((c) => ({
      ...c,
      name:
        names.filter((h) => norm(h.text) === norm(c.text)).length > 1
          ? `${c.text.trim()} (columna ${c.col + 1})`
          : c.text.trim(),
    }));
    for (const c of cells) {
      if (!Number.isInteger(c.row) || c.row <= 0) continue;
      const person = people.find((p) => p.col === c.col);
      if (!person) continue;
      const dates = cells.filter((d) => d.row === c.row && d.col === 0);
      const dateCell = dates.length === 1 ? dates[0] : null;
      const parsed =
        dateCell && !instructionLike(dateCell.text)
          ? readDatePrefix(dateCell.text, ctx.month)
          : null;
      const header = {
        date: parsed && !parsed.rest ? parsed.date : null,
        context: Boolean(
          parsed && !parsed.rest && parsed.date && parsed.context,
        ),
        raw: dateCell?.text || "",
        bbox: dateCell?.bbox || null,
      };
      const ambiguous =
        cells.filter((d) => d.row === c.row && d.col === c.col).length > 1;
      const produced = candidates(
        c.text,
        Math.min(
          c.confidence,
          person.confidence,
          dateCell?.confidence ?? c.confidence,
        ),
        ctx,
        { source: `Fila ${c.row + 1}, columna ${c.col + 1}`, bbox: c.bbox },
        header,
        ambiguous ? null : person.name,
      );
      for (const candidate of produced) {
        candidate.evidence.personHeader = person.text;
        candidate.evidence.personHeaderBox = person.bbox || null;
        if (ambiguous) {
          candidate.date = null;
          candidate.warning +=
            " Celda duplicada: confirma persona y fecha manualmente.";
        }
      }
      rows.push(...produced);
    }
    return {
      rows,
      format: people.length ? "people-columns" : "unknown",
      people: people.map((p) => p.name),
      ignoredInstructions: cells.filter((c) => instructionLike(c.text)).length,
    };
  }
  const headers = top
    .map((c) => ({ ...c, date: cellDate(c, ctx.month) }))
    .filter((c) => c.date);
  let people = [];
  let format = "monthly-grid";
  if (headers.length >= 2) {
    const first = top.find((c) => c.col === 0),
      nameRows = cells.filter(
        (c) =>
          c.col === 0 &&
          c.row > 0 &&
          /^[A-Za-zÁÉÍÓÚáéíóúÑñ][\w ÁÉÍÓÚáéíóúÑñ-]{1,40}$/.test(
            c.text.trim(),
          ) &&
          !instructionLike(c.text) &&
          !Object.hasOwn(ctx.legend, norm(c.text)) &&
          !["LIBRE", "OFF", "DESCANSO"].includes(norm(c.text)),
      ),
      personHeader =
        (headers.every((h) => h.col > 0) && nameRows.length > 0) ||
        /PERSONA|NOMBRE|EMPLOYEE|EMPLEAD|TRABAJADOR/i.test(first?.text || "");
    if (personHeader) {
      format = "people-table";
      people = cells
        .filter(
          (c) =>
            c.col === 0 &&
            c.row > 0 &&
            c.text.trim() &&
            !instructionLike(c.text),
        )
        .map((c) => ({ row: c.row, name: c.text.trim() }));
      people = people.map((p) => ({
        ...p,
        name:
          people.filter((q) => norm(q.name) === norm(p.name)).length > 1
            ? `${p.name} (fila ${p.row + 1})`
            : p.name,
      }));
    } else format = "weekly";
    for (const c of cells.filter((c) => c.row > 0)) {
      const header = headers.find((h) => h.col === c.col);
      if (!header) continue;
      const person = personHeader
        ? people.find((p) => p.row === c.row)?.name
        : null;
      if (personHeader && !person) continue;
      rows.push(
        ...candidates(
          c.text,
          c.confidence,
          ctx,
          { source: `Fila ${c.row + 1}, columna ${c.col + 1}`, bbox: c.bbox },
          header.date,
          person,
        ),
      );
    }
  } else {
    for (const c of cells) {
      const produced = candidates(c.text, c.confidence, ctx, {
        source: `Fila ${c.row + 1}, columna ${c.col + 1}`,
        bbox: c.bbox,
      });
      if (!produced.length && c.text.trim()) {
        const pending = parseCellV2(
          c.text,
          c.confidence,
          ctx.month,
          ctx.legend,
          `Fila ${c.row + 1}, columna ${c.col + 1}`,
        );
        if (pending)
          produced.push({
            ...pending,
            evidence: { ...pending.evidence, bbox: c.bbox },
          });
      }
      rows.push(...produced);
    }
  }
  return {
    rows,
    format: rows.some((r) => r.date && r.kind) ? format : "unknown",
    people: people.map((p) => p.name),
    ignoredInstructions: cells.filter((c) => instructionLike(c.text)).length,
  };
}
export function wordsToLines(words) {
  const bands = [];
  for (const w of [...words].sort(
    (a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0,
  )) {
    const cy = (w.bbox.y0 + w.bbox.y1) / 2;
    let band = bands.find(
      (b) => Math.abs(b.y - cy) < Math.max(10, (w.bbox.y1 - w.bbox.y0) * 0.6),
    );
    if (!band) {
      band = { y: cy, words: [] };
      bands.push(band);
    }
    band.words.push(w);
  }
  return bands
    .sort((a, b) => a.y - b.y)
    .map((b) => {
      const ws = b.words.sort((a, b) => a.bbox.x0 - b.bbox.x0);
      return {
        text: ws.map((w) => w.text).join(" "),
        confidence: Math.min(...ws.map((w) => w.confidence)),
        bbox: {
          x0: Math.min(...ws.map((w) => w.bbox.x0)),
          y0: Math.min(...ws.map((w) => w.bbox.y0)),
          x1: Math.max(...ws.map((w) => w.bbox.x1)),
          y1: Math.max(...ws.map((w) => w.bbox.y1)),
        },
      };
    });
}
export function borderlessCells(words, width, height) {
  const anchors = words.filter(
    (w) =>
      /^\d{1,2}$/.test(w.text.trim()) &&
      Number(w.text) >= 1 &&
      Number(w.text) <= 31,
  );
  const bands = [];
  for (const a of anchors.sort((a, b) => a.bbox.y0 - b.bbox.y0)) {
    let band = bands.find((b) => Math.abs(b.y - a.bbox.y0) < 20);
    if (!band) {
      band = { y: a.bbox.y0, anchors: [] };
      bands.push(band);
    }
    band.anchors.push(a);
  }
  const usable = bands.filter((b) => b.anchors.length >= 1);
  if (usable.length < 2 || usable.reduce((n, b) => n + b.anchors.length, 0) < 6)
    return null;
  const reference = [...usable]
    .sort((a, b) => b.anchors.length - a.anchors.length)[0]
    .anchors.sort((a, b) => a.bbox.x0 - b.bbox.x0);
  if (reference.length < 3) return null;
  const gaps = reference
      .slice(1)
      .map((a, i) => a.bbox.x0 - reference[i].bbox.x0),
    gap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  if (gaps.some((g) => Math.abs(g - gap) > gap * 0.35)) return null;
  const cells = [];
  usable.forEach((band, row) => {
    if (
      band.anchors.some(
        (a) =>
          !reference.some(
            (r) => Math.abs(a.bbox.x0 - r.bbox.x0) < Math.max(22, gap * 0.15),
          ),
      )
    )
      return;
    const as = reference;
    as.forEach((a, col) => {
      const bbox = {
        x0: Math.max(0, a.bbox.x0 - 10),
        y0: band.y - 5,
        x1: Math.min(width, (as[col + 1]?.bbox.x0 ?? a.bbox.x0 + gap) - 10),
        y1: Math.min(
          height,
          (usable[row + 1]?.y ?? band.y + (usable[1].y - usable[0].y)) - 5,
        ),
      };
      const inside = words.filter(
        (w) =>
          (w.bbox.x0 + w.bbox.x1) / 2 >= bbox.x0 &&
          (w.bbox.x0 + w.bbox.x1) / 2 < bbox.x1 &&
          (w.bbox.y0 + w.bbox.y1) / 2 >= bbox.y0 &&
          (w.bbox.y0 + w.bbox.y1) / 2 < bbox.y1,
      );
      const lines = wordsToLines(inside);
      cells.push({
        row,
        col,
        bbox,
        text: lines.map((l) => l.text).join("\n"),
        confidence: inside.length
          ? Math.min(...inside.map((w) => w.confidence))
          : 0,
      });
    });
  });
  return cells.length >= 6 ? cells : null;
}
export function interpretWords(words, ctx, width, height) {
  const geometric = borderlessCells(words, width, height);
  if (geometric && ctx.format !== "list") {
    const r = interpretCells(geometric, ctx);
    if (r.rows.length >= 4) return { ...r, format: "monthly-borderless" };
  }
  const lines = wordsToLines(words),
    rows = [];
  let ignored = 0,
    sourcePerson = null;
  const people = [];
  for (const line of lines) {
    if (instructionLike(line.text)) {
      ignored++;
      continue;
    }
    const personHeader = line.text.match(
      /^(?:PERSONA|NOMBRE)\s*:\s*([\p{L} -]{2,40})$/iu,
    );
    if (personHeader) {
      sourcePerson = personHeader[1].trim();
      if (!people.includes(sourcePerson)) people.push(sourcePerson);
      continue;
    }
    const produced = candidates(line.text, line.confidence, ctx, {
      source: "Línea de texto",
      bbox: line.bbox,
    });
    rows.push(...produced.map((r) => ({ ...r, sourcePerson })));
    if (
      !produced.length &&
      (Object.hasOwn(ctx.legend, norm(line.text)) ||
        ["LIBRE", "DESCANSO", "OFF"].includes(norm(line.text)))
    ) {
      const [payload] = parsePayload(line.text, ctx.legend);
      rows.push({
        ...payload,
        date: null,
        raw: line.text,
        confidence: line.confidence,
        source: "Texto sin fecha",
        sourcePerson,
        warning:
          "Falta la fecha: asígnala manualmente. No se deduce por posición.",
        approved: false,
        evidence: {
          bbox: line.bbox,
          text: line.text,
          header: null,
          headerBox: null,
        },
      });
    }
  }
  return {
    rows,
    format: rows.some((r) => r.date && r.kind) ? "date-list" : "unknown",
    people,
    ignoredInstructions: ignored,
  };
}
export function validateCandidates(rows, format = "") {
  const valid = rows
    .filter((r) => r && r.evidence)
    .slice(0, 200)
    .map((r) => ({
      ...r,
      date: dateOK(r.date) ? r.date : null,
      start: timeOK(r.start) ? r.start : null,
      end: timeOK(r.end) ? r.end : null,
    }));
  if (!format.startsWith("monthly")) return valid;
  const cells = new Map();
  for (const r of valid) {
    if (!r.date || !r.evidence.bbox) continue;
    const key = JSON.stringify([r.sourcePerson, r.date]),
      region = JSON.stringify(r.evidence.bbox);
    if (!cells.has(key)) cells.set(key, new Set());
    cells.get(key).add(region);
  }
  return valid.map((r) =>
    r.date && cells.get(JSON.stringify([r.sourcePerson, r.date]))?.size > 1
      ? {
          ...r,
          date: null,
          approved: false,
          warning: [
            r.warning,
            "Fecha repetida en celdas mensuales distintas: comprueba la región y asigna la fecha manualmente. No se deduce por posición.",
          ]
            .filter(Boolean)
            .join(" "),
        }
      : r,
  );
}
