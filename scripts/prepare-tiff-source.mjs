// Deterministic, minimal fork: replace only UTIF's untraced minified JPEG block.
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const revision = "11ab3b5c000eb13e7ea5632ac36b1109ff7280b7";
const url =
  "https://raw.githubusercontent.com/mozilla/pdf.js/" +
  revision +
  "/src/core/jpg.js";
await mkdir("vendor/pdfjs-jpeg", { recursive: true });
await mkdir("vendor/utif", { recursive: true });
if (process.argv.includes("--fetch-upstream")) {
  for (const [remote, local] of [
    [url, "jpg.original.js"],
    [
      "https://raw.githubusercontent.com/mozilla/pdf.js/" +
        revision +
        "/LICENSE",
      "LICENSE",
    ],
  ]) {
    const response = await fetch(remote, {
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw Error("Upstream source download failed");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 200000) throw Error("Unexpected source size");
    await writeFile("vendor/pdfjs-jpeg/" + local, bytes, { flag: "wx" });
  }
}
const original = await readFile("vendor/pdfjs-jpeg/jpg.original.js");
if (
  sha(original) !==
  "8d3bc82c19aacad00108425c98046affc417c59f70670daa1bdfbd0f766dc9ba"
)
  throw Error("Pinned Mozilla source differs");
const raw = await readFile("node_modules/utif/UTIF.js");
if (
  sha(raw) !==
  "e3e76115f49571e39624c3316a76b3c4c5b2c5ca518dfec4b66a9f7af8c6d059"
)
  throw Error("Pinned UTIF source differs");
const text = raw.toString("utf8");
const start = text.indexOf("(function(){var V=");
const terminator = "UTIF.JpegDecoder=g})()})();";
const end = text.indexOf(terminator, start) + terminator.length;
if (start < 0 || end < start) throw Error("JPEG block bounds missing");
if (
  sha(Buffer.from(text.slice(start, end))) !==
  "9e28cb5379076499bf35d57dc1862aa45e1382f7bfef2ae0dd36ff8a429fd92b"
)
  throw Error("JPEG block fingerprint differs");
const commonJsExport = `if (typeof module == "object") {module.exports = UTIF;}
else {self.UTIF = UTIF;}`;
const commonJsPako = `var pako;
if (typeof require == "function") {pako = require("pako");}
else {pako = self.pako;}`;
if (!text.includes(commonJsExport) || !text.includes(commonJsPako))
  throw Error("UTIF module interface differs");
const fork =
  "/* UTIF 3.1.0 — Copyright (c) 2017 Photopea, MIT.\n * Modified for Turnos en Común: replace only the untraced minified JPEG block\n * with the separately attributed Mozilla JpegImage source. TIFF code unchanged.\n */\n" +
  "// Modified module interface: explicit ESM imports/export; no global or require.\n" +
  "import pako from 'pako';\nimport { JpegImage } from '../pdfjs-jpeg/jpg.mjs';\nlet exported;\n" +
  (text.slice(0, start) + "UTIF.JpegDecoder = JpegImage;" + text.slice(end))
    .replace(commonJsExport, "exported = UTIF;")
    .replace(commonJsPako, "") +
  "\nexport default exported;\n";
let jpeg = original.toString("utf8");
const from = "import { warn } from '../shared/util';";
const exported = "export {\n  JpegImage,\n};";
if (!jpeg.includes(from) || !jpeg.includes(exported))
  throw Error("Mozilla module interface differs");
jpeg =
  "/* Modified for Turnos en Común: local warn adapter only; ESM export retained.\n * Decoder algorithm unchanged from Mozilla commit " +
  revision +
  ".\n */\n" +
  jpeg.replace(
    from,
    "const warn = (message) => console.warn('JPEG: ' + String(message));",
  );
await writeFile("vendor/utif/UTIF.mjs", fork);
await copyFile("node_modules/utif/LICENSE", "vendor/utif/LICENSE");
await writeFile("vendor/pdfjs-jpeg/jpg.mjs", jpeg);
await writeFile(
  "vendor/manifest.json",
  JSON.stringify(
    {
      schemaVersion: 1,
      utif: {
        version: "3.1.0",
        upstream:
          "https://github.com/photopea/UTIF.js/tree/27f1098a67c3cfd4348c9b8fd887fcd8cd171095",
        originalSha256: sha(raw),
        removedJpegBlockSha256: sha(Buffer.from(text.slice(start, end))),
        forkSha256: sha(Buffer.from(fork)),
        changes: ["ESM interface", "explicit JPEG source replacement"],
      },
      jpeg: {
        upstream: url,
        revision,
        originalSha256: sha(original),
        adaptedSha256: sha(Buffer.from(jpeg)),
        changes: ["local warning adapter; original ESM export retained"],
        license: "Apache-2.0",
        copyright: "Copyright 2014 Mozilla Foundation",
        lineage: "Forked from notmasteryet/jpgjs; original by notmasteryet",
      },
      caveat:
        "The replacement revision is explicit; it is not claimed to be the unidentified historical source of the removed block.",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    status: "PREPARED",
    jpegSource: revision,
    oldBlockRemoved: true,
    decoderAlgorithmChanges: 0,
  }),
);
