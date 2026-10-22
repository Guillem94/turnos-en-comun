import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../tests/images/", import.meta.url),
  files = [];
for (const name of (await readdir(root)).sort()) {
  if (!/\.(png|heic|avif|bmp|gif|tiff)$/.test(name)) continue;
  const buffer = await readFile(new URL(name, root));
  files.push({
    name,
    bytes: buffer.length,
    sha256: createHash("sha256").update(buffer).digest("hex"),
  });
}
await writeFile(
  new URL("manifest.json", root),
  JSON.stringify(
    {
      purpose: "Synthetic calendars only; no OCR mock outputs",
      encoders: {
        icodec: "0.6.0",
        utif: "3.1.0",
        bmp: "fixture writer BMP24",
        gif: "fixture writer palette/LZW",
      },
      files,
    },
    null,
    2,
  ) + "\n",
);
console.log(files.length + " fixtures rasterizados inventariados.");
