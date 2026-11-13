// Renders a shareable PNG "combination card" with canvas, then uses the Web
// Share API when available, or downloads the file.

import type { Combination, Fragrance } from '../domain/types';
import { objectUrlFor } from './images';
import type { TFn } from '../i18n';

const W = 1080;
const H = 1350;

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => resolve(null);
    i.src = src;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, maxLines = 3) {
  const words = text.split(/\s+/);
  let line = '';
  let lines = 0;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      y += lh;
      line = w;
      if (++lines >= maxLines - 1) break;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, y);
  return y + lh;
}

async function drawBottle(ctx: CanvasRenderingContext2D, f: Fragrance, cx: number, cy: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = '#202020';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, 200, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const url = f.image ? await objectUrlFor(f.image.blobKey) : null;
  const img = url ? await loadImg(url) : null;
  if (img) {
    const s = Math.min(320 / img.width, 320 / img.height);
    ctx.drawImage(img, cx - (img.width * s) / 2, cy - (img.height * s) / 2, img.width * s, img.height * s);
  } else {
    ctx.fillStyle = '#202020';
    ctx.font = '800 120px "Unbounded Variable", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(((f.brand[0] ?? '') + (f.name[0] ?? '')).toUpperCase(), cx, cy);
  }
  ctx.restore();
}

export async function renderComboCard(a: Fragrance, b: Fragrance, c: Combination, t: TFn): Promise<Blob> {
  await document.fonts?.ready;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  // background + halftone
  ctx.fillStyle = '#FF65B8';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(32,32,32,0.13)';
  for (let y = 0; y < H; y += 26) for (let x = (y / 26) % 2 ? 13 : 0; x < W; x += 26) ctx.fillRect(x, y, 4, 4);
  // frame
  ctx.strokeStyle = '#202020';
  ctx.lineWidth = 14;
  ctx.strokeRect(40, 40, W - 80, H - 80);

  ctx.fillStyle = '#202020';
  ctx.textAlign = 'left';
  ctx.font = '700 34px "Unbounded Variable", "Arial Black", sans-serif';
  ctx.fillText(t('share.title').toUpperCase(), 90, 130);

  await drawBottle(ctx, a, 340, 470, '#3155FF');
  await drawBottle(ctx, b, 740, 560, '#D5F34A');

  // MIX sticker
  ctx.save();
  ctx.translate(560, 330);
  ctx.rotate(-0.15);
  ctx.fillStyle = '#FF7738';
  ctx.strokeStyle = '#202020';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(-90, -40, 180, 80, 40);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#202020';
  ctx.font = '800 40px "Unbounded Variable", "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('MIX', 0, 2);
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#202020';
  ctx.font = '800 64px "Unbounded Variable", "Arial Black", sans-serif';
  let y = wrap(ctx, `${a.name} + ${b.name}`.toUpperCase(), 90, 870, W - 180, 72, 3);
  ctx.font = '600 34px "Manrope Variable", sans-serif';
  y = wrap(ctx, `${a.brand} · ${b.brand}`, 90, y + 4, W - 180, 44, 1);
  ctx.font = '600 32px "Manrope Variable", sans-serif';
  if (c.interaction) y = wrap(ctx, c.interaction, 90, y + 16, W - 180, 42, 2);

  // score
  ctx.fillStyle = '#202020';
  ctx.beginPath();
  ctx.arc(W - 170, 170, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#D5F34A';
  ctx.textAlign = 'center';
  ctx.font = '800 64px "Unbounded Variable", "Arial Black", sans-serif';
  ctx.fillText(String(c.compatibility), W - 170, 192);
  ctx.font = '700 18px "Manrope Variable", sans-serif';
  ctx.fillText(t('lab.score').toUpperCase(), W - 170, 225);

  ctx.fillStyle = '#202020';
  ctx.textAlign = 'left';
  ctx.font = '400 italic 40px "Instrument Serif", serif';
  ctx.fillText(t('share.footer'), 90, H - 100);

  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((bl) => (bl ? resolve(bl) : reject(new Error('render failed'))), 'image/png'));
}

export async function shareComboCard(a: Fragrance, b: Fragrance, c: Combination, t: TFn): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blob = await renderComboCard(a, b, c, t);
  const file = new File([blob], `combo-${a.name}-${b.name}.png`.replace(/[^\w.-]+/g, '-').toLowerCase(), { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: `${a.name} + ${b.name}` });
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  return 'downloaded';
}
