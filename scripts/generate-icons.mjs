// Generates every app icon from the master artwork in design/icon/icon-master.png
// using the preinstalled Chromium (canvas, high-quality downscaling).
//
//   icon-512.png / icon-192.png   "any" purpose: rounded corners, transparent outside
//   icon-maskable-512.png         full-bleed; artwork shrunk so it sits inside the
//                                 80% safe circle, background extended by mirroring
//   apple-touch-icon.png (180)    full-bleed, no transparency (iOS rounds it)
//   favicon-32.png / favicon-16.png
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = new URL('..', import.meta.url);
const master = readFileSync(new URL('design/icon/icon-master.png', root)).toString('base64');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');

const outputs = await page.evaluate(async (src) => {
  const img = new Image();
  img.src = 'data:image/png;base64,' + src;
  await img.decode();

  // Downscale in halving steps for a crisp result.
  function scaled(size) {
    let cur = img;
    let w = img.naturalWidth;
    while (w / 2 > size) {
      w = Math.round(w / 2);
      const c = document.createElement('canvas');
      c.width = c.height = w;
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(cur, 0, 0, w, w);
      cur = c;
    }
    return cur;
  }

  function render(size, mode) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    if (mode === 'rounded') {
      g.beginPath();
      g.roundRect(0, 0, size, size, size * 0.2237);
      g.clip();
      g.drawImage(scaled(size), 0, 0, size, size);
    } else if (mode === 'maskable') {
      // Artwork bounds reach ~45% of the width from the centre; the safe
      // circle has a 40% radius, so shrink to 86% and mirror the halftone
      // background outward so the dots continue seamlessly.
      const s = Math.round(size * 0.86);
      const off = (size - s) / 2;
      const src = scaled(s);
      for (const i of [-1, 0, 1]) {
        for (const j of [-1, 0, 1]) {
          // tile (i, j) covers [off + i*s, off + (i+1)*s]; neighbours are mirrored
          g.save();
          g.translate(off + i * s + (i !== 0 ? s : 0), off + j * s + (j !== 0 ? s : 0));
          g.scale(i !== 0 ? -1 : 1, j !== 0 ? -1 : 1);
          g.drawImage(src, 0, 0, s, s);
          g.restore();
        }
      }
    } else {
      g.drawImage(scaled(size), 0, 0, size, size);
    }
    return c.toDataURL('image/png').split(',')[1];
  }

  return {
    'icon-512.png': render(512, 'rounded'),
    'icon-192.png': render(192, 'rounded'),
    'icon-maskable-512.png': render(512, 'maskable'),
    'apple-touch-icon.png': render(180, 'full'),
    'favicon-32.png': render(32, 'rounded'),
    'favicon-16.png': render(16, 'rounded'),
  };
}, master);

for (const [name, b64] of Object.entries(outputs)) {
  writeFileSync(new URL(`public/icons/${name}`, root), Buffer.from(b64, 'base64'));
}
await browser.close();
console.log('icons written:', Object.keys(outputs).join(', '));
