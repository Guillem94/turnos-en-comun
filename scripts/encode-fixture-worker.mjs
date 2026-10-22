// Test fixture encoder only. Never shipped to the application or used on user files.
import {
  parentPort,
  workerData,
  Worker as NodeWorker,
} from "node:worker_threads";
import { readFileSync } from "node:fs";
import { heic, avif } from "icodec/node";
const codec = workerData.format === "heic" ? heic : avif;
// icodec's x265 Emscripten build uses the browser Worker interface. Adapt only
// this test harness to Node threads; no browser isolation/security changes.
globalThis.Worker = class {
  constructor(url, options) {
    this.worker = new NodeWorker(
      new URL("./fixture-pthread.mjs", import.meta.url),
      { workerData: { url: url.href, name: options.name } },
    );
    this.worker.on("message", (data) => this.onmessage?.({ data }));
    this.worker.on("error", (error) => this.onerror?.(error));
  }
  postMessage(data, transfer) {
    this.worker.postMessage(data, transfer);
  }
  terminate() {
    return this.worker.terminate();
  }
};
await codec.loadEncoder(
  readFileSync(
    new URL(
      `../node_modules/icodec/dist/${workerData.format}-enc.wasm`,
      import.meta.url,
    ),
  ),
);
const result = codec.encode(
  {
    data: new Uint8ClampedArray(workerData.pixels),
    width: workerData.width,
    height: workerData.height,
    depth: 8,
  },
  workerData.format === "heic"
    ? { quality: 95, preset: "ultrafast", chroma: "444" }
    : { quality: 95, speed: 8 },
);
parentPort.postMessage(result);
