import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { isolateNetwork } from "./network.js";
const fixture = (name) => new URL("./images/" + name, import.meta.url);
async function open(page) {
  await isolateNetwork(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Crear mi calendario local" }).click();
  await page
    .getByRole("button", { name: "Importar imagen", exact: true })
    .click();
  await page.getByLabel("Mes y año", { exact: true }).fill("2026-11");
  await page.getByLabel("Confirmo que M/T/N/L").check();
}
async function upload(page, file, mime = "application/octet-stream") {
  await page.getByLabel("Elegir imagen del calendario").setInputFiles({
    name: file,
    mimeType: mime,
    buffer: await readFile(fixture(file)),
  });
}
async function analyze(page, count) {
  const button = page.getByRole("button", {
    name: "Analizar en este dispositivo",
  });
  await expect(button).toBeEnabled({ timeout: 35000 });
  await button.click();
  await expect(button).toBeEnabled({ timeout: 150000 });
  await expect(page.locator(".preview-table tbody tr")).toHaveCount(count);
}
async function noMutation(page) {
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("turnos-en-comun:v1:personal")).entries
          .length,
    ),
  ).toBe(0);
  expect(
    page.__networkBlocked.filter((r) => !r.host.endsWith("kaspersky-labs.com")),
  ).toEqual([]);
  expect(page.__externalResponses).toEqual([]);
}
for (const format of ["bmp", "gif", "tiff", "heic", "avif"])
  test(`Archivo ${format.toUpperCase()} real → conversión local → OCR`, async ({
    page,
  }) => {
    await open(page);
    await upload(page, "calendar." + format);
    await analyze(page, 14);
    const expected = [
      ["shift", "08:00", "16:00"],
      ["shift", "14:00", "22:00"],
      ["shift", "22:00", "06:00"],
      ["off", "", ""],
    ];
    for (let row = 1; row <= 14; row++) {
      const [kind, start, end] = expected[(row - 1) % 4];
      await expect(
        page.getByLabel(`Fecha fila ${row}`, { exact: true }),
      ).toHaveValue(
        format === "gif" && [1, 11].includes(row)
          ? ""
          : `2026-11-${String(row).padStart(2, "0")}`,
      );
      await expect(
        page.getByLabel(`Tipo fila ${row}`, { exact: true }),
      ).toHaveValue(kind);
      await expect(
        page.getByLabel(`Entrada fila ${row}`, { exact: true }),
      ).toHaveValue(start);
      await expect(
        page.getByLabel(`Salida fila ${row}`, { exact: true }),
      ).toHaveValue(end);
    }
    if (format === "gif") {
      await expect(
        page
          .getByText("Fecha repetida en celdas mensuales distintas", {
            exact: false,
          })
          .first(),
      ).toBeVisible();
      await expect(
        page.getByLabel("Revisado fila 11", { exact: true }),
      ).not.toBeChecked();
      await page
        .getByText("Fecha repetida en celdas mensuales distintas", {
          exact: false,
        })
        .first()
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: "test-artifacts/import-gif-pendiente.png",
      });
      await page.getByLabel("Fecha fila 1", { exact: true }).fill("2026-11-01");
      await page
        .getByLabel("Fecha fila 11", { exact: true })
        .fill("2026-11-11");
    }
    await expect(page.getByLabel("Fecha fila 1", { exact: true })).toHaveValue(
      "2026-11-01",
    );
    await expect(page.getByLabel("Fecha fila 14", { exact: true })).toHaveValue(
      "2026-11-14",
    );
    if (format === "heic")
      await page.screenshot({
        path: "test-artifacts/import-heic.png",
        fullPage: true,
      });
    await noMutation(page);
    await page.getByRole("button", { name: "Cancelar importación" }).click();
  });
for (const file of ["calendar-pages.tiff", "calendar-animated.gif"])
  test(`Selección explícita y cancelación: ${file}`, async ({ page }) => {
    await open(page);
    await upload(page, file);
    const select = page.getByLabel("Página o fotograma para revisar"),
      button = page.getByRole("button", {
        name: "Analizar en este dispositivo",
      });
    await expect(select).toBeVisible({ timeout: 35000 });
    await expect(select).toHaveValue("");
    await expect(button).toBeDisabled();
    await select.selectOption("0");
    await analyze(page, 14);
    await select.selectOption("1");
    await expect(page.locator(".preview-table tbody tr")).toHaveCount(0);
    await analyze(page, 3);
    await expect(page.getByLabel("Fecha fila 1", { exact: true })).toHaveValue(
      "2026-11-12",
    );
    await expect(
      page.getByLabel("Entrada fila 2", { exact: true }),
    ).toHaveValue("22:00");
    if (file.endsWith("tiff"))
      await page.screenshot({
        path: "test-artifacts/import-tiff-paginas.png",
        fullPage: true,
      });
    await noMutation(page);
    await page.getByRole("button", { name: "Cancelar importación" }).click();
  });
test("firma prevalece al nombre HEIF y al MIME vacío", async ({ page }) => {
  await open(page);
  await page.getByLabel("Elegir imagen del calendario").setInputFiles({
    name: "iphone.heif",
    mimeType: "",
    buffer: await readFile(fixture("calendar.heic")),
  });
  await analyze(page, 14);
  await noMutation(page);
});
test("límites y corrupción dan error claro y permiten otra carga", async ({
  page,
}) => {
  await open(page);
  const field = page.getByLabel("Elegir imagen del calendario");
  await field.setInputFiles({
    name: "grande.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(12 * 1024 * 1024 + 1),
  });
  await expect(page.getByRole("alert")).toContainText("12 MB");
  const png = await readFile(fixture("monthly.png"));
  png.writeUInt32BE(100000, 16);
  await field.setInputFiles({
    name: "pixeles.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(page.getByRole("alert")).toContainText("16 megapíxeles");
  await field.setInputFiles({
    name: "corrupto.heic",
    mimeType: "image/heic",
    buffer: Buffer.from([
      0,
      0,
      0,
      24,
      ...Buffer.from("ftypheic"),
      0,
      0,
      0,
      0,
      ...Buffer.from("heicmif1"),
    ]),
  });
  await expect(page.getByRole("alert")).toContainText("páginas o fotogramas");
  const head = Buffer.from([
    71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 128, 0, 0, 255, 255, 255, 0, 0, 0,
  ]);
  const frame = Buffer.from([
    33, 249, 4, 4, 10, 0, 0, 0, 44, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 68, 1, 0,
  ]);
  await field.setInputFiles({
    name: "muchos.gif",
    mimeType: "image/gif",
    buffer: Buffer.concat([head, ...Array(33).fill(frame), Buffer.from([59])]),
  });
  await expect(page.getByRole("alert")).toContainText("32 páginas");
  await upload(page, "calendar.bmp");
  await analyze(page, 14);
  await noMutation(page);
});
for (const phase of ["blob", "image"])
  test(`Cancelar durante preparación ${phase} termina worker y revoca URLs`, async ({
    page,
  }) => {
    await page.addInitScript((phase) => {
      const workers = new Set(),
        urls = new Set(),
        BaseWorker = window.Worker;
      window.__imageResources = { workers, urls };
      window.Worker = class extends BaseWorker {
        constructor(url, options) {
          super(url, options);
          if (String(url).includes("image-decoder.worker")) workers.add(this);
        }
        terminate() {
          workers.delete(this);
          return super.terminate();
        }
      };
      const create = URL.createObjectURL.bind(URL),
        revoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = (b) => {
        const url = create(b);
        urls.add(url);
        return url;
      };
      URL.revokeObjectURL = (url) => {
        urls.delete(url);
        revoke(url);
      };
      if (phase === "blob") {
        const original = HTMLCanvasElement.prototype.toBlob;
        HTMLCanvasElement.prototype.toBlob = function (...args) {
          window.__conversionPending = true;
          setTimeout(() => original.apply(this, args), 500);
        };
      } else {
        const original = HTMLImageElement.prototype.decode;
        HTMLImageElement.prototype.decode = async function () {
          if (this.src.startsWith("blob:")) {
            window.__conversionPending = true;
            await new Promise((r) => setTimeout(r, 500));
          }
          return original.call(this);
        };
      }
    }, phase);
    await open(page);
    await upload(page, "calendar.bmp");
    await expect
      .poll(() => page.evaluate(() => window.__conversionPending))
      .toBe(true);
    await page.getByRole("button", { name: "Cancelar importación" }).click();
    await expect
      .poll(() => page.evaluate(() => window.__imageResources.workers.size))
      .toBe(0);
    await expect
      .poll(() => page.evaluate(() => window.__imageResources.urls.size), {
        timeout: 3000,
      })
      .toBe(0);
    await noMutation(page);
  });
test("HEIC en viewport móvil: revisión y selector sin desbordamiento", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await upload(page, "calendar.heic");
  await analyze(page, 14);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByLabel("Página o fotograma para revisar")
    .count()
    .then((n) => expect(n).toBe(0));
  await page
    .getByText("Archivo HEIC", { exact: false })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-artifacts/import-codecs-movil.png",
    fullPage: true,
  });
  await noMutation(page);
});
