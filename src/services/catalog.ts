// Offline fragrance catalogue (public/catalog/index.json, built from
// catalog/brands/*.json by scripts/validate-catalog.mjs). Every entry carries
// the sources it was researched from; nothing here is AI-generated at runtime.

import type { Fragrance, Level, ResearchInfo, Season, SourceRef, TimeOfDay, Verification } from '../domain/types';
import { normalizeKey } from '../domain/util';
import { matchConcentration } from '../screens/research';
import { appUrl } from './base';

export interface CatalogItem {
  b: string; // brand
  n: string; // name
  c: string | null; // concentration
  y: number | null; // release year
  p: string | null; // perfumer
  f: string | null; // family
  a: string[]; // accords
  t: { top: string[]; heart: string[]; base: string[]; flat: string[] };
  ns: 'official' | 'reported' | 'none';
  col: string | null;
  d?: boolean; // discontinued
  s: { u: string; n: string; t: 'official' | 'retailer' | 'database' | 'publication'; f: string[] }[];
  r: string | null; // retrieved date
  /** Performance tendency 1–5 (longevity, sillage, projection), its basis and a short evidence line. */
  pf?: { l: number | null; s: number | null; p: number | null; b: 'official' | 'retailer' | 'reviews' | 'search'; e: string | null };
  /** When it is typically worn, as stated by its sources. */
  u?: { s: string[]; t: string[] };
  /** Cut-out bottle photo in /catalog/img/ and the page it was taken from. */
  i?: { f: string; u: string; n: string; t: 'official' | 'retailer' | 'database' | 'publication' };
}

export interface CatalogIndex {
  v: number;
  built: string;
  brands: string[];
  items: CatalogItem[];
}

export const CATALOG_ENGINE = 'catalog';

let cache: Promise<CatalogIndex> | null = null;

export function loadCatalog(): Promise<CatalogIndex> {
  if (!cache) {
    cache = fetch(appUrl('/catalog/index.json'))
      .then((r) => (r.ok && (r.headers.get('content-type') ?? '').includes('json') ? r.json() : null))
      .then((j: CatalogIndex | null) => (j && Array.isArray(j.items) ? j : { v: 1, built: '', brands: [], items: [] }))
      .catch(() => {
        cache = null; // allow a retry later (e.g. after coming back online)
        return { v: 1, built: '', brands: [], items: [] };
      });
  }
  return cache;
}

/** Test hook. */
export function setCatalogForTests(c: CatalogIndex | null) {
  cache = c ? Promise.resolve(c) : null;
  imageIndex = null;
}

export type CatalogImage = NonNullable<CatalogItem['i']> & { url: string };

export const catalogImageUrl = (file: string) => appUrl(`/catalog/img/${encodeURIComponent(file)}`);

let imageIndex: Promise<Map<string, CatalogImage>> | null = null;

/** Cut-out official bottle photo for a perfume, when the catalogue has one. */
export function catalogImageFor(brand: string, name: string): Promise<CatalogImage | null> {
  if (!imageIndex) {
    imageIndex = loadCatalog().then((c) => {
      const m = new Map<string, CatalogImage>();
      for (const i of c.items) if (i.i && !m.has(key(i))) m.set(key(i), { ...i.i, url: catalogImageUrl(i.i.f) });
      if (!c.items.length) imageIndex = null; // catalogue not loaded yet (offline): retry later
      return m;
    });
  }
  return imageIndex.then((m) => m.get(normalizeKey(`${brand} ${name}`)) ?? null);
}

const key = (i: Pick<CatalogItem, 'b' | 'n'>) => normalizeKey(`${i.b} ${i.n}`);

/** Ranked search over brand + name; every query word must match. */
export function searchCatalog(items: CatalogItem[], query: string, limit = 8): CatalogItem[] {
  const words = normalizeKey(query).split(' ').filter(Boolean);
  if (!words.length) return [];
  const scored: { item: CatalogItem; score: number }[] = [];
  for (const item of items) {
    const name = normalizeKey(item.n);
    const brand = normalizeKey(item.b);
    const hay = `${brand} ${name}`;
    if (!words.every((w) => hay.includes(w))) continue;
    let score = 0;
    for (const w of words) {
      if (name.startsWith(w) || brand.startsWith(w)) score += 3;
      if (` ${hay} `.includes(` ${w} `)) score += 2;
    }
    if (name === normalizeKey(query) || hay === normalizeKey(query)) score += 10;
    if (item.ns !== 'none') score += 1;
    if (item.d) score -= 1;
    scored.push({ item, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.item.n.length - b.item.n.length || a.item.n.localeCompare(b.item.n))
    .slice(0, limit)
    .map((x) => x.item);
}

/** Exact brand + name match (used to enrich perfumes already on the shelf). */
export function findCatalogMatch(items: CatalogItem[], brand: string, name: string): CatalogItem | null {
  const k = normalizeKey(`${brand} ${name}`);
  const exact = items.filter((i) => key(i) === k);
  if (exact.length) return exact.sort((a, b) => (a.ns === 'official' ? -1 : 0) - (b.ns === 'official' ? -1 : 0))[0];
  return null;
}

const FACT_MAP: Record<string, string> = {
  year: 'year',
  notes: 'notes',
  accords: 'accords',
  family: 'family',
  perfumer: 'perfumer',
  concentration: 'concentration',
  discontinued: 'discontinued',
  performance: 'performance',
  usage: 'usage',
};

const level = (n: number | null | undefined) => (n && n >= 1 && n <= 5 ? (n as Level) : undefined);

export function catalogResearch(item: CatalogItem): ResearchInfo {
  const sources: SourceRef[] = item.s.map((s) => ({
    name: s.n,
    url: s.u,
    type: s.t,
    retrievedAt: item.r ?? '',
    supports: s.f.map((x) => FACT_MAP[x] ?? x),
  }));
  const noteSources = sources.filter((s) => s.supports.includes('notes'));
  let status: Verification;
  if (noteSources.some((s) => s.type === 'official') || noteSources.length >= 2) status = 'verified';
  else if (noteSources.length === 1) status = 'partially_verified';
  else status = 'unverified';
  return {
    status,
    confidence: status === 'verified' ? 'high' : status === 'partially_verified' ? 'medium' : 'low',
    sources,
    researchedAt: item.r ?? '',
    engine: CATALOG_ENGINE,
    droppedUnsupported: [],
  };
}

/** True when a catalogue entry can add something to a profile that came from the catalogue (or nowhere). */
export function catalogHasNews(f: Fragrance, item: CatalogItem): boolean {
  if (f.research && f.research.engine !== CATALOG_ENGINE) return false; // AI-researched profiles are not overwritten
  if (!f.research) return true;
  const notes = (x: { top: string[]; heart: string[]; base: string[]; flat: string[] }) => x.top.length + x.heart.length + x.base.length + x.flat.length;
  const perfEmpty = f.performance.basis !== 'user' && !f.performance.longevity && !f.performance.sillage && !f.performance.projection;
  return (
    notes(item.t) > notes(f.notes) ||
    (!!item.pf && perfEmpty) ||
    (!!item.u && (item.u.s.length > 0 && !f.usage.seasons.length || item.u.t.length > 0 && !f.usage.times.length))
  );
}

/** Fills a fragrance profile from a catalogue entry, keeping personal data. */
export function applyCatalog(f: Fragrance, item: CatalogItem): Fragrance {
  return {
    ...f,
    brand: item.b,
    name: item.n,
    concentration: item.c ? matchConcentration(item.c, f.concentration) : f.concentration,
    releaseYear: item.y,
    perfumer: item.p,
    country: f.country,
    family: item.f ?? f.family,
    accords: item.a.length ? item.a : f.accords,
    notes: { top: item.t.top, heart: item.t.heart, base: item.t.base, flat: item.t.flat },
    noteSource: item.ns === 'none' ? 'none' : item.ns,
    // Catalogue performance is a sourced tendency; the user's own experience always wins.
    performance:
      item.pf && f.performance.basis !== 'user'
        ? { longevity: level(item.pf.l), sillage: level(item.pf.s), projection: level(item.pf.p), intensity: f.performance.intensity, basis: 'estimate' }
        : f.performance,
    usage: item.u
      ? {
          ...f.usage,
          seasons: f.usage.seasons.length ? f.usage.seasons : (item.u.s as Season[]),
          times: f.usage.times.length ? f.usage.times : (item.u.t as TimeOfDay[]),
        }
      : f.usage,
    research: catalogResearch(item),
  };
}
