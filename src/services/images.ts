// Image handling: resize user photos, fetch remote images through the
// server proxy, and cache everything locally as blobs in IndexedDB.

import { getImage } from '../db/repo';
import { appUrl } from './base';

const urlCache = new Map<string, string>();

export async function objectUrlFor(blobKey: string): Promise<string | null> {
  const cached = urlCache.get(blobKey);
  if (cached) return cached;
  const rec = await getImage(blobKey);
  if (!rec) return null;
  const url = URL.createObjectURL(rec.blob);
  urlCache.set(blobKey, url);
  return url;
}

export function forgetObjectUrl(blobKey: string) {
  const u = urlCache.get(blobKey);
  if (u) URL.revokeObjectURL(u);
  urlCache.delete(blobKey);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image decode failed'));
    img.src = src;
  });
}

/** Downscale to keep IndexedDB lean and AI uploads small. */
export async function resizeImage(file: Blob, maxSide = 1400, type = 'image/jpeg', quality = 0.86): Promise<Blob> {
  const src = URL.createObjectURL(file);
  try {
    const img = await loadImage(src);
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    if (scale === 1 && file.size < 900_000 && /image\/(jpeg|png|webp)/.test(file.type)) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d')!;
    if (type === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), type, quality),
    );
  } finally {
    URL.revokeObjectURL(src);
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Downloads a remote image through our server (avoids CORS, enforces SSRF rules). */
export async function fetchRemoteImage(url: string): Promise<Blob> {
  const res = await fetch(appUrl(`/api/image/proxy?url=${encodeURIComponent(url)}`));
  if (!res.ok) throw new Error('image fetch failed');
  const blob = await res.blob();
  if (!blob.type.startsWith('image/')) throw new Error('not an image');
  // Keep PNG transparency for cut-outs; otherwise compress.
  return blob.type === 'image/png' ? blob : resizeImage(blob, 1200, 'image/webp', 0.9);
}
