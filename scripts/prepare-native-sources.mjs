// Fixed public upstream archives, retained as data. Never runs upstream scripts.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
const folder = "legal/sources";
await mkdir(folder, { recursive: true });
const targets = [
  {
    name: "libheif-js",
    repo: "catdad-experiments/libheif-js",
    revision: "d8ec4bc3bc5bf8055975577bccbbc7e1d7313c2d",
  },
  {
    name: "libheif-emscripten",
    repo: "catdad-experiments/libheif-emscripten",
    revision: "v1.23.5",
  },
  {
    name: "libheif",
    repo: "strukturag/libheif",
    revision: "413e2a87e6a70b3eccc3a3adc5801179dd2d9e00",
  },
  { name: "libde265", repo: "strukturag/libde265", revision: "v1.0.15" },
];
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
let prior = { files: [] };
try {
  prior = JSON.parse(await readFile(folder + "/manifest.json", "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const files = [];
for (const target of targets) {
  const previous = prior.files.find(
    (f) => f.name === target.name && f.requestedRevision === target.revision,
  );
  if (previous) {
    const bytes = await readFile(folder + "/" + previous.file);
    if (bytes.length !== previous.bytes || sha(bytes) !== previous.sha256)
      throw Error("Cached source mismatch: " + target.name);
    files.push(previous);
    continue;
  }
  let revision = target.revision;
  if (!/^[a-f0-9]{40}$/.test(revision)) {
    const response = await fetch(
      "https://api.github.com/repos/" + target.repo + "/commits/" + revision,
      { signal: AbortSignal.timeout(20000) },
    );
    if (!response.ok)
      throw Error("Cannot resolve upstream revision: " + target.name);
    revision = (await response.json()).sha;
    if (!/^[a-f0-9]{40}$/.test(revision))
      throw Error("Invalid resolved commit");
  }
  const url =
    "https://codeload.github.com/" + target.repo + "/tar.gz/" + revision;
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok)
    throw Error(
      "Source download failed: " + target.name + " " + response.status,
    );
  const chunks = [];
  let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > 64000000) throw Error("Source archive exceeds 64 MB");
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b)
    throw Error("Invalid gzip source archive");
  const file = target.name + "-" + revision + ".tar.gz";
  await writeFile(folder + "/" + file, bytes, { flag: "wx" });
  files.push({
    name: target.name,
    requestedRevision: target.revision,
    revision,
    source: url,
    file,
    bytes: length,
    sha256: sha(bytes),
  });
  // Preserve each verified download so an interrupted run never repeats an uncertain write.
  await writeFile(
    folder + "/manifest.json",
    JSON.stringify({ schemaVersion: 1, files }, null, 2) + "\n",
  );
}
await writeFile(
  folder + "/manifest.json",
  JSON.stringify({ schemaVersion: 1, files }, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    status: "PREPARED",
    archives: files.length,
    bytes: files.reduce((n, f) => n + f.bytes, 0),
    scriptsExecuted: false,
    files: files.map((f) => ({
      name: f.name,
      revision: f.revision,
      bytes: f.bytes,
    })),
  }),
);
