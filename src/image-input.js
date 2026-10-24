import { MAX_BYTES, imageHeader } from "./image-header.js";
export async function openImageInput(file, signal) {
  if (file.size > MAX_BYTES)
    throw new Error(
      "El archivo supera 12 MB. Reduce o separa la imagen antes de cargar.",
    );
  const buffer = await file.arrayBuffer();
  if (signal?.aborted)
    throw new DOMException("Lectura cancelada", "AbortError");
  imageHeader(buffer);
  const worker = new Worker(
    new URL("./image-decoder.worker.js", import.meta.url),
    { type: "module" },
  );
  let next = 0,
    closed = false,
    decoding = false;
  const checkOpen = () => {
    if (closed || signal?.aborted)
      throw new DOMException("Lectura cancelada", "AbortError");
  };
  const pending = new Map();
  function close() {
    if (closed) return;
    closed = true;
    worker.terminate();
    signal?.removeEventListener("abort", close);
    for (const { reject, timer } of pending.values()) {
      clearTimeout(timer);
      reject(new DOMException("Lectura cancelada", "AbortError"));
    }
    pending.clear();
  }
  signal?.addEventListener("abort", close, { once: true });
  worker.onmessage = ({ data }) => {
    const p = pending.get(data.id);
    if (!p) {
      // A timed-out/cancelled request can still have a queued transferable reply.
      data.bitmap?.close();
      return;
    }
    pending.delete(data.id);
    clearTimeout(p.timer);
    if (data.error) {
      data.bitmap?.close();
      p.reject(new Error(data.error));
    } else p.resolve(data);
  };
  worker.onerror = () => {
    for (const p of pending.values())
      p.reject(
        new Error(
          "No se pudo iniciar el decodificador local. Usa PNG o revisa el navegador.",
        ),
      );
    close();
  };
  function request(message, transfer = []) {
    return new Promise((resolve, reject) => {
      if (closed)
        return reject(new DOMException("Lectura cancelada", "AbortError"));
      const id = ++next;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(
          new Error(
            "La conversión local superó 30 segundos. Reduce o convierte la imagen a PNG.",
          ),
        );
        close();
      }, 30000);
      pending.set(id, { resolve, reject, timer });
      worker.postMessage({ ...message, id }, transfer);
    });
  }
  try {
    const metadata = await request({ action: "open", buffer }, [buffer]);
    return {
      ...metadata,
      close,
      async decode(index) {
        checkOpen();
        if (decoding)
          throw new Error(
            "Ya hay una conversión en curso. Espera a que termine.",
          );
        decoding = true;
        let transferredBitmap;
        try {
          const { width, height, orientation, pixels, bitmap } = await request({
            action: "decode",
            index,
          });
          transferredBitmap = bitmap;
          checkOpen();
          const original = document.createElement("canvas");
          original.width = width;
          original.height = height;
          if (transferredBitmap) {
            original.getContext("2d").drawImage(transferredBitmap, 0, 0);
          } else {
            original
              .getContext("2d")
              .putImageData(
                new ImageData(new Uint8ClampedArray(pixels), width, height),
                0,
                0,
              );
          }
          const canvas = document.createElement("canvas");
          canvas.width = orientation >= 5 ? height : width;
          canvas.height = orientation >= 5 ? width : height;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          const transforms = {
            1: [1, 0, 0, 1, 0, 0],
            2: [-1, 0, 0, 1, width, 0],
            3: [-1, 0, 0, -1, width, height],
            4: [1, 0, 0, -1, 0, height],
            5: [0, 1, 1, 0, 0, 0],
            6: [0, 1, -1, 0, height, 0],
            7: [0, -1, -1, 0, height, width],
            8: [0, -1, 1, 0, 0, width],
          };
          ctx.setTransform(...transforms[orientation]);
          ctx.drawImage(original, 0, 0);
          const blob = await new Promise((resolve) =>
            canvas.toBlob(resolve, "image/png"),
          );
          checkOpen();
          if (!blob)
            throw new Error("No se pudo preparar la imagen para el OCR.");
          const url = URL.createObjectURL(blob),
            image = new Image();
          image.src = url;
          try {
            await image.decode();
            checkOpen();
            return { url, image };
          } catch (e) {
            URL.revokeObjectURL(url);
            throw e;
          }
        } finally {
          transferredBitmap?.close();
          decoding = false;
        }
      },
    };
  } catch (e) {
    close();
    throw e;
  }
}
