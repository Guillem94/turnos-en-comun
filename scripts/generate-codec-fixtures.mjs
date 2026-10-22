import { chromium } from "@playwright/test";
import { Worker } from "node:worker_threads";
import { mkdir, writeFile } from "node:fs/promises";
import { formatFixture } from "../tests/format-fixtures.js";
import { isolateNetwork } from "../tests/network.js";
import UTIF from "utif";
const dir = new URL("../tests/images/", import.meta.url);
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage();
  await isolateNetwork(page);
  await page.goto("http://127.0.0.1:5179");
  console.log(
    "Native decoder support",
    await page.evaluate(async () =>
      Object.fromEntries(
        await Promise.all(
          ["png", "jpeg", "webp", "gif", "bmp", "avif", "heic", "tiff"].map(
            async (f) => [
              f,
              !!window.ImageDecoder &&
                (await ImageDecoder.isTypeSupported("image/" + f)),
            ],
          ),
        ),
      ),
    ),
  );
  const images = [];
  for (const kind of ["monthly", "list"]) {
    const png = await formatFixture(page, kind);
    const image = await page.evaluate(async (data) => {
      const im = new Image();
      im.src = "data:image/png;base64," + data;
      await im.decode();
      const c = document.createElement("canvas");
      c.width = im.width;
      c.height = im.height;
      const x = c.getContext("2d");
      x.drawImage(im, 0, 0);
      return {
        width: c.width,
        height: c.height,
        pixels: Array.from(x.getImageData(0, 0, c.width, c.height).data),
      };
    }, png.toString("base64"));
    images.push({ ...image, pixels: new Uint8Array(image.pixels) });
    await writeFile(new URL(kind + ".png", dir), png);
  }
  const im = images[0];
  await writeFile(
    new URL("calendar.tiff", dir),
    new Uint8Array(UTIF.encodeImage(im.pixels, im.width, im.height)),
  );
  await writeFile(new URL("calendar.bmp", dir), bmp(im));
  await writeFile(new URL("calendar.gif", dir), gif([im]));
  // Both frames have the same logical screen; second contains a different real raster.
  const resized = await page.evaluate(
    ({ a, b }) => {
      const c = document.createElement("canvas");
      c.width = a.width;
      c.height = a.height;
      const x = c.getContext("2d");
      x.fillStyle = "white";
      x.fillRect(0, 0, c.width, c.height);
      const other = document.createElement("canvas");
      other.width = b.width;
      other.height = b.height;
      other
        .getContext("2d")
        .putImageData(
          new ImageData(new Uint8ClampedArray(b.pixels), b.width, b.height),
          0,
          0,
        );
      x.drawImage(other, 0, 0);
      return Array.from(x.getImageData(0, 0, c.width, c.height).data);
    },
    {
      a: { width: im.width, height: im.height },
      b: { ...images[1], pixels: Array.from(images[1].pixels) },
    },
  );
  await writeFile(
    new URL("calendar-animated.gif", dir),
    gif([im, { ...im, pixels: new Uint8Array(resized) }]),
  );
  await writeFile(new URL("calendar-pages.tiff", dir), tiffPages(images));
  for (const format of ["heic", "avif"]) {
    const result = await new Promise((resolve, reject) => {
      const worker = new Worker(
        new URL("./encode-fixture-worker.mjs", import.meta.url),
        { workerData: { ...im, format } },
      );
      const timer = setTimeout(() => {
        worker.terminate();
        reject(new Error(format + " fixture encode timeout"));
      }, 60000);
      worker.on("message", (data) => {
        clearTimeout(timer);
        worker.terminate();
        resolve(data);
      });
      worker.on("error", (err) => {
        clearTimeout(timer);
        worker.terminate();
        reject(err);
      });
    });
    await writeFile(new URL("calendar." + format, dir), result);
    console.log(format, result.byteLength);
  }
} finally {
  await browser.close();
}
await import("./fixture-manifest.mjs");
function bmp({ width: w, height: h, pixels }) {
  const stride = (w * 3 + 3) & ~3,
    b = Buffer.alloc(54 + stride * h);
  b.write("BM");
  b.writeUInt32LE(b.length, 2);
  b.writeUInt32LE(54, 10);
  b.writeUInt32LE(40, 14);
  b.writeInt32LE(w, 18);
  b.writeInt32LE(h, 22);
  b.writeUInt16LE(1, 26);
  b.writeUInt16LE(24, 28);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4,
        d = 54 + (h - 1 - y) * stride + x * 3;
      b[d] = pixels[s + 2];
      b[d + 1] = pixels[s + 1];
      b[d + 2] = pixels[s];
    }
  return b;
}
function gif(images) {
  const { width: w, height: h } = images[0],
    header = Buffer.alloc(13);
  header.write("GIF89a");
  header.writeUInt16LE(w, 6);
  header.writeUInt16LE(h, 8);
  header[10] = 0x80;
  const parts = [header, Buffer.from([255, 255, 255, 0, 0, 0])];
  for (const im of images) {
    parts.push(Buffer.from([0x21, 0xf9, 4, 4, 10, 0, 0, 0]));
    const desc = Buffer.alloc(10);
    desc[0] = 0x2c;
    desc.writeUInt16LE(w, 5);
    desc.writeUInt16LE(h, 7);
    parts.push(desc, Buffer.from([2]));
    const codes = [];
    let bits = 0,
      value = 0;
    const code = (n) => {
      value |= n << bits;
      bits += 3;
      while (bits >= 8) {
        codes.push(value & 255);
        value >>>= 8;
        bits -= 8;
      }
    };
    for (let p = 0; p < w * h; p++) {
      code(4);
      code(im.pixels[p * 4] < 160 ? 1 : 0);
    }
    code(5);
    if (bits) codes.push(value & 255);
    for (let p = 0; p < codes.length; p += 255) {
      const block = codes.slice(p, p + 255);
      parts.push(Buffer.from([block.length]), Buffer.from(block));
    }
    parts.push(Buffer.from([0]));
  }
  parts.push(Buffer.from([0x3b]));
  return Buffer.concat(parts);
}
function tiffPages(images) {
  // Minimal, uncompressed, RGBA little-endian TIFF writer solely for fixtures.
  const count = 11,
    ifdSize = 2 + count * 12 + 4,
    metadataEnd = 8 + images.length * (ifdSize + 8);
  let offset = metadataEnd;
  const ifds = images.map((im) => {
    const p = offset;
    offset += im.width * im.height * 4;
    return p;
  });
  const b = Buffer.alloc(offset);
  b.write("II");
  b.writeUInt16LE(42, 2);
  b.writeUInt32LE(8, 4);
  images.forEach((im, i) => {
    const start = 8 + i * (ifdSize + 8),
      bits = start + ifdSize;
    b.writeUInt16LE(count, start);
    const tags = [
      [256, 4, 1, im.width],
      [257, 4, 1, im.height],
      [258, 3, 4, bits],
      [259, 3, 1, 1],
      [262, 3, 1, 2],
      [273, 4, 1, ifds[i]],
      [274, 3, 1, 1],
      [277, 3, 1, 4],
      [278, 4, 1, im.height],
      [279, 4, 1, im.width * im.height * 4],
      [338, 3, 1, 2],
    ];
    tags.forEach(([tag, type, n, value], j) => {
      const p = start + 2 + j * 12;
      b.writeUInt16LE(tag, p);
      b.writeUInt16LE(type, p + 2);
      b.writeUInt32LE(n, p + 4);
      b.writeUInt32LE(value, p + 8);
    });
    b.writeUInt32LE(
      i + 1 < images.length ? start + ifdSize + 8 : 0,
      start + 2 + count * 12,
    );
    for (let p = 0; p < 4; p++) b.writeUInt16LE(8, bits + p * 2);
    b.set(im.pixels, ifds[i]);
  });
  return b;
}
