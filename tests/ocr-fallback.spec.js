import { test, expect } from "@playwright/test";
import { isolateNetwork } from "./network.js";
test("formato sin cuadrícula: OCR parcial y corrección manual confirmada", async ({
  page,
}) => {
  await isolateNetwork(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Crear mi calendario local" }).click();
  await page
    .getByRole("button", { name: "Importar imagen", exact: true })
    .click();
  await page.getByLabel("Mes y año", { exact: true }).fill("2026-11");
  await page.getByLabel("Confirmo que M/T/N/L").check();
  const image = Buffer.from(
    await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 900;
      c.height = 260;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, 900, 260);
      ctx.fillStyle = "black";
      ctx.font = "36px Arial";
      ctx.fillText("12 08:00-16:00", 30, 75);
      ctx.fillText("13 X", 30, 145);
      return c.toDataURL("image/png").split(",")[1];
    }),
    "base64",
  );
  await page
    .getByLabel("Elegir imagen del calendario")
    .setInputFiles({ name: "lista.png", mimeType: "image/png", buffer: image });
  await page
    .getByRole("button", { name: "Analizar en este dispositivo" })
    .click();
  await expect(page.locator(".warning")).toContainText(
    "Formato de cuadrícula no reconocido",
    { timeout: 150000 },
  );
  await page.getByRole("button", { name: "Añadir fila manual" }).click();
  const n = await page.locator(".preview-table tbody tr").count();
  await page.getByLabel(`Fecha fila ${n}`, { exact: true }).fill("2026-11-20");
  await page.getByLabel(`Tipo fila ${n}`, { exact: true }).selectOption("off");
  await page.getByLabel(`Revisado fila ${n}`, { exact: true }).check();
  await page.getByLabel("Confirmo persona, mes").check();
  await page
    .getByRole("button", { name: "Insertar filas revisadas (1)", exact: true })
    .click();
  const entries = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("turnos-en-comun:v1:personal")).entries,
  );
  expect(entries).toHaveLength(1);
  expect(entries[0].date).toBe("2026-11-20");
  expect(entries[0].kind).toBe("off");
});
