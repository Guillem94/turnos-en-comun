import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { transposedFixture } from "./transposed-fixtures.js";
import { isolateNetwork } from "./network.js";
async function begin(page, kind = "codes", destination = "p1") {
  await isolateNetwork(page);
  page.__appErrors = [];
  page.on("pageerror", (e) => page.__appErrors.push(e.message));
  await page.goto("/");
  await expect(page).toHaveTitle("Turnos en Común");
  await page.getByRole("button", { name: "Crear mi calendario local" }).click();
  await importImage(page, kind, destination);
}
async function importImage(page, kind = "codes", destination = "p1") {
  await page
    .getByRole("button", { name: "Importar imagen", exact: true })
    .click();
  await page.getByLabel("Persona", { exact: true }).selectOption(destination);
  await page.getByLabel("Mes y año", { exact: true }).fill("2026-12");
  await page.getByLabel("Confirmo que M/T/N/L").check();
  const buffer = await transposedFixture(page, kind);
  await writeFile(`test-artifacts/fixture-transposed-${kind}.png`, buffer);
  await page.getByLabel("Elegir imagen del calendario").setInputFiles({
    name: `table-${kind}.png`,
    mimeType: "image/png",
    buffer,
  });
  const analyze = page.getByRole("button", {
    name: "Analizar en este dispositivo",
  });
  await expect(analyze).toBeEnabled({ timeout: 35000 });
  await analyze.click();
  await expect(analyze).toBeEnabled({ timeout: 150000 });
}
async function safe(page) {
  expect(page.__appErrors).toEqual([]);
  expect(page.__externalResponses).toEqual([]);
  expect(
    page.__networkBlocked.filter((r) => !r.host.endsWith("kaspersky-labs.com")),
  ).toEqual([]);
}
async function saved(page) {
  return page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("turnos-en-comun:v1:personal")).entries,
  );
}
test("tabla transpuesta real: columna explícita, evidencia y destino distinto, cambio de año", async ({
  page,
}) => {
  await begin(page, "codes", "p2");
  const rows = page.locator(".preview-table tbody tr");
  await expect(rows).toHaveCount(6);
  await expect(
    page.getByLabel("Revisado fila 1", { exact: true }),
  ).toBeDisabled();
  const source = page.getByLabel("Columna de origen confirmada");
  await expect(source).toHaveValue("");
  await source.selectOption("Ana");
  await expect(rows).toHaveCount(3);
  for (const [i, date, start, end] of [
    [1, "2026-12-30", "08:00", "16:00"],
    [2, "2026-12-31", "22:00", "06:00"],
    [3, "2027-01-01", "08:00", "16:00"],
  ]) {
    await expect(
      page.getByLabel(`Fecha fila ${i}`, { exact: true }),
    ).toHaveValue(date);
    await expect(
      page.getByLabel(`Entrada fila ${i}`, { exact: true }),
    ).toHaveValue(start);
    await expect(
      page.getByLabel(`Salida fila ${i}`, { exact: true }),
    ).toHaveValue(end);
  }
  await page.getByLabel("Ver evidencia fila 2", { exact: true }).click();
  await expect(page.locator(".evidence-preview img")).toBeVisible();
  await expect(page.locator(".evidence-preview")).toContainText("persona");
  for (let i = 1; i <= 3; i++)
    await page.getByLabel(`Revisado fila ${i}`, { exact: true }).check();
  await page.getByLabel("Confirmo persona, mes").check();
  await page.screenshot({
    path: "test-artifacts/import-transposed.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Insertar filas revisadas (3)", exact: true })
    .click();
  const entries = await saved(page);
  expect(entries).toHaveLength(3);
  expect(entries.every((e) => e.profileId === "p2")).toBe(true);
  expect(entries.map((e) => e.date)).toEqual([
    "2026-12-30",
    "2026-12-31",
    "2027-01-01",
  ]);
  expect(entries[1].end).toBe("06:00");
  expect(
    entries.every(
      (e) => !("evidence" in e) && !("sourcePerson" in e) && !("raw" in e),
    ),
  ).toBe(true);
  await importImage(page, "codes", "p2");
  await page.getByLabel("Columna de origen confirmada").selectOption("Ana");
  for (let i = 1; i <= 3; i++) {
    await expect(
      page.locator(".preview-table tbody tr").nth(i - 1),
    ).toContainText("duplicado");
    await expect(
      page.getByLabel(`Revisado fila ${i}`, { exact: true }),
    ).toBeDisabled();
  }
  await page.getByLabel("Columna de origen confirmada").selectOption("Luis");
  for (let i = 1; i <= 3; i++) {
    await expect(
      page.locator(".preview-table tbody tr").nth(i - 1),
    ).toContainText(/solape|conflicto/);
    await expect(
      page.getByLabel(`Revisado fila ${i}`, { exact: true }),
    ).toBeDisabled();
  }
  await expect(
    page.getByRole("button", { name: /Insertar filas revisadas/ }),
  ).toBeDisabled();
  expect(await saved(page)).toHaveLength(3);
  await page.getByRole("button", { name: "Cancelar importación" }).click();
  await safe(page);
});
test("cambiar columna borra aprobaciones, confirmación y evidencia; cancelar no guarda", async ({
  page,
}) => {
  await begin(page);
  const source = page.getByLabel("Columna de origen confirmada");
  await source.selectOption("Ana");
  await page.getByLabel("Revisado fila 1", { exact: true }).check();
  await page.getByLabel("Ver evidencia fila 1", { exact: true }).click();
  await page.getByLabel("Confirmo persona, mes").check();
  await source.selectOption("Luis");
  await expect(
    page.getByLabel("Revisado fila 1", { exact: true }),
  ).not.toBeChecked();
  await expect(page.getByLabel("Confirmo persona, mes")).not.toBeChecked();
  await expect(page.locator(".evidence-preview")).toHaveCount(0);
  await expect(page.getByLabel("Entrada fila 1", { exact: true })).toHaveValue(
    "14:00",
  );
  await expect(page.getByLabel("Tipo fila 2", { exact: true })).toHaveValue(
    "off",
  );
  await page.getByRole("button", { name: "Cancelar importación" }).click();
  expect(await saved(page)).toHaveLength(0);
  await safe(page);
});
for (const kind of [
  "partial",
  "uncertain",
  "headerless",
  "duplicate-names",
  "malicious",
])
  test(`tabla transpuesta rasterizada: ${kind}`, async ({ page }) => {
    await begin(page, kind);
    const rows = page.locator(".preview-table tbody tr");
    if (kind === "headerless") {
      await expect(page.getByLabel("Columna de origen confirmada")).toHaveCount(
        0,
      );
      await expect(
        page.getByRole("button", { name: /Insertar filas revisadas/ }),
      ).toBeDisabled();
    } else {
      const source = page.getByLabel("Columna de origen confirmada");
      await expect(source).toHaveValue("");
      if (kind === "duplicate-names") {
        const names = await source.locator("option").allTextContents();
        expect(names).toHaveLength(3);
        expect(names[1]).not.toBe(names[2]);
        await source.selectOption({ index: 2 });
        await expect(
          page.getByLabel("Entrada fila 1", { exact: true }),
        ).toHaveValue("14:00");
      } else {
        await source.selectOption("Ana");
        await expect(rows).toHaveCount(3);
        if (kind === "partial") {
          for (let i = 1; i <= 3; i++)
            await expect(
              page.getByLabel(`Fecha fila ${i}`, { exact: true }),
            ).toHaveValue(`2026-12-${28 + i}`);
          await expect(rows.first()).toContainText("contexto");
        } else if (kind === "uncertain") {
          await expect(
            page.getByLabel("Fecha fila 2", { exact: true }),
          ).toHaveValue("");
          await expect(
            page.getByLabel("Fecha fila 3", { exact: true }),
          ).toHaveValue("");
          await expect(
            page.getByLabel("Tipo fila 3", { exact: true }),
          ).toHaveValue("");
          await expect(
            page.getByLabel("Revisado fila 2", { exact: true }),
          ).toBeDisabled();
        } else await expect(page.locator(".warning")).toContainText("ignorado");
      }
    }
    expect(await saved(page)).toHaveLength(0);
    await safe(page);
  });
test("tabla transpuesta en móvil: selección, evidencia y revisión accesibles", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await begin(page);
  await page.getByLabel("Columna de origen confirmada").selectOption("Luis");
  await page.getByLabel("Ver evidencia fila 1", { exact: true }).click();
  await expect(page.locator(".evidence-preview img")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const axe = await new AxeBuilder({ page }).include("dialog[open]").analyze();
  expect(
    axe.violations.filter((v) => ["critical", "serious"].includes(v.impact)),
  ).toEqual([]);
  await page
    .getByLabel("Columna de origen confirmada")
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-artifacts/import-transposed-movil.png" });
  await safe(page);
});
