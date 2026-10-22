import { chromium } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
import { transposedFixture } from "../tests/transposed-fixtures.js";
import { isolateNetwork } from "../tests/network.js";
const folder = new URL("../tests/images/", import.meta.url);
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage();
  await isolateNetwork(page);
  await page.goto("http://127.0.0.1:5179");
  for (const kind of [
    "codes",
    "partial",
    "uncertain",
    "headerless",
    "duplicate-names",
    "malicious",
  ]) {
    const buffer = await transposedFixture(page, kind);
    await writeFile(new URL(`table-transposed-${kind}.png`, folder), buffer);
  }
  console.log(
    "6 tablas ficticias rasterizadas guardadas; sin salida OCR simulada.",
  );
} finally {
  await browser.close();
}
await import("./fixture-manifest.mjs");
