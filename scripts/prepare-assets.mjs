import {
  mkdir,
  copyFile,
  readdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
await import("./prepare-ocr.mjs");
await import("./prepare-tiff-source.mjs");
await copyFile(
  "vendor/pdfjs-jpeg/LICENSE",
  "legal/third-party/pdfjs-jpeg-LICENSE.txt",
);
await mkdir("public/codecs/libheif", { recursive: true });
await copyFile(
  "node_modules/libheif-js/libheif-wasm/libheif-bundle.mjs",
  "public/codecs/libheif/libheif-bundle.mjs",
);
await copyFile(
  "node_modules/libheif-js/libheif-wasm/LICENSE",
  "public/codecs/libheif/COPYING.txt",
);
await mkdir("public/legal/third-party", { recursive: true });
await copyFile("LICENSE", "public/legal/APPLICATION-LICENSE.txt");
const names = (await readdir("legal/third-party")).sort();
for (const name of names) {
  if (!/^[\w.-]+$/.test(name)) throw Error("Unexpected notice filename");
  await copyFile(
    path.join("legal/third-party", name),
    path.join("public/legal/third-party", name + ".txt"),
  );
}
await copyFile(
  "THIRD-PARTY-NOTICES.md",
  "public/legal/THIRD-PARTY-NOTICES.txt",
);
await mkdir("public/legal/sources", { recursive: true });
const sources = JSON.parse(
  await readFile("legal/sources/manifest.json", "utf8"),
);
for (const item of sources.files) {
  if (!/^[\w.-]+\.tar\.gz$/.test(item.file))
    throw Error("Unexpected source filename");
  const bytes = await readFile(path.join("legal/sources", item.file));
  if (
    bytes.length !== item.bytes ||
    createHash("sha256").update(bytes).digest("hex") !== item.sha256
  )
    throw Error("Native source hash mismatch");
  await copyFile(
    path.join("legal/sources", item.file),
    path.join("public/legal/sources", item.file),
  );
}
await copyFile(
  "legal/sources/manifest.json",
  "public/legal/sources/manifest.json",
);
const escape = (s) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const notice = await readFile("THIRD-PARTY-NOTICES.md", "utf8");
await writeFile(
  "public/legal/index.html",
  `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Licencias y fuentes — Turnos en Común</title><style>body{max-width:900px;margin:32px auto;padding:0 20px;font:16px/1.6 system-ui;color:#173c36}a{color:#126653}pre{white-space:pre-wrap;overflow-wrap:anywhere}li{margin:8px 0}</style><main><h1>Licencias y fuentes</h1><p>Estos avisos conservan las licencias de terceros. Código propio bajo MIT, Copyright (c) 2026 Guillem Carrion. Las licencias de terceros se conservan.</p><p><a href="../">Volver al calendario</a> · <a href="THIRD-PARTY-NOTICES.txt">Descargar avisos</a></p><p><a href="APPLICATION-LICENSE.txt">Licencia MIT del código propio</a></p><h2>Fuentes nativas incluidas</h2><p>Las fuentes de aplicación están en <a href="https://github.com/Guillem94/turnos-en-comun">el repositorio público</a> y acompañan al candidato en su carpeta source. Las fuentes nativas siguientes se sirven junto al build.</p><ul>${sources.files.map((f) => `<li><a href="sources/${f.file}">${escape(f.name)} — ${escape(f.revision)}</a></li>`).join("")}</ul><h2>Textos completos</h2><ul>${names.map((n) => `<li><a href="third-party/${n}.txt">${escape(n)}</a></li>`).join("")}</ul><h2>Avisos</h2><pre>${escape(notice)}</pre></main></html>`,
);
console.log(
  "Recursos locales preparados: OCR, decoder HEIC sustituible, avisos y cuatro fuentes nativas.",
);
