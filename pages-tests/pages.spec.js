import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import ICAL from "ical.js";

const key = "turnos-en-comun:v1:personal";
const audits = new WeakMap();
const state = (page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);

test.beforeEach(async ({ page, context, baseURL }) => {
  const base = new URL(baseURL);
  const audit = {
    requests: [],
    responses: [],
    failures: [],
    errors: [],
    console: [],
  };
  audits.set(page, audit);
  // Observe the real browser/worker requests: no routes, OCR mocks or response substitution.
  context.on("request", (request) => {
    if (/^https?:/.test(request.url())) {
      const url = new URL(request.url());
      audit.requests.push({
        path: url.pathname,
        origin: url.origin,
        method: request.method(),
        inBase:
          url.origin === base.origin && url.pathname.startsWith(base.pathname),
      });
    }
  });
  context.on("response", (response) =>
    audit.responses.push({ url: response.url(), status: response.status() }),
  );
  context.on("requestfailed", (request) =>
    audit.failures.push({
      url: request.url(),
      error: request.failure()?.errorText,
    }),
  );
  page.on("pageerror", (error) => audit.errors.push(error.message));
  page.on("console", (message) =>
    audit.console.push({ type: message.type(), text: message.text() }),
  );
});

test.afterEach(async ({ page }, info) => {
  const audit = audits.get(page);
  await info.attach("pages-network-console", {
    body: JSON.stringify(audit, null, 2),
    contentType: "application/json",
  });
  await page.screenshot({
    path: info.outputPath("mobile.png"),
    fullPage: true,
  });
  expect(audit.requests.filter((r) => !r.inBase)).toEqual([]);
  expect(
    audit.requests.filter((r) => !["GET", "HEAD"].includes(r.method)),
  ).toEqual([]);
  expect(audit.responses.filter((r) => r.status >= 400)).toEqual([]);
  expect(audit.failures).toEqual([]);
  expect(audit.errors).toEqual([]);
  expect(audit.console.filter((m) => m.type === "error")).toEqual([]);
});

async function openPersonal(page) {
  await page.goto("./");
  await expect(page).toHaveTitle("Turnos en Común");
  await expect(
    page.getByRole("button", { name: "Probar demo con datos ficticios" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Crear mi calendario local" }).click();
  await expect(page.locator("h1")).toContainText("Haced sitio");
  await page.getByLabel("Ir a fecha", { exact: true }).fill("2026-11-13");
}

async function downloadText(page, name) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name, exact: true }).click();
  const download = await pending;
  expect(await download.failure()).toBeNull();
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  let text = "";
  for await (const chunk of stream) text += chunk.toString();
  return text;
}

test("Pages móvil: UI, CRUD nocturno, persistencia, JSON/ICS y avisos", async ({
  page,
  request,
  baseURL,
}) => {
  await openPersonal(page);
  await page.getByRole("button", { name: "+ Añadir turno" }).click();
  await page.getByLabel("Nombre del registro").fill("Noche ficticia Pages");
  await page.getByLabel("Entrada", { exact: true }).fill("22:00");
  await page.getByLabel("Salida", { exact: true }).fill("06:00");
  await page.getByRole("button", { name: "Guardar registro" }).click();
  expect((await state(page)).entries).toHaveLength(1);
  await page.reload();
  await page.getByLabel("Ir a fecha", { exact: true }).fill("2026-11-13");
  const entry = page.locator(".person-day").first().getByRole("button").first();
  await entry.click();
  await expect(page.getByLabel("Entrada", { exact: true })).toHaveValue(
    "22:00",
  );
  await expect(page.getByLabel("Salida", { exact: true })).toHaveValue("06:00");
  await page.getByLabel("Nombre del registro").fill("Noche ficticia revisada");
  await page.getByRole("button", { name: "Guardar registro" }).click();
  await page
    .getByRole("button", { name: "Datos y ajustes", exact: true })
    .click();
  const backup = JSON.parse(await downloadText(page, "Exportar copia JSON"));
  expect(backup.entries).toHaveLength(1);
  expect(backup.entries[0]).toMatchObject({
    label: "Noche ficticia revisada",
    date: "2026-11-13",
    kind: "shift",
    start: "22:00",
    end: "06:00",
  });
  const calendar = new ICAL.Component(
    ICAL.parse(await downloadText(page, "Descargar .ics")),
  );
  const events = calendar.getAllSubcomponents("vevent");
  expect(events).toHaveLength(1);
  const event = new ICAL.Event(events[0]);
  expect(event.startDate.toString()).toBe("2026-11-13T21:00:00Z");
  expect(event.endDate.toString()).toBe("2026-11-14T05:00:00Z");
  expect(event.duration.toSeconds()).toBe(8 * 3600);
  await page.reload();
  await page.getByLabel("Ir a fecha", { exact: true }).fill("2026-11-13");
  await entry.click();
  await page.getByRole("button", { name: "Mover a papelera" }).click();
  expect((await state(page)).entries.filter((e) => !e.deletedAt)).toHaveLength(
    0,
  );
  expect((await state(page)).entries[0].deletedAt).toBeTruthy();
  await page.reload();
  expect((await state(page)).entries.filter((e) => !e.deletedAt)).toHaveLength(
    0,
  );
  const legalURL = new URL("legal/index.html", baseURL).href;
  await expect(page.locator('a[href$="legal/index.html"]')).toHaveAttribute(
    "href",
    new URL(legalURL).pathname,
  );
  const legal = await request.get(legalURL);
  expect(legal.status()).toBe(200);
  expect(await legal.text()).toContain('href="../"');
  expect(await legal.text()).toContain(
    'href="https://github.com/Guillem94/turnos-en-comun"',
  );
  const favicon = await page.locator('link[rel="icon"]').getAttribute("href");
  expect(new URL(favicon, baseURL).pathname).toBe(
    new URL("favicon.svg", baseURL).pathname,
  );
  expect((await request.get(new URL(favicon, baseURL).href)).status()).toBe(
    200,
  );
});

test("Pages móvil: PNG y HEIC reales, OCR/evidencia y cancelación sin mutación", async ({
  page,
  baseURL,
}, info) => {
  await openPersonal(page);
  const initial = await state(page);
  for (const [file, mime] of [
    ["monthly.png", "image/png"],
    ["calendar.heic", "image/heic"],
  ]) {
    await page
      .getByRole("button", { name: "Importar imagen", exact: true })
      .click();
    await page.getByLabel("Mes y año", { exact: true }).fill("2026-11");
    await page.getByLabel("Confirmo que M/T/N/L").check();
    await page.getByLabel("Elegir imagen del calendario").setInputFiles({
      name: file,
      mimeType: mime,
      buffer: await readFile(
        new URL("../tests/images/" + file, import.meta.url),
      ),
    });
    const analyze = page.getByRole("button", {
      name: "Analizar en este dispositivo",
    });
    await expect(analyze).toBeEnabled({ timeout: 35000 });
    await analyze.click();
    await expect(analyze).toBeEnabled({ timeout: 150000 });
    const rows = page.locator(".preview-table tbody tr");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    const values = await rows.evaluateAll((rs) =>
      rs.map((r) => ({
        date: r.querySelector('input[type="date"]').value,
        kind: r.querySelector("select").value,
        warning: r.querySelector(".hint").textContent,
        invalid: r.querySelector(".error").textContent,
      })),
    );
    expect(values.some((r) => r.date && r.kind)).toBe(true);
    for (let i = 0; i < count; i++) {
      const reviewed = page.getByLabel(`Revisado fila ${i + 1}`, {
        exact: true,
      });
      await expect(reviewed).not.toBeChecked();
      if (!values[i].date || !values[i].kind) {
        expect((values[i].warning + values[i].invalid).trim()).not.toBe("");
        await expect(rows.nth(i).locator(".hint")).toBeVisible();
        await expect(reviewed).toBeDisabled();
      }
    }
    await page.getByLabel("Ver evidencia fila 1", { exact: true }).click();
    const evidence = page.locator(".evidence-preview img");
    await expect(evidence).toBeVisible();
    expect(
      await evidence.evaluate((img) => img.complete && img.naturalWidth > 0),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: /Insertar filas revisadas/ }),
    ).toBeDisabled();
    expect(await state(page)).toEqual(initial);
    await page.screenshot({
      path: info.outputPath(file + ".png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Cancelar importación" }).click();
    expect(await state(page)).toEqual(initial);
    console.log(
      JSON.stringify({
        fixture: file,
        candidates: count,
        recognized: values.filter((r) => r.date && r.kind).length,
        pending: values.filter((r) => !r.date || !r.kind).length,
      }),
    );
  }
  const base = new URL(baseURL);
  const resources = audits
    .get(page)
    .responses.filter((r) => r.status === 200)
    .map((r) => new URL(r.url).pathname);
  expect(resources).toContain(base.pathname + "ocr/worker.min.js");
  expect(
    resources.some(
      // Tesseract's official .wasm.js wrapper embeds the WASM payload;
      // a successful real OCR run need not request a separate .wasm file.
      (r) =>
        r.startsWith(base.pathname + "ocr/core/") &&
        (r.endsWith(".wasm.js") || r.endsWith(".wasm")),
    ),
  ).toBe(true);
  expect(
    resources.some(
      (r) =>
        r.startsWith(base.pathname + "ocr/lang/") &&
        r.includes("eng.traineddata"),
    ),
  ).toBe(true);
  expect(resources).toContain(
    base.pathname + "codecs/libheif/libheif-bundle.mjs",
  );
});
