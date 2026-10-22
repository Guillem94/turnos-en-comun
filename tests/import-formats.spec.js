import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { formatFixture } from "./format-fixtures.js";
import { isolateNetwork } from "./network.js";
const kinds = [
  "monthly",
  "borderless",
  "borderless-calendar",
  "weekly",
  "list",
  "people",
  "ambiguous",
  "not-calendar",
  "malicious",
];
for (const kind of kinds)
  test(`OCR 0.2 rasterizado: ${kind}`, async ({ page }) => {
    await isolateNetwork(page);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await page
      .getByRole("button", { name: "Crear mi calendario local" })
      .click();
    await page.getByLabel("Ir a fecha", { exact: true }).fill("2026-11-01");
    await page
      .getByRole("button", { name: "Importar imagen", exact: true })
      .click();
    await page.getByLabel("Confirmo que M/T/N/L").check();
    const buffer = await formatFixture(page, kind);
    await writeFile(`test-artifacts/fixture-${kind}.png`, buffer);
    await page
      .getByLabel("Elegir imagen del calendario")
      .setInputFiles({ name: `${kind}.png`, mimeType: "image/png", buffer });
    await page
      .getByRole("button", { name: "Analizar en este dispositivo" })
      .click();
    await expect(
      page.getByRole("button", { name: "Analizar en este dispositivo" }),
    ).toBeEnabled({ timeout: 150000 });
    const rows = page.locator(".preview-table tbody tr");
    const count = await rows.count();
    const values = await rows.evaluateAll((rs) =>
      rs.map((r) => ({
        date: r.querySelector("input[type=date]").value,
        kind: r.querySelector("select").value,
        start: r.querySelectorAll("input[type=time]")[0].value,
        end: r.querySelectorAll("input[type=time]")[1].value,
        text: r.innerText,
      })),
    );
    await writeFile(
      `test-artifacts/matrix-${kind}.json`,
      JSON.stringify(
        {
          kind,
          count,
          values,
          blockedHosts: [...new Set(page.__networkBlocked.map((r) => r.host))],
        },
        null,
        2,
      ),
    );
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("turnos-en-comun:v1:personal"))
            .entries.length,
      ),
    ).toBe(0);
    if (["monthly", "borderless", "borderless-calendar"].includes(kind)) {
      expect(count).toBe(14);
      for (let i = 0; i < 14; i++) {
        expect(values[i].date).toBe(
          `2026-11-${String(i + 1).padStart(2, "0")}`,
        );
        expect(values[i].kind).toBe(i % 4 === 3 ? "off" : "shift");
      }
      await page.getByLabel("Ver evidencia fila 1", { exact: true }).click();
      await expect(page.locator(".evidence-preview img")).toBeVisible();
    } else if (["weekly", "list"].includes(kind)) {
      expect(count).toBe(3);
      expect(values.map((r) => r.date)).toEqual([
        "2026-11-12",
        "2026-11-13",
        "2026-11-14",
      ]);
      expect(values[0].start).toBe("08:00");
      expect(values[1].end).toBe("06:00");
      expect(values[2].kind).toBe("off");
    } else if (kind === "people") {
      expect(count).toBe(6);
      await expect(
        page.getByLabel("Revisado fila 1", { exact: true }),
      ).toBeDisabled();
      await page.getByLabel("Fila de origen confirmada").selectOption("Luis");
      await expect(rows).toHaveCount(3);
      await expect(
        page.getByLabel("Entrada fila 1", { exact: true }),
      ).toHaveValue("14:00");
      for (let i = 1; i <= 3; i++)
        await page.getByLabel(`Revisado fila ${i}`, { exact: true }).check();
      await page.getByLabel("Ver evidencia fila 1", { exact: true }).click();
      await page.screenshot({
        path: "test-artifacts/import-people.png",
        fullPage: true,
        animations: "disabled",
      });
      await page.getByLabel("Confirmo persona, mes").check();
      await page
        .getByRole("button", {
          name: "Insertar filas revisadas (3)",
          exact: true,
        })
        .click();
      const saved = await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("turnos-en-comun:v1:personal"))
            .entries,
      );
      expect(saved).toHaveLength(3);
      expect(saved.every((e) => e.profileId === "p1")).toBe(true);
      expect(saved[0].start).toBe("14:00");
    } else if (kind === "ambiguous") {
      expect(count).toBeGreaterThanOrEqual(2);
      expect(values.some((r) => r.kind === "")).toBe(true);
      await expect(
        page.getByRole("button", { name: /Insertar filas revisadas/ }),
      ).toBeDisabled();
    } else if (kind === "not-calendar") {
      expect(count).toBe(0);
      await expect(page.locator(".warning")).toContainText(
        "No se ha detectado",
      );
    } else {
      expect(count).toBe(1);
      expect(values[0].date).toBe("2026-11-12");
      expect(values[0].start).toBe("08:00");
      await expect(page.locator(".warning")).toContainText("ignorado");
      expect(page.__networkBlocked.some((r) => r.host === "evil.invalid")).toBe(
        false,
      );
    }
    if (kind !== "people")
      await page.screenshot({
        path: `test-artifacts/import-${kind}.png`,
        fullPage: true,
        animations: "disabled",
      });
    expect(errors).toEqual([]);
    expect(page.__externalResponses).toEqual([]);
  });
