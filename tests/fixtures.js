export async function rasterCalendar(
  page,
  {
    mode = "codes",
    angle = 0,
    blur = 0,
    cropped = false,
    unknown = false,
  } = {},
) {
  return Buffer.from(
    await page.evaluate(
      ({ mode, angle, blur, cropped, unknown }) => {
        const canvas = document.createElement("canvas");
        canvas.width = 1480;
        canvas.height = 520;
        const c = canvas.getContext("2d");
        c.fillStyle = "white";
        c.fillRect(0, 0, 1480, 520);
        c.fillStyle = "#111";
        c.font = "bold 28px Arial";
        if (!cropped)
          c.fillText("NOVIEMBRE 2026 - CALENDARIO FICTICIO", 40, 38);
        const x0 = 40,
          y0 = 70,
          cw = 200,
          ch = 190;
        c.strokeStyle = "#111";
        c.lineWidth = 3;
        for (let col = 0; col <= 7; col++) {
          c.beginPath();
          c.moveTo(x0 + col * cw, y0);
          c.lineTo(x0 + col * cw, y0 + 2 * ch);
          c.stroke();
        }
        for (let row = 0; row <= 2; row++) {
          c.beginPath();
          c.moveTo(x0, y0 + row * ch);
          c.lineTo(x0 + 7 * cw, y0 + row * ch);
          c.stroke();
        }
        for (let i = 0; i < 14; i++) {
          const x = x0 + (i % 7) * cw,
            y = y0 + Math.floor(i / 7) * ch;
          c.font = "bold 36px Arial";
          c.fillText(String(i + 1), x + 18, y + 49);
          c.font = mode === "times" ? "26px Arial" : "bold 42px Arial";
          c.fillText(
            unknown && i === 0
              ? "X"
              : mode === "times"
                ? i % 2 === 0
                  ? "08:00-16:00"
                  : "22:00-06:00"
                : ["M", "T", "N", "L"][i % 4],
            x + 18,
            y + 122,
          );
        }
        const out = document.createElement("canvas");
        out.width = 1580;
        out.height = cropped ? 480 : 680;
        const ctx = out.getContext("2d");
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.translate(790, cropped ? 230 : 340);
        ctx.rotate((angle * Math.PI) / 180);
        ctx.filter = blur ? `blur(${blur}px)` : "none";
        if (cropped)
          ctx.drawImage(canvas, 0, 60, 1480, 460, -740, -220, 1480, 460);
        else ctx.drawImage(canvas, -740, -260);
        return out.toDataURL("image/png").split(",")[1];
      },
      { mode, angle, blur, cropped, unknown },
    ),
    "base64",
  );
}
