// Offline fragrance catalogue (public/catalog/index.json, built from
// catalog/brands/*.json by scripts/validate-catalog.mjs). Every entry carries
// the sources it was researched from; nothing here is AI-generated at runtime.

import type { Fragrance, ResearchInfo, SourceRef, Verification } from '../domain/types';
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

const FACT_MAP: Record<string, string> = { year: 'year', notes: 'notes', accords: 'accords', family: 'family', perfumer: 'perfumer', concentration: 'concentration', discontinued: 'discontinued' };

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
    research: catalogResearch(item),
  };
}
