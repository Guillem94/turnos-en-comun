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
  await page.addInitScript(() => {
    const BaseWorker = window.Worker;
    window.__lifecycle = {
      opened: 0,
      terminated: 0,
      recognitionCancelled: null,
    };
    window.Worker = class extends BaseWorker {
      constructor(...args) {
        super(...args);
        window.__lifecycle.opened++;
        this.addEventListener("message", ({ data }) => {
          // Observe real Tesseract progress; never replace/delay worker messages.
          if (
            window.__cancelAtRecognition &&
            data?.status === "progress" &&
            data?.data?.status === "recognizing text"
          ) {
            window.__cancelAtRecognition = false;
            const cancel = [...document.querySelectorAll("dialog button")].find(
              (el) => el.textContent === "Cancelar importación",
            );
            if (cancel) {
              window.__lifecycle.recognitionCancelled = {
                status: data.data.status,
                progress: data.data.progress,
              };
              cancel.click();
            }
          }
        });
      }
      terminate() {
        window.__lifecycle.terminated++;
        return super.terminate();
      }
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Crear mi calendario local" }).click();
});

for (const width of [390, 1440]) {
  test.describe(`real import flows ${width}`, () => {
    test.use({ viewport: { width, height: 844 } });
    test("PNG JPEG HEIC switching and real OCR after repeated clicks", async ({
      page,
    }) => {
      const baseline = await storage(page);
      await open(page);
      await page.getByLabel("Mes y año", { exact: true }).fill("2026-11");
      await page.getByLabel("Confirmo que M/T/N/L").check();
      await preview(page);
      // Genuine JPEG derived from the fictional PNG, without response mocks.
      const jpeg = await page.locator(".import-image").evaluate((img) => {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext("2d").drawImage(img, 0, 0);
        return c.toDataURL("image/jpeg", 0.95).split(",")[1];
      });
      await input(page).setInputFiles({
        name: "fictional.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from(jpeg, "base64"),
      });
      await expect(
        page.getByText("Archivo JPEG", { exact: false }),
      ).toBeVisible();
      await expect(page.locator(".import-image")).toBeVisible();
      await preview(page, "calendar.heic");
      const analyze = page.getByRole("button", {
        name: "Analizar en este dispositivo",
      });
      await expect(analyze).toBeEnabled();
      await analyze.scrollIntoViewIfNeeded();
      const r = await analyze.boundingBox();
      await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2, {
        clickCount: 2,
      });
      await expect(input(page)).toBeDisabled();
      await expect(analyze).toBeEnabled({ timeout: 150000 });
      await expect(page.locator(".preview-table tbody tr")).toHaveCount(14);
      await page.getByRole("button", { name: "Cancelar importación" }).click();
      expect(await storage(page)).toBe(baseline);
      await expect
        .poll(() =>
          page.evaluate(
            () => window.__lifecycle.opened - window.__lifecycle.terminated,
          ),
        )
        .toBe(0);
    });

    for (const phase of ["decode-start", "recognition"]) {
      test(`close at ${phase}, workers finish and reopen clean`, async ({
        page,
      }) => {
        const baseline = await storage(page);
        await open(page);
        if (phase === "decode-start") {
          await input(page).setInputFiles(fixture("calendar.heic"));
          // Immediate close; does not claim a particular transient decoder stage.
          await page.getByRole("button", { name: "Cerrar diálogo" }).click();
        } else {
          await preview(page);
          await page.getByLabel("Mes y año", { exact: true }).fill("2026-11");
          await page.getByLabel("Confirmo que M/T/N/L").check();
          await page.evaluate(() => {
            window.__cancelAtRecognition = true;
          });
          await page
            .getByRole("button", { name: "Analizar en este dispositivo" })
            .click();
          await expect
            .poll(
              () =>
                page.evaluate(() => window.__lifecycle.recognitionCancelled),
              { timeout: 60000 },
            )
            .not.toBeNull();
        }
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect
          .poll(() =>
            page.evaluate(
              () => window.__lifecycle.opened - window.__lifecycle.terminated,
            ),
          )
          .toBe(0);
        await open(page);
        await expect(input(page)).toHaveValue("");
        await expect(
          page.locator(".import-image, .preview-table tbody tr"),
        ).toHaveCount(0);
        await preview(page);
        await page
          .getByRole("button", { name: "Cancelar importación" })
          .click();
        expect(await storage(page)).toBe(baseline);
      });
    }

    test("history back forward preserves fictional storage", async ({
      page,
    }) => {
      const baseline = await storage(page);
      const url = page.url();
      await page.goto("about:blank");
      await page.goto(url);
      await open(page);
      await preview(page);
      await page.goBack();
      expect(page.url()).toBe("about:blank");
      await page.goForward();
      await expect(opener(page)).toBeVisible();
      expect(await storage(page)).toBe(baseline);
      await open(page);
      await expect(input(page)).toHaveValue("");
      await expect(page.locator(".import-image")).toHaveCount(0);
    });
  });
}
