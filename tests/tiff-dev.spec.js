import { test, expect } from "@playwright/test";
import { createServer } from "vite";
import { readFile } from "node:fs/promises";
import { isolateNetwork } from "./network.js";
test("TIFF ESM en desarrollo: sin require ni globals, cuatro archivos reales", async ({
  page,
}) => {
  const server = await createServer({
    server: { host: "127.0.0.1", port: 5181, strictPort: true, hmr: false },
  });
  await server.listen();
  try {
    await isolateNetwork(page, "http://127.0.0.1:5181");
    await page.goto("http://127.0.0.1:5181");
    for (const file of [
      "images/calendar.tiff",
      "images/calendar-pages.tiff",
      "jpeg-images/calendar-jpeg6.tiff",
      "jpeg-images/calendar-jpeg7.tiff",
    ]) {
      const bytes = Array.from(
        await readFile(new URL("./" + file, import.meta.url)),
      );
      const result = await page.evaluate(
        (bytes) =>
          new Promise((resolve) => {
            const worker = new Worker("/src/image-decoder.worker.js", {
              type: "module",
            });
            let opened;
            const finish = (result) => {
              clearTimeout(timer);
              worker.terminate();
              resolve(result);
            };
            const timer = setTimeout(
              () => finish({ error: "worker timeout" }),
              15000,
            );
            worker.onerror = (e) => finish({ error: e.message });
            worker.onmessage = ({ data }) => {
              if (data.error) return finish({ error: data.error });
              if (data.frames) {
                opened = data;
                worker.postMessage({ id: 2, action: "decode", index: 0 });
              } else
                finish({
                  format: opened.format,
                  frames: opened.frames.length,
                  width: data.width,
                  height: data.height,
                  bytes: data.pixels?.byteLength,
                });
            };
            worker.postMessage({
              id: 1,
              action: "open",
              buffer: new Uint8Array(bytes).buffer,
            });
          }),
        bytes,
      );
      expect(result.error, file).toBeUndefined();
      expect(result.format).toBe("tiff");
      expect(result.frames).toBe(file.includes("pages") ? 2 : 1);
      expect(result.width).toBeGreaterThan(1000);
      expect(result.bytes).toBe(result.width * result.height * 4);
    }
    expect(page.__externalResponses).toEqual([]);
    expect(
      page.__networkBlocked.filter(
        (r) => !r.host.endsWith("kaspersky-labs.com"),
      ),
    ).toEqual([]);
  } finally {
    await server.close();
  }
});
