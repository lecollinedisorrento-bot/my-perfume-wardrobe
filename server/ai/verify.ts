// Server-side verification of AI research. The model may only cite sources that
// were actually retrieved during the request; anything else is dropped, and
// facts without surviving support are removed. Pure + unit-tested.

import type { ResearchResponse, ResearchSource } from '../../src/shared/api';
import type { RawResearch } from './provider';

const SEASONS = new Set(['spring', 'summer', 'autumn', 'winter']);
const TIMES = new Set(['morning', 'afternoon', 'evening', 'night']);
const OCCASIONS = new Set(['work', 'university', 'casual', 'formal', 'date', 'romantic', 'nightlife', 'special']);

function brandTokens(brand: string): string[] {
  return brand
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !['parfums', 'parfum', 'perfumes', 'fragrances', 'paris', 'london'].includes(t));
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** A source is "official" only if its domain plausibly belongs to the brand. */
export function plausiblyOfficial(url: string, brand: string): boolean {
  const host = hostOf(url).replace(/[^a-z0-9.]/g, '');
  const tokens = brandTokens(brand);
  if (!tokens.length) return false;
  const squashed = host.replace(/[.-]/g, '');
  return tokens.some((t) => squashed.includes(t));
}

const level = (v: number | null) => (v == null ? null : Math.max(1, Math.min(5, Math.round(v))));

export function verifyResearch(
  raw: RawResearch,
  req: { brand: string; name: string },
  engine: string,
  now = new Date(),
): Omit<ResearchResponse, 'imageCandidates'> {
  const d = raw.draft;
  const retrievedAt = now.toISOString().slice(0, 10);
  const dropped: string[] = [];

  // 1) Keep only sources that reference a retrieved URL.
  const byUrl = new Map<string, ResearchSource>();
  let invalidRefs = 0;
  for (const s of d.sources) {
    const hit = Number.isInteger(s.index) ? raw.retrieved[s.index] : undefined;
    if (!hit) {
      invalidRefs++;
      continue;
    }
    let type = s.type;
    if (type === 'official' && !plausiblyOfficial(hit.url, req.brand)) type = 'database';
    const prev = byUrl.get(hit.url);
    const supports = [...new Set([...(prev?.supports ?? []), ...s.supports])];
    byUrl.set(hit.url, { name: s.name || hit.title || hostOf(hit.url), url: hit.url, type, retrievedAt, supports });
  }
  if (invalidRefs) dropped.push(`invalid_source_refs:${invalidRefs}`);
  const sources = [...byUrl.values()];
  const supported = (fact: string) => sources.filter((s) => s.supports.includes(fact));

  // 2) Identity facts need explicit support.
  const releaseYear = d.releaseYear != null && supported('year').length ? d.releaseYear : null;
  if (d.releaseYear != null && releaseYear == null) dropped.push('releaseYear');
  const perfumer = d.perfumer && supported('perfumer').length ? d.perfumer : null;
  if (d.perfumer && !perfumer) dropped.push('perfumer');
  const country = d.country && supported('country').length ? d.country : null;
  if (d.country && !country) dropped.push('country');

  // 3) Note provenance is downgraded to what the sources can back up.
  const noteSources = supported('notes');
  const officialNotes = noteSources.some((s) => s.type === 'official');
  let noteSource = d.noteSource;
  if (noteSource === 'official' && !officialNotes) noteSource = noteSources.length ? 'reported' : 'ai_interpretation';
  if (noteSource === 'reported' && !noteSources.length) noteSource = 'ai_interpretation';

  // 4) Overall status.
  let status: ResearchResponse['research']['status'];
  if (!d.identityMatch || !sources.length) status = 'unverified';
  else if (officialNotes || noteSources.length >= 2) status = 'verified';
  else status = 'partially_verified';

  let confidence = d.confidence;
  if (status === 'unverified') confidence = 'low';
  else if (status === 'partially_verified' && confidence === 'high') confidence = 'medium';

  const clean = (a: string[]) => [...new Set(a.map((x) => x.trim()).filter(Boolean))];
  const tmin = d.usage.tempMinC;
  const tmax = d.usage.tempMaxC;

  return {
    profile: {
      brand: req.brand,
      name: req.name,
      concentration: d.concentration || 'Unknown',
      releaseYear,
      perfumer,
      country,
      family: d.family,
      accords: clean(d.accords.map((a) => a.toLowerCase())).slice(0, 8),
      notes: { top: clean(d.notes.top), heart: clean(d.notes.heart), base: clean(d.notes.base) },
      noteSource,
      character: d.character,
      evolution: d.evolution,
      personality: d.personality,
      performance: {
        longevity: level(d.performance.longevity),
        projection: level(d.performance.projection),
        sillage: level(d.performance.sillage),
        intensity: level(d.performance.intensity),
      },
      usage: {
        seasons: d.usage.seasons.filter((s) => SEASONS.has(s)),
        times: d.usage.times.filter((s) => TIMES.has(s)),
        occasions: d.usage.occasions.filter((s) => OCCASIONS.has(s)),
        tempMinC: tmin != null && tmax != null && tmin <= tmax ? tmin : null,
        tempMaxC: tmin != null && tmax != null && tmin <= tmax ? tmax : null,
      },
    },
    research: {
      status,
      confidence,
      sources,
      researchedAt: now.toISOString(),
      engine,
      droppedUnsupported: dropped,
    },
    identityMatch: d.identityMatch,
    searchAvailable: raw.searchAvailable,
  };
}
