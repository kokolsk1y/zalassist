const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

// Apple-touch-startup-image — точные размеры под популярные iPhone (портрет).
// Источник: https://developer.apple.com/design/human-interface-guidelines/
const SIZES = [
  // [width, height, filename, deviceLabel]
  [1320, 2868, "splash-1320x2868.png", "iPhone 16 Pro Max"],
  [1206, 2622, "splash-1206x2622.png", "iPhone 16 Pro"],
  [1290, 2796, "splash-1290x2796.png", "iPhone 15/14 Pro Max / 15 Plus"],
  [1179, 2556, "splash-1179x2556.png", "iPhone 16/15/15 Pro/14 Pro"],
  [1284, 2778, "splash-1284x2778.png", "iPhone 14 Plus / 13 Pro Max / 12 Pro Max"],
  [1170, 2532, "splash-1170x2532.png", "iPhone 14/13/13 Pro/12/12 Pro"],
  [1125, 2436, "splash-1125x2436.png", "iPhone 11 Pro / XS / X"],
  [1242, 2688, "splash-1242x2688.png", "iPhone 11 Pro Max / XS Max"],
  [828, 1792, "splash-828x1792.png", "iPhone 11 / XR"],
  [750, 1334, "splash-750x1334.png", "iPhone 8/7/6s/SE2"],
];

// Edge установлен на Windows по умолчанию — используем его, чтобы не качать Chrome (~150МБ).
const EDGE_PATHS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

(async () => {
  const fs2 = require("fs");
  const edge = EDGE_PATHS.find((p) => fs2.existsSync(p));
  const browser = await puppeteer.launch(edge ? { executablePath: edge } : {});
  const tplPath = path.resolve(__dirname, "splash-template.html");
  const outDir = path.resolve(__dirname, "..", "static", "splash");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (const [w, h, name, label] of SIZES) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.goto("file:///" + tplPath.replace(/\\/g, "/"), { waitUntil: "networkidle0" });
    const out = path.join(outDir, name);
    await page.screenshot({ path: out, omitBackground: false });
    await page.close();
    console.log(`✓ ${name} (${w}×${h}) — ${label}`);
  }

  await browser.close();
  console.log(`\nSplash screens saved to ${outDir}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
