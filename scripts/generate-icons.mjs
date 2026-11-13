// Renders the PWA icons from public/favicon.svg using the preinstalled Chromium.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const out = (f) => new URL(`../public/icons/${f}`, import.meta.url).pathname;
const browser = await chromium.launch();
const page = await browser.newPage();
async function render(size, file, { maskable = false } = {}) {
  await page.setViewportSize({ width: size, height: size });
  const inner = maskable ? Math.round(size * 0.72) : size;
  const html = `<html><body style="margin:0;display:grid;place-items:center;width:${size}px;height:${size}px;background:${maskable ? '#3155FF' : 'transparent'}">
    <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `).replace(maskable ? 'rx="16"' : '___', 'rx="0"')}</div></body></html>`;
  await page.setContent(html);
  await page.screenshot({ path: out(file), omitBackground: !maskable });
}
await render(192, 'icon-192.png');
await render(512, 'icon-512.png');
await render(512, 'icon-maskable-512.png', { maskable: true });
await render(180, 'apple-touch-icon.png', { maskable: true });
await browser.close();
console.log('icons written');
