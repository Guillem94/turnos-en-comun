import { test, expect } from "@playwright/test";
import {
  readFile,
  writeFile,
  readdir,
  mkdir,
  cp,
  mkdtemp,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { preview } from "vite";
import { isolateNetwork } from "./network.js";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function load(
  page,
  file,
  origin = "http://127.0.0.1:5179",
  beforeUpload = async () => {},
) {
  await isolateNetwork(page, origin);
  await page.goto(origin);
  await page.getByRole("button", { name: "Crear mi calendario local" }).click();
  await page
    .getByRole("button", { name: "Importar imagen", exact: true })
    .click();
  await page.getByLabel("Mes y año", { exact: true }).fill("2026-11");
  await page.getByLabel("Confirmo que M/T/N/L").check();
  await beforeUpload();
  await page.getByLabel("Elegir imagen del calendario").setInputFiles({
    name: file,
    mimeType: "application/octet-stream",
    buffer: await readFile(new URL("./images/" + file, import.meta.url)),
  });
}
async function analyze(page) {
  const button = page.getByRole("button", {
    name: "Analizar en este dispositivo",
  });
  await expect(button).toBeEnabled({ timeout: 35000 });
  await button.click();
  await expect(button).toBeEnabled({ timeout: 150000 });
  await expect(page.locator(".preview-table tbody tr")).toHaveCount(14);
}
test("libheif sustituido en disco ejecuta HEIC y OCR sin recompilar el bundle", async ({
  page,
}) => {
  const qaRoot = path.resolve("test-artifacts");
  await mkdir(qaRoot, { recursive: true });
  const workspace = await mkdtemp(path.join(qaRoot, "recomposition-"));
  const site = path.join(workspace, "web");
  await cp(path.resolve("dist"), site, { recursive: true });
  const relative = "codecs/libheif/libheif-bundle.mjs";
  const original = await readFile(path.join(site, relative));
  await writeFile(
    path.join(site, "codecs/libheif/original-for-proof.mjs"),
    original,
  );
  const replacement = `import original from './original-for-proof.mjs';
export default async function(...args){const m=await original(...args);const C=m.HeifDecoder;
m.HeifDecoder=class {constructor(){this.original=new C()}decode(bytes){console.info('TURNOS_RECOMPOSITION_EXECUTED');return this.original.decode(bytes)}};return m;}`;
  await writeFile(path.join(site, relative), replacement);
  const assets = (await readdir("dist/assets")).filter((f) =>
    f.endsWith(".js"),
  );
  for (const file of assets)
    expect(hash(await readFile(path.join(site, "assets", file)))).toBe(
      hash(await readFile(path.join("dist/assets", file))),
    );
  const messages = [],
    errors = [];
  page.on("console", (m) => messages.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  const server = await preview({
    root: workspace,
    configFile: false,
    publicDir: false,
    build: { outDir: "web" },
    preview: { host: "127.0.0.1", port: 5180, strictPort: true },
  });
  try {
    await load(page, "calendar.heic", "http://127.0.0.1:5180");
    await analyze(page);
    expect(messages).toContain("TURNOS_RECOMPOSITION_EXECUTED");
    expect(errors).toEqual([]);
    await expect(page.getByLabel("Fecha fila 1", { exact: true })).toHaveValue(
      "2026-11-01",
    );
    await expect(
      page.getByLabel("Entrada fila 3", { exact: true }),
    ).toHaveValue("22:00");
    await expect(page.getByLabel("Salida fila 3", { exact: true })).toHaveValue(
      "06:00",
    );
    expect(page.__externalResponses).toEqual([]);
    expect(
      page.__networkBlocked.filter(
        (r) => !r.host.endsWith("kaspersky-labs.com"),
      ),
    ).toEqual([]);
    await writeFile(
      path.join(qaRoot, "recomposition-proof.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          appVersion: "0.5.0",
          replacementOnDisk: true,
          originalModuleSha256: hash(original),
          replacementModuleSha256: hash(Buffer.from(replacement)),
          unchangedAppBundles: assets.length,
          executedMarker: true,
          realHeicDecodeAndOcr: true,
          candidates: 14,
          externalAppRequests: 0,
          nativeRecompilePerformed: false,
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    await new Promise((resolve, reject) =>
      server.httpServer.close((e) => (e ? reject(e) : resolve())),
    );
  }
});
test("fallo del recurso HEIC local se explica y permite continuar con BMP", async ({
  page,
}) => {
  await load(page, "calendar.heic", "http://127.0.0.1:5179", async () => {
    await page.route("**/codecs/libheif/libheif-bundle.mjs", (r) =>
      r.fulfill({ status: 503, body: "unavailable" }),
    );
  });
  await expect(
    page.getByText("No se pudo cargar el decodificador HEIC local.", {
      exact: false,
    }),
  ).toBeVisible({ timeout: 35000 });
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("turnos-en-comun:v1:personal")).entries
          .length,
    ),
  ).toBe(0);
  await page.getByLabel("Elegir imagen del calendario").setInputFiles({
    name: "calendar.bmp",
    mimeType: "image/bmp",
    buffer: await readFile(new URL("./images/calendar.bmp", import.meta.url)),
  });
  await analyze(page);
});
test("avisos y cuatro fuentes nativas acompañan al build y son accesibles", async ({
  page,
  context,
}) => {
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (
      ["http:", "https:"].includes(u.protocol) &&
      u.origin !== "http://127.0.0.1:5179"
    )
      return route.abort("blockedbyclient");
    return route.continue();
  });
  await load(page, "calendar.bmp");
  await page.getByRole("button", { name: "Cancelar importación" }).click();
  const opened = page.waitForEvent("popup");
  await page
    .getByRole("link", { name: "Licencias y fuentes", exact: true })
    .click();
  const legal = await opened;
  await legal.waitForLoadState("domcontentloaded");
  await expect(legal).toHaveTitle("Licencias y fuentes — Turnos en Común");
  await expect(
    legal.getByRole("heading", { name: "Licencias y fuentes", exact: true }),
  ).toBeVisible();
  await expect(legal.locator('a[href$=".tar.gz"]')).toHaveCount(4);
  const links = await legal
    .locator("a")
    .evaluateAll((nodes) => nodes.map((n) => n.href));
  const publicSource = "https://github.com/Guillem94/turnos-en-comun";
  expect(links).toContain(publicSource);
  for (const href of links) {
    if (href === publicSource) continue;
    expect(new URL(href).origin).toBe("http://127.0.0.1:5179");
    expect((await legal.request.get(href)).status()).toBe(200);
  }
  await expect(legal.locator("pre")).toContainText("LGPL");
  await legal.screenshot({ path: "test-artifacts/licencias-fuentes.png" });
});
