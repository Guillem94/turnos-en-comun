import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { flatJpeg, tiffJpeg } from "../tests/jpeg-fixtures.js";
import { isolateNetwork } from "../tests/network.js";
await mkdir("tests/jpeg-images", { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const records = [];
const save = async (name, bytes, details) => {
  await writeFile("tests/jpeg-images/" + name, bytes);
  records.push({
    name,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    ...details,
  });
};
try {
  const page = await browser.newPage();
  await isolateNetwork(page);
  await page.goto("http://127.0.0.1:5179");
  const png = await readFile("tests/images/monthly.png");
  const raster = await page.evaluate(async (data) => {
    const image = new Image();
    image.src = "data:image/png;base64," + data;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext("2d").drawImage(image, 0, 0);
    return {
      width: canvas.width,
      height: canvas.height,
      jpeg: canvas.toDataURL("image/jpeg", 0.96).split(",")[1],
    };
  }, png.toString("base64"));
  const jpeg = Buffer.from(raster.jpeg, "base64");
  await save("calendar.jpg", jpeg, {
    purpose:
      "Synthetic calendar rasterized through Canvas, browser JPEG encoder",
  });
  for (const compression of [6, 7])
    await save(
      "calendar-jpeg" + compression + ".tiff",
      tiffJpeg(jpeg, raster.width, raster.height, { compression }),
      { compression, width: raster.width, height: raster.height },
    );
  for (const [name, components, transform] of [
    ["gray", 1, 0],
    ["rgb", 3, 0],
    ["cmyk", 4, 0],
    ["ycck", 4, 2],
  ]) {
    const bytes = flatJpeg(components, transform);
    const native = await page.evaluate(
      async (data) => {
        const image = await createImageBitmap(
          new Blob([new Uint8Array(data)], { type: "image/jpeg" }),
        );
        const result = [image.width, image.height];
        image.close();
        return result;
      },
      [...bytes],
    );
    if (native[0] !== 16 || native[1] !== 16)
      throw Error("Synthetic JPEG is not accepted by native browser");
    await save(name + ".jpg", bytes, {
      components,
      transform,
      nativeDimensions: native,
    });
    if (components < 4)
      for (const tiled of [false, true])
        await save(
          name + (tiled ? "-tile" : "-strip") + ".tiff",
          tiffJpeg(bytes, 16, 16, { components, tiled }),
          { components, tiled },
        );
  }
  await writeFile(
    "tests/jpeg-images/manifest.json",
    JSON.stringify(
      {
        schemaVersion: 1,
        purpose: "Synthetic only; real JPEG/TIFF bytes, no OCR mock",
        files: records,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ status: "GENERATED", files: records.length }));
} finally {
  await browser.close();
}
