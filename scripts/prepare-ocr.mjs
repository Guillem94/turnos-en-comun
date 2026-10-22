import { mkdir, copyFile, readdir } from "node:fs/promises";
import path from "node:path";
await mkdir("public/ocr/core", { recursive: true });
await mkdir("public/ocr/lang", { recursive: true });
await copyFile(
  "node_modules/tesseract.js/dist/worker.min.js",
  "public/ocr/worker.min.js",
);
await mkdir("public/ocr/licenses", { recursive: true });
for (const packageName of [
  "tesseract.js",
  "tesseract.js-core",
  "@tesseract.js-data/eng",
  "libheif-js",
  "utif",
  "pako",
]) {
  const folder = path.join("node_modules", packageName);
  for (const filename of await readdir(folder)) {
    if (/^(LICENSE|COPYING|NOTICE)/i.test(filename)) {
      await copyFile(
        path.join(folder, filename),
        path.join(
          "public/ocr/licenses",
          packageName.replaceAll("/", "-") + "-" + filename,
        ),
      );
    }
  }
}
await copyFile(
  "node_modules/tesseract.js/dist/worker.min.js.LICENSE.txt",
  "public/ocr/worker.min.js.LICENSE.txt",
);
for (const f of await readdir("node_modules/tesseract.js-core"))
  if (/\.wasm(\.js)?$/.test(f))
    await copyFile(
      path.join("node_modules/tesseract.js-core", f),
      path.join("public/ocr/core", f),
    );
await copyFile(
  "node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
  "public/ocr/lang/eng.traineddata.gz",
);
console.log(
  "OCR preparado: worker, WASM y modelo eng locales. Ninguna descarga necesaria al reconocer.",
);
