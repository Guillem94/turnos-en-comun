import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { rasterCalendar } from "./fixtures.js";
import { isolateNetwork } from "./network.js";
test.beforeEach(async ({ page }) => {
  await isolateNetwork(page);
});
async function begin(page, options = {}) {
  await page.goto("/");
  await page.getByRole("button", { name: "Crear mi calendario local" }).click();
  await page.getByLabel("Ir a fecha", { exact: true }).fill("2026-11-01");
  await page
    .getByRole("button", { name: "Importar imagen", exact: true })
    .click();
  const image = await rasterCalendar(page, options);
  await page.getByLabel("Mes y año", { exact: true }).fill("2026-11");
  if (options.angle)
    await page.getByLabel("Corregir giro").fill(String(-options.angle));
  await page.getByLabel("Confirmo que M/T/N/L").check();
  await page.getByLabel("Elegir imagen del calendario").setInputFiles({
    name: "calendario-sintetico.png",
    mimeType: "image/png",
    buffer: image,
  });
  await page
    .getByRole("button", { name: "Analizar en este dispositivo" })
    .click();
  await expect(
    page.getByRole("button", { name: "Analizar en este dispositivo" }),
  ).toBeEnabled({ timeout: 150000 });
  return image;
}
test("OCR real cuadrícula rasterizada M/T/N/L, revisión, cancelación, duplicados/conflictos y red local", async ({
  page,
}) => {
  const outbound = [],
    errors = [];
  page.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      !r.url().startsWith("http://127.0.0.1:5179")
    )
      outbound.push({ url: r.url(), method: r.method() });
  });
  page.on("pageerror", (e) => errors.push(e.message));
  const img = await begin(page);
  const rows = page.locator(".preview-table tbody tr");
  await expect(rows).toHaveCount(14);
  await expect(page.getByLabel("Entrada fila 1", { exact: true })).toHaveValue(
    "08:00",
  );
  await expect(page.getByLabel("Salida fila 3", { exact: true })).toHaveValue(
    "06:00",
  );
  await expect(page.getByLabel("Tipo fila 4", { exact: true })).toHaveValue(
    "off",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("turnos-en-comun:v1:personal")).entries
          .length,
    ),
  ).toBe(0);
  await page.screenshot({
    path: "test-artifacts/ocr-revision.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Cancelar importación" }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("turnos-en-comun:v1:personal")).entries
          .length,
    ),
  ).toBe(0);
  await page
    .getByRole("button", { name: "Importar imagen", exact: true })
    .click();
  await page.getByLabel("Mes y año", { exact: true }).fill("2026-11");
  await page.getByLabel("Confirmo que M/T/N/L").check();
  await page.getByLabel("Elegir imagen del calendario").setInputFiles({
    name: "calendar.png",
    mimeType: "image/png",
    buffer: img,
  });
  await page
    .getByRole("button", { name: "Analizar en este dispositivo" })
    .click();
  await expect(
    page.getByLabel("Revisado fila 14", { exact: true }),
  ).toBeVisible({ timeout: 150000 });
  await page.getByLabel("Revisado fila 1", { exact: true }).check();
  await page.getByLabel("Confirmo persona, mes").check();
  await page
    .getByRole("button", { name: "Insertar filas revisadas (1)", exact: true })
    .click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("turnos-en-comun:v1:personal")).entries
          .length,
    ),
  ).toBe(1);
  await page
    .getByRole("button", { name: "Importar imagen", exact: true })
    .click();
  await page.getByLabel("Mes y año", { exact: true }).fill("2026-11");
  await page.getByLabel("Entrada M", { exact: true }).fill("09:00");
  await page.getByLabel("Confirmo que M/T/N/L").check();
  await page.getByLabel("Elegir imagen del calendario").setInputFiles({
    name: "calendar.png",
    mimeType: "image/png",
    buffer: img,
  });
  await page
    .getByRole("button", { name: "Analizar en este dispositivo" })
    .click();
  await expect(
    page.getByLabel("Revisado fila 14", { exact: true }),
  ).toBeVisible({ timeout: 150000 });
  await expect(rows.first()).toContainText("solape");
  await expect(
    page.getByLabel("Revisado fila 1", { exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Entrada fila 1", { exact: true }).fill("08:00");
  await expect(rows.first()).toContainText("duplicado");
  await page.getByRole("button", { name: "Cancelar importación" }).click();
  expect(
    outbound.filter(
      (r) => !new URL(r.url).hostname.endsWith(".kaspersky-labs.com"),
    ),
  ).toEqual([]);
  expect(errors).toEqual([]);
  expect(page.__externalResponses).toEqual([]);
  await test.info().attach("red-ocr-local", {
    body: Buffer.from(
      JSON.stringify({
        externalResponses: page.__externalResponses,
        blockedHosts: [...new Set(page.__networkBlocked.map((r) => r.host))],
        source:
          "Aislamiento solo en contexto Playwright; antivirus del equipo sin cambios",
      }),
    ),
    contentType: "application/json",
  });
  await writeFile(
    "test-artifacts/red-ocr.json",
    JSON.stringify(
      {
        externalResponses: page.__externalResponses,
        blockedHosts: [...new Set(page.__networkBlocked.map((r) => r.host))],
        result:
          "OCR completado con recursos locales y sin respuestas externas. La inyección ambiental del antivirus se separa del código de la app; no se alteró su configuración.",
      },
      null,
      2,
    ),
  );
});
test("OCR real horarios explícitos", async ({ page }) => {
  await begin(page, { mode: "times" });
  await expect(page.locator(".preview-table tbody tr")).toHaveCount(14);
  await expect(page.getByLabel("Entrada fila 1", { exact: true })).toHaveValue(
    "08:00",
  );
  await expect(page.getByLabel("Salida fila 2", { exact: true })).toHaveValue(
    "06:00",
  );
});
test("OCR real giro corregido y encabezado recortado", async ({ page }) => {
  await begin(page, { angle: 4, cropped: true });
  await expect(page.locator(".preview-table tbody tr")).toHaveCount(14);
  await expect(page.getByLabel("Fecha fila 1", { exact: true })).toHaveValue(
    "2026-11-01",
  );
  await expect(page.getByLabel("Entrada fila 1", { exact: true })).toHaveValue(
    "08:00",
  );
});
test("OCR real borroso/código desconocido queda pendiente y sin mutación", async ({
  page,
}) => {
  await begin(page, { blur: 2, unknown: true });
  await expect(page.locator(".preview-table tbody tr")).not.toHaveCount(0);
  await expect(page.locator(".preview-table tbody tr").first()).toContainText(
    "desconocido",
  );
  await expect(
    page.getByLabel("Revisado fila 1", { exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByLabel("Revisado fila 1", { exact: true }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("button", { name: /Insertar filas revisadas/ }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("turnos-en-comun:v1:personal")).entries
          .length,
    ),
  ).toBe(0);
  await page.getByRole("button", { name: "Cancelar importación" }).click();
});
