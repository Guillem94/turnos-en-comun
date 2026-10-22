import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { transposedFixture } from "./transposed-fixtures.js";
import { isolateNetwork } from "./network.js";
async function begin(page, kind = "uncertain") {
  await isolateNetwork(page);
  page.__appErrors = [];
  page.on("pageerror", (e) => page.__appErrors.push(e.message));
  await page.goto("/");
  await expect(page).toHaveTitle("Turnos en Común");
  await page.getByRole("button", { name: "Crear mi calendario local" }).click();
  await page
    .getByRole("button", { name: "Importar imagen", exact: true })
    .click();
  await page.getByLabel("Mes y año", { exact: true }).fill("2026-12");
  await page.getByLabel("Confirmo que M/T/N/L").check();
  const buffer = await transposedFixture(page, kind);
  await page.getByLabel("Elegir imagen del calendario").setInputFiles({
    name: `mobile-${kind}.png`,
    mimeType: "image/png",
    buffer,
  });
  const button = page.getByRole("button", {
    name: "Analizar en este dispositivo",
  });
  await expect(button).toBeEnabled({ timeout: 35000 });
  await button.click();
  await expect(button).toBeEnabled({ timeout: 150000 });
  await page.getByLabel("Columna de origen confirmada").selectOption("Ana");
  await expect(page.locator(".preview-table tbody tr")).toHaveCount(3);
}
async function geometry(page) {
  const result = await page.locator(".preview-table-wrap").evaluate((el) => ({
    client: el.clientWidth,
    scroll: el.scrollWidth,
    controls: [...el.querySelectorAll("input,select,button")].map((x) => {
      const r = x.getBoundingClientRect();
      return { left: r.left, right: r.right, width: r.width };
    }),
    viewport: innerWidth,
  }));
  expect(result.scroll).toBeLessThanOrEqual(result.client + 1);
  for (const r of result.controls) {
    expect(r.width).toBeGreaterThan(0);
    expect(r.left).toBeGreaterThanOrEqual(0);
    expect(r.right).toBeLessThanOrEqual(result.viewport + 1);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function healthy(page) {
  expect(page.__appErrors).toEqual([]);
  expect(page.__externalResponses).toEqual([]);
  expect(
    page.__networkBlocked.filter((r) => !r.host.endsWith("kaspersky-labs.com")),
  ).toEqual([]);
}
for (const width of [360, 390])
  test(`revisión móvil ${width}px: todos los campos visibles, corregir incertidumbre y guardar`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await begin(page);
    await geometry(page);
    const rows = page.locator(".preview-table tbody tr");
    await expect(rows.nth(2).locator(".review-field-label")).toHaveText([
      "Fecha",
      "Tipo",
      "Entrada",
      "Salida",
    ]);
    for (const label of await rows.nth(2).locator(".review-field-label").all())
      await expect(label).toBeVisible();
    await expect(page.getByLabel("Fecha fila 2", { exact: true })).toHaveValue(
      "",
    );
    await expect(
      page.getByLabel("Revisado fila 2", { exact: true }),
    ).toBeDisabled();
    await expect(page.getByLabel("Tipo fila 3", { exact: true })).toHaveValue(
      "",
    );
    await expect(rows.nth(2)).toContainText("desconocido");
    await rows.nth(2).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `test-artifacts/revision-movil-${width}-pendiente.png`,
    });
    await page.getByLabel("Fecha fila 2", { exact: true }).fill("2026-12-31");
    await page.getByLabel("Revisado fila 2", { exact: true }).check();
    await page.getByLabel("Entrada fila 2", { exact: true }).fill("21:30");
    await expect(
      page.getByLabel("Revisado fila 2", { exact: true }),
    ).not.toBeChecked();
    await page.getByLabel("Entrada fila 2", { exact: true }).fill("22:00");
    await page.getByLabel("Fecha fila 3", { exact: true }).fill("2027-01-01");
    await page.getByLabel("Tipo fila 3", { exact: true }).selectOption("shift");
    await page.getByLabel("Entrada fila 3", { exact: true }).fill("08:00");
    await page.getByLabel("Salida fila 3", { exact: true }).fill("16:00");
    for (let i = 1; i <= 3; i++)
      await page.getByLabel(`Revisado fila ${i}`, { exact: true }).check();
    await geometry(page);
    await rows.nth(2).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `test-artifacts/revision-movil-${width}-corregida.png`,
    });
    const axe = await new AxeBuilder({ page })
      .include("dialog[open]")
      .analyze();
    expect(
      axe.violations.filter((v) => ["serious", "critical"].includes(v.impact)),
    ).toEqual([]);
    await page.getByLabel("Confirmo persona, mes").check();
    await page
      .getByRole("button", {
        name: "Insertar filas revisadas (3)",
        exact: true,
      })
      .click();
    const state = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("turnos-en-comun:v1:personal")),
    );
    expect(state.entries.map((e) => [e.date, e.kind, e.start, e.end])).toEqual([
      ["2026-12-30", "shift", "08:00", "16:00"],
      ["2026-12-31", "shift", "22:00", "06:00"],
      ["2027-01-01", "shift", "08:00", "16:00"],
    ]);
    expect(state.coverage).toHaveLength(0);
    expect(
      state.entries.every(
        (e) => e.profileId === "p1" && !("raw" in e) && !("evidence" in e),
      ),
    ).toBe(true);
    await page.reload();
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("turnos-en-comun:v1:personal"))
            .entries.length,
      ),
    ).toBe(3);
    await healthy(page);
  });
test("tarjetas móviles: quitar candidato y añadir libre manual conservan validación", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await begin(page, "codes");
  await page.getByLabel("Quitar fila 2", { exact: true }).click();
  await expect(page.locator(".preview-table tbody tr")).toHaveCount(2);
  await page.getByRole("button", { name: "Añadir fila manual" }).click();
  await page.getByLabel("Fecha fila 3", { exact: true }).fill("2026-12-29");
  await page.getByLabel("Tipo fila 3", { exact: true }).selectOption("off");
  await expect(
    page.getByLabel("Entrada fila 3", { exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByLabel("Salida fila 3", { exact: true }),
  ).toBeDisabled();
  await geometry(page);
  for (let i = 1; i <= 3; i++)
    await page.getByLabel(`Revisado fila ${i}`, { exact: true }).check();
  await page.getByLabel("Confirmo persona, mes").check();
  await page
    .getByRole("button", { name: "Insertar filas revisadas (3)", exact: true })
    .click();
  const entries = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("turnos-en-comun:v1:personal")).entries,
  );
  expect(entries).toHaveLength(3);
  expect(entries.some((e) => e.date === "2026-12-31")).toBe(false);
  expect(entries.find((e) => e.kind === "off")).toMatchObject({
    date: "2026-12-29",
    start: "",
    end: "",
  });
  await healthy(page);
});
test("escritorio conserva una tabla y un solo control por campo", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await begin(page, "codes");
  const table = page.locator(".preview-table");
  await expect(table).toHaveCount(1);
  await expect(table.locator("thead th")).toHaveCount(7);
  expect(
    await table
      .locator("tbody tr")
      .first()
      .evaluate((el) => getComputedStyle(el).display),
  ).toBe("table-row");
  await expect(page.getByLabel("Fecha fila 1", { exact: true })).toHaveCount(1);
  const review = page.getByLabel("Revisado fila 1", { exact: true });
  await review.focus();
  await page.keyboard.press("Space");
  await expect(review).toBeChecked();
  const evidence = page.getByLabel("Ver evidencia fila 1", { exact: true });
  await evidence.focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Quitar fila 1", { exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(evidence).toBeFocused();
  await page.getByLabel("Ver evidencia fila 2", { exact: true }).click();
  await expect(page.locator(".evidence-preview img")).toBeVisible();
  await table.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-artifacts/revision-escritorio.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await geometry(page);
  await expect(review).toBeChecked();
  await expect(page.getByLabel("Fecha fila 1", { exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Cancelar importación" }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("turnos-en-comun:v1:personal")).entries
          .length,
    ),
  ).toBe(0);
  await healthy(page);
});
