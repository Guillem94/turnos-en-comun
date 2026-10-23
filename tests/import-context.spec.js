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
    const expectedDates = Array.from(
      { length: 14 },
      (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`,
    );
    const dates = page.locator('.preview-table input[type="date"]');
    const initialDates = await dates.evaluateAll((inputs) =>
      inputs.map((i) => i.value),
    );
    console.log(
      JSON.stringify({
        fixture: `context-${variant}`,
        candidates: initialDates.length,
        recognizedDates: initialDates.filter(Boolean).length,
        pendingDates: initialDates.filter((date) => !date).length,
      }),
    );
    const insert = page.getByRole("button", {
      name: /Insertar filas revisadas/,
    });
    const beforeCancel = await page.evaluate(() =>
      localStorage.getItem("turnos-en-comun:v1:personal"),
    );
    if (["crop", "rotate90"].includes(variant)) {
      const pendingDates = expectedDates.map((date, i) =>
        [0, 10].includes(i) ? "" : date,
      );
      // Accept a correct reading, not a mandatory historical OCR mistake.
      expect([expectedDates, pendingDates]).toContainEqual(initialDates);
      if (initialDates.includes("")) {
        await expect(
          page
            .getByText("Fecha repetida en celdas mensuales distintas", {
              exact: false,
            })
            .first(),
        ).toBeVisible();
        for (const row of [1, 11]) {
          await expect(
            page.getByLabel(`Revisado fila ${row}`, { exact: true }),
          ).not.toBeChecked();
          await expect(
            page.getByLabel(`Revisado fila ${row}`, { exact: true }),
          ).toBeDisabled();
        }
        expect(JSON.parse(beforeCancel).entries).toHaveLength(0);
        await expect(insert).toBeDisabled();
        await page
          .getByLabel("Fecha fila 1", { exact: true })
          .fill("2026-11-01");
        await page
          .getByLabel("Fecha fila 11", { exact: true })
          .fill("2026-11-11");
      }
    }
    expect(
      await dates.evaluateAll((inputs) => inputs.map((i) => i.value)),
    ).toEqual(expectedDates);
    for (let row = 1; row <= 14; row++)
      await expect(
        page.getByLabel(`Revisado fila ${row}`, { exact: true }),
      ).not.toBeChecked();
    await expect(insert).toBeDisabled();
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("turnos-en-comun:v1:personal"))
            .entries.length,
      ),
    ).toBe(0);
    await page.getByRole("button", { name: "Cancelar importación" }).click();
    expect(
      await page.evaluate(() =>
        localStorage.getItem("turnos-en-comun:v1:personal"),
      ),
    ).toBe(beforeCancel);
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
