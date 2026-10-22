import { test, expect } from "@playwright/test";
import { isolateNetwork } from "./network.js";
import { rasterCalendar } from "./fixtures.js";
test.beforeEach(async ({ page }) => {
  await isolateNetwork(page);
});
test("noche en UI, cambio de año y día libre; sin datos y deshacer", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Crear mi calendario local" }).click();
  await page.getByLabel("Ir a fecha", { exact: true }).fill("2026-12-31");
  await page.getByRole("button", { name: "+ Añadir turno" }).click();
  await page.getByLabel("Entrada", { exact: true }).fill("22:00");
  await page.getByLabel("Salida", { exact: true }).fill("06:00");
  await page.getByRole("button", { name: "Guardar registro" }).click();
  await page.getByLabel("Ir a fecha", { exact: true }).fill("2027-01-01");
  await expect(page.locator(".person-day").first()).toContainText(
    "empezó el 2026-12-31",
  );
  await expect(page.locator(".availability")).toContainText("Falta confirmar");
  await page.getByRole("button", { name: "+ Añadir turno" }).click();
  await page.getByLabel("Persona", { exact: true }).selectOption("p2");
  await page.getByLabel("Tipo", { exact: true }).selectOption("off");
  await page.getByRole("button", { name: "Guardar registro" }).click();
  await page.locator(".person-day").first().getByRole("checkbox").check();
  await expect(page.locator(".availability")).toContainText("Libre para ambos");
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect(page.locator(".availability")).toContainText("Falta confirmar");
});
test("JSON huérfano, cancelación y restauración íntegra conservan estado", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Crear mi calendario local" }).click();
  await page
    .getByRole("button", { name: "Datos y ajustes", exact: true })
    .click();
  const before = await page.evaluate(() =>
    localStorage.getItem("turnos-en-comun:v1:personal"),
  );
  const valid = JSON.parse(before);
  valid.profiles[0].name = "Nombre restaurado";
  const bad = structuredClone(valid);
  bad.coverage = [{ profileId: "no-existe", date: "2026-11-13" }];
  const upload = async (v) =>
    page.getByLabel("Restaurar copia JSON").setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(v)),
    });
  await upload(bad);
  await expect(page.getByRole("status")).toContainText("huérfana");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("turnos-en-comun:v1:personal"),
    ),
  ).toBe(before);
  await upload(valid);
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("turnos-en-comun:v1:personal"),
    ),
  ).toBe(before);
  await upload(valid);
  await page.getByRole("button", { name: "Confirmar restauración" }).click();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("turnos-en-comun:v1:personal")),
    ),
  ).toEqual(valid);
  await expect(
    page.getByLabel("Nombre de la persona 1", { exact: true }),
  ).toHaveValue("Nombre restaurado");
});
test("cancelar OCR durante trabajo no inserta ni reaparece; imagen no persistida", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Crear mi calendario local" }).click();
  const before = await page.evaluate(() =>
    localStorage.getItem("turnos-en-comun:v1:personal"),
  );
  await page
    .getByRole("button", { name: "Importar imagen", exact: true })
    .click();
  await page.getByLabel("Confirmo que M/T/N/L").check();
  const img = await rasterCalendar(page);
  await page
    .getByLabel("Elegir imagen del calendario")
    .setInputFiles({ name: "cancel.png", mimeType: "image/png", buffer: img });
  await page
    .getByRole("button", { name: "Analizar en este dispositivo" })
    .click();
  await page.getByRole("button", { name: "Cancelar importación" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Importar imagen", exact: true })
    .click();
  await expect(page.locator(".preview-table")).toHaveCount(0);
  await expect(page.locator(".import-image")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("turnos-en-comun:v1:personal"),
    ),
  ).toBe(before);
  await page.getByRole("button", { name: "Cancelar importación" }).click();
});
