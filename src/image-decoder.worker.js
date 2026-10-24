import {
  imageHeader,
  checkDimensions,
  MAX_BYTES,
  MAX_FRAMES,
  staticFallbackAllowed,
} from "./image-header.js";
let decoder,
  frames,
  kind,
  buffer,
  heif,
  heifDecoder,
  bitmap,
  operating = false;
function checkFrames(items) {
  if (!items.length || items.length > MAX_FRAMES)
    throw new Error(
      "Se admiten entre 1 y 32 páginas o fotogramas por archivo.",
    );
  let total = 0;
  for (const f of items) {
    checkDimensions(f.width, f.height);
    total += f.width * f.height;
  }
  if (total > 64000000)
    throw new Error(
      "El conjunto supera 64 megapíxeles. Separa las páginas o fotogramas.",
    );
}
self.onmessage = async ({ data }) => {
  if (operating) {
    self.postMessage({ id: data.id, error: "Ya hay una conversión en curso." });
    return;
  }
  operating = true;
  try {
    if (data.action === "open") {
      buffer = data.buffer;
      if (buffer.byteLength > MAX_BYTES)
        throw new Error("El archivo supera 12 MB.");
      kind = imageHeader(buffer).format;
      let metadata;
      if (kind === "heic") {
        // Fixed same-origin resource, deliberately outside the app bundle so
        // users can replace an interface-compatible LGPL library independently.
        const codecUrl = new URL(
          `${import.meta.env?.BASE_URL || "/"}codecs/libheif/libheif-bundle.mjs`,
          self.location.origin,
        ).href;
        let factory;
        try {
          ({ default: factory } = await import(/* @vite-ignore */ codecUrl));
        } catch {
          throw new Error(
            "No se pudo cargar el decodificador HEIC local. Vuelve a preparar los recursos de la aplicación.",
          );
        }
        heif = await factory();
        heifDecoder = new heif.HeifDecoder();
        frames = heifDecoder.decode(new Uint8Array(buffer));
        metadata = frames.map((f) => ({
          width: f.get_width(),
          height: f.get_height(),
          primary: f.is_primary(),
        }));
        checkFrames(metadata);
      } else if (kind === "tiff") {
        const { default: UTIF } = await import("../vendor/utif/UTIF.mjs");
        decoder = UTIF;
        frames = UTIF.decode(buffer).filter((f) => f.t256 && f.t257);
        metadata = frames.map((f) => ({ width: f.t256[0], height: f.t257[0] }));
        checkFrames(metadata);
      } else {
        const mime = "image/" + (kind === "bmp" ? "bmp" : kind);
        if (self.ImageDecoder && (await ImageDecoder.isTypeSupported(mime))) {
          try {
            decoder = new ImageDecoder({
              data: buffer,
              type: mime,
              preferAnimation: true,
            });
            await decoder.tracks.ready;
            await decoder.completed;
          } catch {
            decoder?.close();
            decoder = null;
          }
        }
        if (!decoder) {
          if (!staticFallbackAllowed(buffer, kind) || !self.createImageBitmap)
            throw new Error(
              `Este navegador no decodifica ${kind.toUpperCase()} con selección de fotogramas. Usa Edge/Chrome actualizado o convierte una imagen estática localmente a PNG.`,
            );
          bitmap = await createImageBitmap(new Blob([buffer], { type: mime }));
          checkDimensions(bitmap.width, bitmap.height);
          frames = [bitmap];
          metadata = [{ width: bitmap.width, height: bitmap.height }];
        } else {
          const count = decoder.tracks.selectedTrack?.frameCount;
          if (!Number.isInteger(count) || count < 1 || count > MAX_FRAMES)
            throw new Error(
              "Se admiten entre 1 y 32 páginas o fotogramas por archivo.",
            );
          const header = imageHeader(buffer);
          if (header.width && header.width * header.height * count > 64000000)
            throw new Error(
              "El conjunto supera 64 megapíxeles. Separa los fotogramas.",
            );
          metadata = Array.from({ length: count }, () => ({
            width: header.width,
            height: header.height,
          }));
        }
      }
      self.postMessage({ id: data.id, format: kind, frames: metadata });
    } else if (data.action === "decode") {
      const i = data.index;
      if (
        !Number.isInteger(i) ||
        i < 0 ||
        i >= (frames?.length ?? decoder.tracks.selectedTrack.frameCount)
      )
        throw new Error("Selecciona una página o fotograma válido.");
      let width,
        height,
        pixels,
        orientation = 1;
      if (kind === "heic") {
        const f = frames[i];
        width = f.get_width();
        height = f.get_height();
        checkDimensions(width, height);
        const image = {
          width,
          height,
          data: new Uint8ClampedArray(width * height * 4),
        };
        const out = await new Promise((resolve, reject) =>
          f.display(image, (x) =>
            x
              ? resolve(x)
              : reject(
                  new Error(
                    "No se pudo decodificar este HEIC; códec o archivo no soportado.",
                  ),
                ),
          ),
        );
        pixels = out.data;
      } else if (kind === "tiff") {
        const f = frames[i];
        checkDimensions(f.t256[0], f.t257[0]);
        decoder.decodeImage(buffer, f);
        width = f.width;
        height = f.height;
        checkDimensions(width, height);
        pixels = new Uint8ClampedArray(decoder.toRGBA8(f));
        orientation = f.t274?.[0] ?? 1;
        if (
          !Number.isInteger(orientation) ||
          orientation < 1 ||
          orientation > 8
        )
          throw new Error("Orientación TIFF no soportada.");
      } else {
        const { image } = bitmap
          ? { image: bitmap }
          : await decoder.decode({
              frameIndex: i,
              completeFramesOnly: true,
            });
        try {
          width = image.displayWidth ?? image.width;
          height = image.displayHeight ?? image.height;
          checkDimensions(width, height);
          if (bitmap && typeof OffscreenCanvas === "undefined") {
            // Keep the original bitmap in this worker for repeated decodes.
            // Only transfer a copy; main paints it without decoding the file again.
            const copy = await createImageBitmap(image);
            try {
              self.postMessage(
                { id: data.id, width, height, orientation, bitmap: copy },
                [copy],
              );
            } catch (error) {
              copy.close();
              throw error;
            }
            return;
          }
          const canvas = new OffscreenCanvas(width, height),
            ctx = canvas.getContext("2d");
          ctx.drawImage(image, 0, 0);
          pixels = ctx.getImageData(0, 0, width, height).data;
        } finally {
          if (!bitmap) image.close();
        }
      }
      if (pixels.length !== width * height * 4)
        throw new Error("La imagen decodificada está incompleta.");
      self.postMessage(
        { id: data.id, width, height, orientation, pixels: pixels.buffer },
        [pixels.buffer],
      );
    }
  } catch (e) {
    self.postMessage({
      id: data.id,
      error: e.message || "Imagen dañada o no compatible.",
    });
  } finally {
    operating = false;
  }
};
