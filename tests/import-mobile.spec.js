import { test, expect } from "@playwright/test";
import { formatFixture } from "./format-fixtures.js";
import { isolateNetwork } from "./network.js";
test("nuevo importador en móvil: región, controles y revisión sin desbordamiento", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await isolateNetwork(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Crear mi calendario local" }).click();
  await page
    .getByRole("button", { name: "Importar imagen", exact: true })
    .click();
  await page.getByLabel("Mes y año", { exact: true }).fill("2026-11");
  await page.getByLabel("Confirmo que M/T/N/L").check();
  const buffer = await formatFixture(page, "weekly");
  await page
    .getByLabel("Elegir imagen del calendario")
    .setInputFiles({ name: "semana.png", mimeType: "image/png", buffer });
  await page
    .getByRole("button", { name: "Analizar en este dispositivo" })
    .click();
  await expect(page.getByLabel("Revisado fila 3", { exact: true })).toBeVisible(
    { timeout: 150000 },
  );
  await page.getByLabel("Ver evidencia fila 1", { exact: true }).click();
  await expect(page.locator(".evidence-preview img")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator("dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page.locator(".evidence-preview").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-artifacts/import-movil.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Cancelar importación" }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("turnos-en-comun:v1:personal")).entries
          .length,
    ),
  ).toBe(0);
});
