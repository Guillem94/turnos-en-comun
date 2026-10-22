import { avifDimensions } from "./avif-header.js";
// Signature-based input validation. Filenames and browser MIME hints are untrusted.
export const MAX_BYTES = 12 * 1024 * 1024;
export const MAX_PIXELS = 16000000;
export const MAX_FRAMES = 32;
export function checkDimensions(width, height) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width * height > MAX_PIXELS
  )
    throw new Error(
      "La imagen supera 16 megapíxeles o tiene dimensiones inválidas. Recorta o reduce antes de cargar.",
    );
}
export function imageHeader(buffer) {
  const a = new Uint8Array(buffer),
    v = new DataView(buffer);
  const text = (p, n) => String.fromCharCode(...a.subarray(p, p + n));
  const size = (format, width, height) => {
    checkDimensions(width, height);
    return { format, width, height };
  };
  if (a.length < 12)
    throw new Error("Archivo incompleto o formato no reconocido.");
  if (text(0, 8) === "\x89PNG\r\n\x1a\n" && a.length >= 24)
    return size("png", v.getUint32(16), v.getUint32(20));
  if (text(0, 3) === "GIF" && ["87a", "89a"].includes(text(3, 3)))
    return size("gif", v.getUint16(6, true), v.getUint16(8, true));
  if (text(0, 2) === "BM" && a.length >= 30 && v.getUint32(14, true) >= 40)
    return size("bmp", v.getInt32(18, true), Math.abs(v.getInt32(22, true)));
  if (["II*\x00", "MM\x00*"].includes(text(0, 4))) return { format: "tiff" };
  if (a[0] === 255 && a[1] === 216) {
    let p = 2;
    while (p + 9 < a.length) {
      if (a[p++] !== 255) break;
      while (a[p] === 255) p++;
      const marker = a[p++];
      if (marker === 217 || marker === 218) break;
      const n = v.getUint16(p);
      if (n < 2 || p + n > a.length) break;
      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(marker)
      )
        return size("jpeg", v.getUint16(p + 5), v.getUint16(p + 3));
      p += n;
    }
    throw new Error("JPEG incompleto o sin dimensiones legibles.");
  }
  if (text(0, 4) === "RIFF" && text(8, 4) === "WEBP") {
    for (let p = 12; p + 18 <= a.length;) {
      const type = text(p, 4),
        n = v.getUint32(p + 4, true),
        q = p + 8;
      if (q + n > a.length) break;
      if (type === "VP8X" && n >= 10)
        return size(
          "webp",
          1 + a[q + 4] + (a[q + 5] << 8) + (a[q + 6] << 16),
          1 + a[q + 7] + (a[q + 8] << 8) + (a[q + 9] << 16),
        );
      if (type === "VP8 " && n >= 10)
        return size(
          "webp",
          v.getUint16(q + 6, true) & 16383,
          v.getUint16(q + 8, true) & 16383,
        );
      if (type === "VP8L" && n >= 5) {
        const bits = v.getUint32(q + 1, true);
        return size("webp", 1 + (bits & 16383), 1 + ((bits >>> 14) & 16383));
      }
      p = q + n + (n % 2);
    }
    throw new Error("WebP incompleto o sin dimensiones legibles.");
  }
  if (text(4, 4) === "ftyp") {
    const end = v.getUint32(0);
    if (end < 16 || end > Math.min(a.length, 1024))
      throw new Error("Contenedor HEIF/AVIF inválido.");
    const brands = [text(8, 4)];
    for (let p = 16; p + 4 <= end; p += 4) brands.push(text(p, 4));
    if (
      brands.some((b) =>
        ["hevc", "hevx", "hevm", "hevs", "msf1"].includes(b),
      ) &&
      !brands.includes("avis")
    )
      throw new Error(
        "Secuencia HEIF temporal no soportada. Exporta un fotograma como HEIC estático o PNG.",
      );
    if (brands.some((b) => ["avif", "avis"].includes(b))) {
      if (brands.includes("avis"))
        throw new Error(
          "AVIF animado no soportado. Exporta un fotograma como PNG.",
        );
      return { format: "avif", ...avifDimensions(buffer) };
    }
    if (brands.some((b) => ["heic", "heix", "mif1"].includes(b)))
      return { format: "heic" };
  }
  throw new Error(
    "Formato no soportado. Usa PNG, JPEG, WebP, HEIC/HEIF, AVIF, BMP, TIFF o GIF. SVG, PDF y RAW no se interpretan.",
  );
}
export function staticFallbackAllowed(buffer, format) {
  const a = new Uint8Array(buffer),
    v = new DataView(buffer);
  const text = (p, n) => String.fromCharCode(...a.subarray(p, p + n));
  if (["jpeg", "bmp"].includes(format)) return true;
  if (format === "png") {
    for (let p = 8; p + 12 <= a.length;) {
      const n = v.getUint32(p),
        type = text(p + 4, 4);
      if (n > a.length - p - 12) return false;
      if (type === "acTL") return false;
      p += n + 12;
    }
    return true;
  }
  if (format === "webp") {
    for (let p = 12; p + 8 <= a.length;) {
      const n = v.getUint32(p + 4, true),
        type = text(p, 4);
      if (n > a.length - p - 8) return false;
      if (
        type === "ANIM" ||
        type === "ANMF" ||
        (type === "VP8X" && a[p + 8] & 2)
      )
        return false;
      p += 8 + n + (n % 2);
    }
    return true;
  }
  if (format === "avif") {
    const end = v.getUint32(0);
    if (text(8, 4) === "avis") return false;
    for (let p = 16; p + 4 <= end; p += 4)
      if (text(p, 4) === "avis") return false;
    return true;
  }
  return false;
}
