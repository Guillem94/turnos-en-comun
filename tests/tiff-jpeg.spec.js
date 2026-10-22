import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { isolateNetwork } from "./network.js";
for (const compression of [6, 7])
  test(
    "TIFF JPEG " + compression + " real → revisión OCR obligatoria",
    async ({ page }) => {
      await isolateNetwork(page);
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("/");
      await page
        .getByRole("button", { name: "Crear mi calendario local" })
        .click();
      await page
        .getByRole("button", { name: "Importar imagen", exact: true })
        .click();
      await page.getByLabel("Mes y año", { exact: true }).fill("2026-11");
      await page.getByLabel("Confirmo que M/T/N/L").check();
      await page.getByLabel("Elegir imagen del calendario").setInputFiles({
        name: "calendar-jpeg" + compression + ".tiff",
        mimeType: "image/tiff",
        buffer: await readFile(
          new URL(
            "./jpeg-images/calendar-jpeg" + compression + ".tiff",
            import.meta.url,
          ),
        ),
      });
      const button = page.getByRole("button", {
        name: "Analizar en este dispositivo",
      });
      await expect(button).toBeEnabled({ timeout: 35000 });
      await button.click();
      await expect(button).toBeEnabled({ timeout: 150000 });
      await expect(page.locator(".preview-table tbody tr")).toHaveCount(14);
      await expect(
        page.getByLabel("Fecha fila 3", { exact: true }),
      ).toHaveValue("2026-11-03");
      await expect(
        page.getByLabel("Entrada fila 3", { exact: true }),
      ).toHaveValue("22:00");
      expect(
        await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("turnos-en-comun:v1:personal"))
              .entries.length,
        ),
      ).toBe(0);
      expect(errors).toEqual([]);
      expect(page.__externalResponses).toEqual([]);
      expect(
        page.__networkBlocked.filter(
          (r) => !r.host.endsWith("kaspersky-labs.com"),
        ),
      ).toEqual([]);
      await page.getByRole("button", { name: "Cancelar importación" }).click();
    },
  );
