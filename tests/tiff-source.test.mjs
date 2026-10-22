import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import next from "../vendor/utif/UTIF.mjs";
const require = createRequire(import.meta.url),
  old = require("utif");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifest = JSON.parse(
  await readFile(
    new URL("./jpeg-images/manifest.json", import.meta.url),
    "utf8",
  ),
);
for (const file of manifest.files)
  test("JPEG trazable, paridad rasterizada: " + file.name, async () => {
    const bytes = await readFile(
      new URL("./jpeg-images/" + file.name, import.meta.url),
    );
    assert.equal(digest(bytes), file.sha256);
    const decode = (lib) => {
      if (file.name.endsWith(".jpg")) {
        const image = new lib.JpegDecoder();
        image.parse(bytes);
        return {
          width: image.width,
          height: image.height,
          pixels: image.getData(image.width, image.height),
        };
      }
      const data = bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
        frame = lib.decode(data)[0];
      lib.decodeImage(data, frame);
      return {
        width: frame.width,
        height: frame.height,
        pixels: lib.toRGBA8(frame),
      };
    };
    const a = decode(old),
      b = decode(next);
    assert.equal(b.width, a.width);
    assert.equal(b.height, a.height);
    assert.equal(digest(b.pixels), digest(a.pixels));
  });
test("el fork elimina el bloque histórico y conserva fuente/copyright Apache fijados", async () => {
  const source = await readFile(
    new URL("../vendor/utif/UTIF.mjs", import.meta.url),
    "utf8",
  );
  assert.ok(!source.includes("(function(){var V="));
  const jpeg = await readFile(
    new URL("../vendor/pdfjs-jpeg/jpg.mjs", import.meta.url),
    "utf8",
  );
  assert.ok(jpeg.includes("Copyright 2014 Mozilla Foundation"));
  assert.ok(jpeg.includes("notmasteryet/jpgjs"));
  assert.ok(jpeg.includes("Decoder algorithm unchanged"));
});
