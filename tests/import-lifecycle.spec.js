import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";

const fixture = (name) =>
  fileURLToPath(new URL(`./images/${name}`, import.meta.url));
const opener = (page) =>
  page.getByRole("button", { name: "Importar imagen", exact: true });
const input = (page) => page.getByLabel("Elegir imagen del calendario");
const storage = (page) =>
  page.evaluate(() => localStorage.getItem("turnos-en-comun:v1:personal"));

async function open(page) {
  await opener(page).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
async function preview(page, file = "monthly.png") {
  await input(page).setInputFiles(fixture(file));
  await expect(page.locator(".import-image")).toBeVisible({ timeout: 35000 });
  await expect(input(page)).toBeEnabled();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Crear mi calendario local" }).click();
});

for (const width of [390, 1440]) {
  test.describe(`import lifecycle ${width}`, () => {
    test.use({ viewport: { width, height: 844 } });

    test("same PNG selection retains dialog and preview", async ({ page }) => {
      const baseline = await storage(page);
      await open(page);
      await preview(page);
      const source = await page.locator(".import-image").getAttribute("src");
      // A real file-path reselection, not dispatchEvent or an empty file list.
      await input(page).setInputFiles(fixture("monthly.png"));
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.locator(".import-image")).toHaveAttribute(
        "src",
        source,
      );
      expect(await storage(page)).toBe(baseline);
    });

    test("descendant cancel mechanism does not dismiss dialog (synthetic)", async ({
      page,
    }) => {
      await open(page);
      // Tests event ownership only. This does NOT exercise a native file chooser.
      await input(page).dispatchEvent("cancel", { bubbles: true });
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });

    test("close remains on screen after scrolling", async ({ page }) => {
      await open(page);
      await preview(page);
      await page
        .getByRole("button", { name: "Cancelar importación" })
        .scrollIntoViewIfNeeded();
      const close = page.getByRole("button", { name: "Cerrar diálogo" });
      const rect = await close.boundingBox();
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.y + rect.height).toBeLessThanOrEqual(844);
      expect(
        await close.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return el.contains(
            document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
          );
        }),
      ).toBe(true);
      // Coordinates avoid Playwright's automatic scroll-to-control masking this bug.
      await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });

    test("X Escape Cancel restore focus and reopen cleanly", async ({
      page,
    }) => {
      const baseline = await storage(page);
      for (const withPreview of [false, true]) {
        for (const method of ["X", "Escape", "Cancel"]) {
          await open(page);
          await expect(input(page)).toHaveValue("");
          await expect(
            page.locator(".import-image, .preview-table tbody tr"),
          ).toHaveCount(0);
          if (withPreview) await preview(page);
          if (method === "Escape") await page.keyboard.press("Escape");
          else
            await page
              .getByRole("button", {
                name:
                  method === "X" ? "Cerrar diálogo" : "Cancelar importación",
              })
              .click();
          await expect(page.getByRole("dialog")).toHaveCount(0);
          await expect(opener(page)).toBeFocused();
          expect(await storage(page)).toBe(baseline);
        }
      }
    });
  });
}
