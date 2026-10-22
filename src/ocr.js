import { defaultLegend } from "./domain.js";
import {
  parseCellV2,
  interpretCells,
  interpretWords,
  validateCandidates,
  borderlessCells,
} from "./import-layout.js";
export const parseCell = (
  text,
  confidence,
  month,
  legend = defaultLegend,
  source = "celda",
) => parseCellV2(text, confidence, month, legend, source);
export function canvasFor(
  image,
  angle = 0,
  selection = { left: 0, top: 0, right: 100, bottom: 100 },
) {
  const { left, top, right, bottom } = selection;
  if (
    ![left, top, right, bottom, angle].every(Number.isFinite) ||
    left < 0 ||
    top < 0 ||
    right > 100 ||
    bottom > 100 ||
    right - left < 5 ||
    bottom - top < 5 ||
    Math.abs(angle) > 180
  )
    throw new Error(
      "Recorte o giro no válido. Conserva al menos un 5% de ancho y alto.",
    );
  const sx = (image.width * left) / 100,
    sy = (image.height * top) / 100,
    sw = (image.width * (right - left)) / 100,
    sh = (image.height * (bottom - top)) / 100,
    rad = (angle * Math.PI) / 180,
    c = document.createElement("canvas");
  c.width = Math.ceil(
    Math.abs(sw * Math.cos(rad)) + Math.abs(sh * Math.sin(rad)),
  );
  c.height = Math.ceil(
    Math.abs(sh * Math.cos(rad)) + Math.abs(sw * Math.sin(rad)),
  );
  if (c.width * c.height > 16000000)
    throw new Error(
      "El área tras giro/recorte supera 16 megapíxeles. Reduce o recorta la imagen.",
    );
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(image, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);
  return c;
}
function groups(values) {
  const out = [];
  for (const v of values) {
    const last = out.at(-1);
    if (last && v - last.at(-1) <= 3) last.push(v);
    else out.push([v]);
  }
  return out.map((a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length));
}
export function detectGrid(canvas) {
  const { width: w, height: h } = canvas,
    px = canvas
      .getContext("2d", { willReadFrequently: true })
      .getImageData(0, 0, w, h).data,
    xs = new Uint32Array(w),
    ys = new Uint32Array(h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (px[i] < 170 && px[i + 1] < 170 && px[i + 2] < 170) {
        xs[x]++;
        ys[y]++;
      }
    }
  const x = groups([...xs.keys()].filter((i) => xs[i] > h * 0.45)),
    y = groups([...ys.keys()].filter((i) => ys[i] > w * 0.45));
  if (
    x.length < 3 ||
    x.length > 35 ||
    y.length < 3 ||
    y.length > 35 ||
    (x.length - 1) * (y.length - 1) > 240 ||
    x.slice(1).some((v, i) => v - x[i] < 20) ||
    y.slice(1).some((v, i) => v - y[i] < 18)
  )
    return null;
  return { x, y };
}
export function regionPreview(canvas, bbox) {
  if (!canvas || !bbox) return null;
  const x = Math.max(0, bbox.x0),
    y = Math.max(0, bbox.y0),
    w = Math.min(canvas.width, bbox.x1) - x,
    h = Math.min(canvas.height, bbox.y1) - y;
  if (w <= 0 || h <= 0) return null;
  const c = document.createElement("canvas"),
    scale = Math.min(2, 600 / w);
  c.width = Math.ceil(w * scale);
  c.height = Math.ceil(h * scale);
  c.getContext("2d").drawImage(canvas, x, y, w, h, 0, 0, c.width, c.height);
  return c.toDataURL("image/png");
}
export function candidateRegionPreview(canvas, evidence) {
  if (!canvas || !evidence) return null;
  const regions = [
    ["Turno leído", evidence.bbox],
    ["Fecha de origen", evidence.headerBox],
    ["Persona de origen", evidence.personHeaderBox],
  ];
  const used = new Set(),
    patches = [];
  for (const [label, box] of regions) {
    if (!box || used.has(JSON.stringify(box))) continue;
    const x = Math.max(0, box.x0),
      y = Math.max(0, box.y0),
      w = Math.min(canvas.width, box.x1) - x,
      h = Math.min(canvas.height, box.y1) - y;
    if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) continue;
    used.add(JSON.stringify(box));
    const scale = Math.min(2, 600 / w, 400 / h);
    patches.push({
      label,
      x,
      y,
      w,
      h,
      width: Math.ceil(w * scale),
      height: Math.ceil(h * scale),
    });
  }
  if (!patches.length) return null;
  const preview = document.createElement("canvas");
  preview.width = Math.max(...patches.map((p) => p.width));
  preview.height = patches.reduce((n, p) => n + p.height + 32, 0);
  const ctx = preview.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, preview.width, preview.height);
  let top = 0;
  for (const p of patches) {
    ctx.fillStyle = "#173c33";
    ctx.font = "bold 16px Arial";
    ctx.fillText(p.label, 4, top + 21);
    ctx.drawImage(canvas, p.x, p.y, p.w, p.h, 0, top + 30, p.width, p.height);
    top += p.height + 32;
  }
  return preview.toDataURL("image/png");
}
function crop(canvas, box) {
  const w = box.x1 - box.x0,
    h = box.y1 - box.y0,
    c = document.createElement("canvas"),
    scale = Math.max(1, 300 / w);
  c.width = Math.ceil(w * scale);
  c.height = Math.ceil(h * scale);
  c.getContext("2d").drawImage(
    canvas,
    box.x0,
    box.y0,
    w,
    h,
    0,
    0,
    c.width,
    c.height,
  );
  return c;
}
const collectWords = (data) =>
  (data.blocks || [])
    .flatMap((b) => b.paragraphs || [])
    .flatMap((p) => p.lines || [])
    .flatMap((l) => l.words || [])
    .map((w) => ({ text: w.text, confidence: w.confidence, bbox: w.bbox }));
export async function recognizeCalendar(
  image,
  {
    month,
    legend = defaultLegend,
    angle = 0,
    selection,
    format = "auto",
    onProgress = () => {},
    signal,
  },
) {
  const { createWorker } = await import("tesseract.js"),
    canvas = canvasFor(image, angle, selection),
    grid = detectGrid(canvas);
  let worker;
  const check = () => {
    if (signal?.aborted) throw new DOMException("Cancelado", "AbortError");
  };
  try {
    worker = await createWorker("eng", 1, {
      workerPath: "/ocr/worker.min.js",
      corePath: "/ocr/core",
      langPath: "/ocr/lang",
      workerBlobURL: false,
      cacheMethod: "none",
      logger: (m) =>
        onProgress(
          m.status === "recognizing text"
            ? "Leyendo píxeles localmente…"
            : "Preparando motor local…",
        ),
    });
    check();
    let raw = "",
      result,
      words = [];
    const cells = [];
    if (grid && format !== "list") {
      await worker.setParameters({
        tessedit_pageseg_mode: "6",
        preserve_interword_spaces: "1",
      });
      const total = (grid.x.length - 1) * (grid.y.length - 1);
      let n = 0;
      for (let r = 0; r < grid.y.length - 1; r++)
        for (let c = 0; c < grid.x.length - 1; c++) {
          check();
          onProgress(`Leyendo región ${++n} de ${total}…`);
          const bbox = {
            x0: grid.x[c] + 5,
            y0: grid.y[r] + 5,
            x1: grid.x[c + 1] - 5,
            y1: grid.y[r + 1] - 5,
          };
          if (bbox.x1 <= bbox.x0 || bbox.y1 <= bbox.y0) continue;
          const { data } = await worker.recognize(crop(canvas, bbox));
          cells.push({
            row: r,
            col: c,
            bbox,
            text: data.text.trim(),
            confidence: data.confidence,
          });
          raw += data.text + "\n";
        }
      result = interpretCells(cells, { month, legend, format });
    } else {
      await worker.setParameters({
        tessedit_pageseg_mode: "11",
        preserve_interword_spaces: "1",
      });
      check();
      const { data } = await worker.recognize(
        canvas,
        {},
        { text: true, blocks: true },
      );
      raw = data.text;
      words = collectWords(data);
      result = interpretWords(
        words,
        { month, legend, format },
        canvas.width,
        canvas.height,
      );
      if (result.format !== "monthly-borderless" && format !== "list") {
        check();
        onProgress("Comprobando otra segmentación local y sus coordenadas…");
        await worker.setParameters({ tessedit_pageseg_mode: "6" });
        const second = await worker.recognize(
          canvas,
          {},
          { text: true, blocks: true },
        );
        const alternateWords = collectWords(second.data),
          alternate = interpretWords(
            alternateWords,
            { month, legend, format },
            canvas.width,
            canvas.height,
          );
        if (
          alternate.format === "monthly-borderless" &&
          alternate.rows.length >= 4
        ) {
          result = alternate;
          words = alternateWords;
          raw = second.data.text;
        }
      }
    }
    if (!grid && result.format === "monthly-borderless") {
      const geometry =
        borderlessCells(words, canvas.width, canvas.height) || [];
      await worker.setParameters({ tessedit_pageseg_mode: "6" });
      for (const c of geometry) {
        check();
        onProgress(
          `Comprobando celda sin bordes ${cells.length + 1} de ${geometry.length}…`,
        );
        const { data } = await worker.recognize(crop(canvas, c.bbox));
        cells.push({
          ...c,
          text: data.text.trim(),
          confidence: data.confidence,
        });
      }
      result = {
        ...interpretCells(cells, { month, legend, format }),
        format: "monthly-borderless",
      };
    }
    check();
    const rows = validateCandidates(result.rows, result.format);
    const warnings = [
      result.format === "unknown"
        ? "No se ha detectado un calendario interpretable. No se crean turnos; revisa el texto, recorta o añade filas manuales."
        : result.format === "date-list"
          ? "Lista de fechas detectada. Formato de cuadrícula no reconocido; conserva y revisa cada fecha/hora explícita."
          : "Disposición detectada. Comprueba cada fecha, horario y región de origen.",
      result.people.length
        ? "Tabla por persona: selecciona y confirma la fila o columna de origen antes de revisar candidatos."
        : "",
      result.ignoredInstructions
        ? "Se ha ignorado texto con instrucciones ajenas al calendario. Nunca se ejecuta el contenido de una imagen."
        : "",
      "Las celdas vacías o no leídas no se consideran libres.",
    ].filter(Boolean);
    return {
      ...result,
      rows,
      raw,
      grid: !!grid,
      words,
      cells,
      canvas,
      warning: warnings.join(" "),
    };
  } finally {
    await worker?.terminate();
  }
}
