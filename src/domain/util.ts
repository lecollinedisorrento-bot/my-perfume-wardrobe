import type { Season, TimeOfDay } from './types';

export function uid(prefix = ''): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return prefix + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Local calendar day YYYY-MM-DD */
export function localDay(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function daysBetween(aDay: string, bDay: string): number {
  const a = new Date(aDay + 'T12:00:00');
  const b = new Date(bDay + 'T12:00:00');
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** Meteorological season for a date; flips for the southern hemisphere. */
export function seasonFor(d: Date = new Date(), latitude?: number | null): Season {
  const m = d.getMonth(); // 0-11
  const north: Season = m <= 1 || m === 11 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn';
  if (latitude != null && latitude < 0) {
    return ({ winter: 'summer', summer: 'winter', spring: 'autumn', autumn: 'spring' } as const)[north];
  }
  return north;
}

export function timeOfDay(d: Date = new Date()): TimeOfDay {
  const h = d.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'night';
}

/**
 * Uniform random integer in [0, n) using crypto, rejecting biased values.
 * Used for the roulette and slot machine so results are genuinely random.
 */
export function randomInt(n: number): number {
  if (!Number.isInteger(n) || n <= 0) throw new Error('randomInt: n must be a positive integer');
  const max = 0x100000000;
  const limit = max - (max % n);
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}

/** Random float in [0,1) from crypto. */
export function randomFloat(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 0x100000000;
}

export function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

export function cToF(c: number) {
  return Math.round((c * 9) / 5 + 32);
}

export function normalizeKey(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
