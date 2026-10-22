import {
  mkdir,
  readdir,
  copyFile,
  readFile,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
const version = JSON.parse(await readFile("package.json", "utf8")).version;
const relative =
  process.argv[2] || "release-candidates/turnos-en-comun-" + version;
const out = path.resolve(root, relative);
const allowed = path.join(root, "release-candidates") + path.sep;
if (!out.startsWith(allowed))
  throw Error("Candidate must be inside release-candidates");
await mkdir(path.dirname(out), { recursive: true });
await mkdir(out); // Never overwrite an existing candidate.
const files = [];
async function copy(source, destination) {
  const bytes = await readFile(source);
  const target = path.join(out, destination);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes, { flag: "wx" });
  files.push({
    path: destination.replaceAll("\\", "/"),
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
async function tree(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    if (
      ["__pycache__", ".git", "node_modules"].includes(entry.name) ||
      entry.name.startsWith(".env") ||
      entry.name.endsWith(".log")
    )
      continue;
    if (entry.isSymbolicLink()) throw Error("Unexpected symlink in export");
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) await tree(file);
    else if (entry.isFile()) {
      if (folder === "tests" && !/\.(js|mjs|py)$/.test(entry.name)) continue;
      await copy(file, file);
    }
  }
}
for (const folder of ["src", "tests", "vendor", "legal"]) await tree(folder);
for (const name of [
  "index.html",
  "package.json",
  "package-lock.json",
  "playwright.config.js",
  ".gitignore",
  ".gitattributes",
  "LICENSE",
  "THIRD-PARTY-NOTICES.md",
])
  await copy(name, name);
for (const name of [
  "prepare-ocr.mjs",
  "prepare-assets.mjs",
  "prepare-tiff-source.mjs",
  "prepare-native-sources.mjs",
  "verify-native-sources.py",
  "generate-codec-fixtures.mjs",
  "generate-table-fixtures.mjs",
  "generate-jpeg-tiff-fixtures.mjs",
  "encode-fixture-worker.mjs",
  "fixture-pthread.mjs",
  "fixture-manifest.mjs",
  "export-candidate.mjs",
  "package-candidate.py",
])
  await copy("scripts/" + name, "scripts/" + name);
for (const name of ["demo-ficticia.json", "favicon.svg"])
  await copy("public/" + name, "public/" + name);
// Only the dedicated public documentation is exported; no local operational history.
const mappings = {
  "README.md": "README.md",
  "DISTRIBUTION.md": "docs/DISTRIBUTION.md",
  "TESTING.md": "docs/TESTING.md",
  "VALIDATION.md": "docs/VALIDATION.md",
  "CONTRIBUTING.md": "CONTRIBUTING.md",
  "SECURITY.md": "SECURITY.md",
  "LICENSE-DECISION.md": "LICENSE-DECISION.md",
};
for (const [source, destination] of Object.entries(mappings))
  await copy("docs/public/" + source, destination);
for (const name of ["README-LEGAL.md", "README-VENDOR.md"]) {
  const destination =
    name === "README-LEGAL.md" ? "legal/README.md" : "vendor/README.md";
  const bytes = await readFile("docs/public/" + name);
  await writeFile(path.join(out, destination), bytes);
  const previous = files.find((f) => f.path === destination);
  if (previous) {
    previous.bytes = bytes.length;
    previous.sha256 = createHash("sha256").update(bytes).digest("hex");
  } else
    files.push({
      path: destination,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
}
for (const name of await readdir("docs/public"))
  await copy("docs/public/" + name, "docs/public/" + name);
for (const [source, name] of [
  ["tests/images/table-transposed-codes.png", "calendario-tabla.png"],
  ["tests/images/calendar.heic", "calendario.heic"],
  ["tests/jpeg-images/calendar-jpeg7.tiff", "calendario-jpeg.tiff"],
])
  await copy(source, "examples/" + name);
await writeFile(
  path.join(out, "CANDIDATE-MANIFEST.json"),
  JSON.stringify(
    {
      schemaVersion: 1,
      version,
      files: files.sort((a, b) => a.path.localeCompare(b.path)),
      exportedByAllowlist: true,
      historyIncluded: false,
      remoteCreated: false,
    },
    null,
    2,
  ) + "\n",
);
await mkdir("docs/oss", { recursive: true });
await writeFile(
  "docs/oss/candidate-export.json",
  JSON.stringify(
    {
      version,
      localPath: out,
      files: files.length,
      published: false,
      remoteCreated: false,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    status: "EXPORTED",
    path: out,
    files: files.length,
    remoteCreated: false,
  }),
);
