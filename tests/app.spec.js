import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { isolateNetwork } from "./network.js";
test.beforeEach(async ({ page }) => {
  await isolateNetwork(page);
});
test("onboarding, CRUD, noches, confirmaciones, papelera, perfiles, JSON/ICS y demo separada", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page).toHaveTitle("Turnos en Común");
  await expect(page.getByRole("dialog")).toContainText(
    "Vuestro tiempo empieza aquí",
  );
  await page.getByRole("button", { name: "Crear mi calendario local" }).click();
  await page.getByLabel("Ir a fecha", { exact: true }).fill("2026-11-13");
  await page.getByRole("button", { name: "+ Añadir turno" }).click();
  await page.getByLabel("Entrada", { exact: true }).fill("08:00");
  await page.getByLabel("Salida", { exact: true }).fill("16:00");
  await page.getByLabel("He registrado todos los turnos").check();
  await page.getByRole("button", { name: "Guardar registro" }).click();
  await page.getByRole("button", { name: "+ Añadir turno" }).click();
  await page.getByLabel("Persona", { exact: true }).selectOption("p2");
  await page.getByLabel("Entrada", { exact: true }).fill("14:00");
  await page.getByLabel("Salida", { exact: true }).fill("22:00");
  await page.getByLabel("He registrado todos los turnos").check();
  await page.getByRole("button", { name: "Guardar registro" }).click();
  await expect(page.locator(".availability")).toContainText("07:00");
  await expect(page.locator(".availability")).toContainText("08:00");
  await expect(page.locator(".availability")).toContainText("22:00");
  await page.reload();
  await page.getByLabel("Ir a fecha", { exact: true }).fill("2026-11-13");
  await expect(page.locator(".availability")).toContainText("Libre para ambos");
  await page.getByRole("button", { name: "Semana", exact: true }).click();
  await expect(page.locator(".calendar-grid .day")).toHaveCount(7);
  await page.getByRole("button", { name: "Mes", exact: true }).click();
  await expect(page.locator(".calendar-grid .day")).toHaveCount(42);
  await page.locator(".person-day").first().getByRole("button").first().click();
  await page.getByLabel("Nombre del registro").fill("Mañana editada");
  await page.getByRole("button", { name: "Guardar registro" }).click();
  await expect(page.locator(".person-day").first()).toContainText(
    "Mañana editada",
  );
  await page.locator(".person-day").first().getByRole("button").first().click();
  await page.getByRole("button", { name: "Mover a papelera" }).click();
  await expect(page.locator(".person-day").first()).toContainText(
    "No hay registros",
  );
  await page
    .getByRole("button", { name: "Datos y ajustes", exact: true })
    .click();
  await page.getByRole("button", { name: "Recuperar", exact: true }).click();
  await expect(page.locator(".trash-row")).toHaveCount(0);
  await page.getByLabel("Nombre de la persona 1", { exact: true }).fill("Aina");
  await page.getByRole("button", { name: "Guardar preferencias" }).click();
  await expect(page.locator(".people-list")).toContainText("Aina");
  const backup = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar copia JSON" }).click();
  const file = await backup;
  const stream = await file.createReadStream();
  let contents = "";
  for await (const c of stream) contents += c;
  const json = JSON.parse(contents);
  expect(json.entries).toHaveLength(2);
  const icsDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar .ics" }).click();
  const ics = await icsDownload;
  const istream = await ics.createReadStream();
  let text = "";
  for await (const c of istream) text += c;
  expect(text).toContain("BEGIN:VCALENDAR");
  expect(text).toContain("DTSTART:20261113T070000Z");
  await page.getByLabel("Restaurar copia JSON").setInputFiles({
    name: "corrupt.json",
    mimeType: "application/json",
    buffer: Buffer.from("{"),
  });
  await expect(page.getByRole("status")).toContainText("JSON");
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("turnos-en-comun:v1:personal")).entries
          .length,
    ),
  ).toBe(2);
  await page.getByLabel("Restaurar copia JSON").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(contents),
  });
  await expect(page.getByRole("dialog")).toContainText("Copia válida");
  await page.getByRole("button", { name: "Confirmar restauración" }).click();
  await page.getByRole("button", { name: "Explorar demo ficticia" }).click();
  await expect(page.locator(".demo-banner")).toContainText("ficticias");
  await page.getByRole("button", { name: "Salir de la demo" }).click();
  await expect(page.locator(".people-list")).toContainText("Aina");
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("turnos-en-comun:v1:personal")).entries
          .length,
    ),
  ).toBe(2);
  expect(errors).toEqual([]);
});
test("desktop/móvil, identidad, consola, controles, accesibilidad y capturas", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "Probar demo con datos ficticios" })
    .click();
  await page.getByLabel("Ir a fecha", { exact: true }).fill("2026-10-21");
  await expect(page.locator("h1")).toContainText("Haced sitio");
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  await page.locator("h1").click();
  await page.screenshot({
    path: "test-artifacts/escritorio.png",
    fullPage: true,
    animations: "disabled",
  });
  let a11y = await new AxeBuilder({ page }).analyze();
  expect(
    a11y.violations
      .filter((v) => ["critical", "serious"].includes(v.impact))
      .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("h1").click();
  await page.screenshot({
    path: "test-artifacts/movil.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "+ Añadir turno" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(errors).toEqual([]);
});
