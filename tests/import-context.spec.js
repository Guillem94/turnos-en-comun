import { test, expect } from "@playwright/test";
import { formatFixture } from "./format-fixtures.js";
import { isolateNetwork } from "./network.js";
for (const variant of ["crop", "rotate90", "jpeg", "webp"])
  test(`OCR 0.2 contexto rasterizado: ${variant}`, async ({ page }) => {
    await isolateNetwork(page);
    await page.goto("/");
    await page
      .getByRole("button", { name: "Crear mi calendario local" })
      .click();
    await page
      .getByRole("button", { name: "Importar imagen", exact: true })
      .click();
    await page.getByLabel("Mes y año", { exact: true }).fill("2026-11");
    await page.getByLabel("Confirmo que M/T/N/L").check();
    let buffer = await formatFixture(page, "monthly"),
      mime = "image/png";
    if (["rotate90", "jpeg", "webp"].includes(variant)) {
      mime =
        variant === "jpeg"
          ? "image/jpeg"
          : variant === "webp"
            ? "image/webp"
            : "image/png";
      const data = await page.evaluate(
        async ({ data, variant, mime }) => {
          const im = new Image();
          im.src = "data:image/png;base64," + data;
          await im.decode();
          const c = document.createElement("canvas");
          c.width = variant === "rotate90" ? im.height : im.width;
          c.height = variant === "rotate90" ? im.width : im.height;
          const ctx = c.getContext("2d");
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, c.width, c.height);
          if (variant === "rotate90") {
            ctx.translate(c.width, 0);
            ctx.rotate(Math.PI / 2);
          }
          ctx.drawImage(im, 0, 0);
          return c.toDataURL(mime, 0.98).split(",")[1];
        },
        { data: buffer.toString("base64"), variant, mime },
      );
      buffer = Buffer.from(data, "base64");
    }
    await page.getByLabel("Elegir imagen del calendario").setInputFiles({
      name: `fixture.${variant === "jpeg" ? "jpg" : variant === "webp" ? "webp" : "png"}`,
      mimeType: mime,
      buffer,
    });
    if (variant === "rotate90")
      await page.getByLabel("Corregir giro").fill("-90");
    if (variant === "crop") {
      await page.getByText("Disposición y recorte local (opcional)").click();
      await page.getByLabel("Recorte Arriba").fill("8");
    }
    await page
      .getByRole("button", { name: "Analizar en este dispositivo" })
      .click();
    await expect(
      page.getByRole("button", { name: "Analizar en este dispositivo" }),
    ).toBeEnabled({ timeout: 150000 });
    await expect(page.locator(".preview-table tbody tr")).toHaveCount(14);
    if (["crop", "rotate90"].includes(variant)) {
      expect(
        await page
          .locator('.preview-table input[type="date"]')
          .evaluateAll((inputs) => inputs.map((i) => i.value)),
      ).toEqual(
        Array.from({ length: 14 }, (_, i) =>
          [0, 10].includes(i)
            ? ""
            : `2026-11-${String(i + 1).padStart(2, "0")}`,
        ),
      );
      await expect(
        page.getByLabel("Fecha fila 1", { exact: true }),
      ).toHaveValue("");
      await expect(
        page
          .getByText("Fecha repetida en celdas mensuales distintas", {
            exact: false,
          })
          .first(),
      ).toBeVisible();
      await page.getByLabel("Fecha fila 1", { exact: true }).fill("2026-11-01");
      await page
        .getByLabel("Fecha fila 11", { exact: true })
        .fill("2026-11-11");
    }
    await expect(page.getByLabel("Fecha fila 1", { exact: true })).toHaveValue(
      "2026-11-01",
    );
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("turnos-en-comun:v1:personal"))
            .entries.length,
      ),
    ).toBe(0);
    await page.getByRole("button", { name: "Cancelar importación" }).click();
  });
test("SVG ejecutable es rechazado sin decodificar ni ejecutar", async ({
  page,
}) => {
  await isolateNetwork(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Crear mi calendario local" }).click();
  await page
    .getByRole("button", { name: "Importar imagen", exact: true })
    .click();
  await page.getByLabel("Elegir imagen del calendario").setInputFiles({
    name: "bad.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" onload="window.unsafeExecuted=true"/>',
    ),
  });
  await expect(page.getByRole("alert")).toContainText("PNG");
  expect(await page.evaluate(() => window.unsafeExecuted)).toBeUndefined();
});
