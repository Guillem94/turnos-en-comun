// Browser-style pthread bridge used solely by the synthetic HEIC encoder.
import { parentPort, workerData } from "node:worker_threads";
globalThis.self = globalThis;
globalThis.name = workerData.name;
globalThis.location = { href: workerData.url };
globalThis.importScripts = () => {
  throw new Error("No script fetching allowed in fixture encoder");
};
globalThis.postMessage = (data) => parentPort.postMessage(data);
const queue = [];
parentPort.on("message", (data) =>
  globalThis.onmessage ? globalThis.onmessage({ data }) : queue.push(data),
);
const { default: factory } = await import(workerData.url);
factory();
for (const data of queue) globalThis.onmessage({ data });
