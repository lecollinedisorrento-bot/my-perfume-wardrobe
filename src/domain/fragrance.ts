import { CONCENTRATIONS, type Concentration, type Fragrance } from './types';
import { normalizeKey, nowIso, uid } from './util';

export function blankFragrance(partial: Partial<Fragrance> = {}): Fragrance {
  const now = nowIso();
  return normalizeFragrance({
    id: uid('f_'),
    createdAt: now,
    updatedAt: now,
    brand: '',
    name: '',
    concentration: 'Unknown',
    releaseYear: null,
    perfumer: null,
    country: null,
    family: '',
    accords: [],
    notes: { top: [], heart: [], base: [], flat: [] },
    noteSource: 'none',
    character: '',
    evolution: '',
    personality: '',
    performance: { basis: 'none' },
    usage: { seasons: [], times: [], occasions: [] },
    research: null,
    image: null,
    favorite: false,
    rating: null,
    personalNotes: '',
    experience: '',
    isSample: false,
    ...partial,
  });
}

/** Defensive normaliser — used by migrations and imports. */
export function normalizeFragrance(raw: Partial<Fragrance> & { id: string }): Fragrance {
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x: string) => x.trim()) : []);
  const conc = CONCENTRATIONS.includes(raw.concentration as Concentration) ? (raw.concentration as Concentration) : 'Unknown';
  const now = nowIso();
  return {
    id: raw.id,
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now,
    brand: (raw.brand ?? '').trim(),
    name: (raw.name ?? '').trim(),
    concentration: conc,
    releaseYear: typeof raw.releaseYear === 'number' ? raw.releaseYear : null,
    perfumer: raw.perfumer || null,
    country: raw.country || null,
    family: raw.family ?? '',
    accords: arr(raw.accords),
    notes: { top: arr(raw.notes?.top), heart: arr(raw.notes?.heart), base: arr(raw.notes?.base), flat: arr(raw.notes?.flat) },
    noteSource: raw.noteSource ?? 'none',
    character: raw.character ?? '',
    evolution: raw.evolution ?? '',
    personality: raw.personality ?? '',
    performance: { basis: 'none', ...(raw.performance ?? {}) },
    usage: {
      seasons: (raw.usage?.seasons ?? []) as Fragrance['usage']['seasons'],
      times: (raw.usage?.times ?? []) as Fragrance['usage']['times'],
      occasions: (raw.usage?.occasions ?? []) as Fragrance['usage']['occasions'],
      tempMinC: raw.usage?.tempMinC,
      tempMaxC: raw.usage?.tempMaxC,
    },
    research: raw.research ?? null,
    image: raw.image ?? null,
    favorite: !!raw.favorite,
    rating: typeof raw.rating === 'number' ? Math.max(0, Math.min(5, raw.rating)) : null,
    personalNotes: raw.personalNotes ?? '',
    experience: raw.experience ?? '',
    isSample: !!raw.isSample,
  };
}

export function fragranceKey(f: Pick<Fragrance, 'brand' | 'name'>) {
  return normalizeKey(`${f.brand} ${f.name}`);
}

export function displayName(f: Pick<Fragrance, 'brand' | 'name'>) {
  return `${f.brand} ${f.name}`.trim();
}

export function hasProfile(f: Fragrance) {
  return f.accords.length > 0 || allNotes(f).length > 0;
}

/** Every note, pyramid or not. */
export function allNotes(f: Pick<Fragrance, 'notes'>): string[] {
  return [...f.notes.top, ...f.notes.heart, ...f.notes.base, ...(f.notes.flat ?? [])];
}

/**
 * Optional development seed. ONLY brand + name: no notes, images or facts are
 * fabricated. Each entry is marked unverified until the user runs AI research
 * or fills in details.
 */
export const SAMPLE_COLLECTION: { brand: string; name: string }[] = [
  { brand: 'Amouage', name: 'Reflection Man' },
  { brand: 'Amouage', name: 'Beloved' },
  { brand: 'Nabeel', name: 'Irth' },
  { brand: 'Nabeel', name: 'Irth Boom' },
  { brand: 'Afnan', name: '9 PM Elixir' },
  { brand: 'Electimuss', name: 'Mercurial Cashmere' },
  { brand: 'Atyab Al Marshoud', name: 'Salt' },
  { brand: 'Parfums de Marly', name: 'Carlisle' },
  { brand: 'Parfums de Marly', name: 'Percival' },
  { brand: 'Parfums de Marly', name: 'Galloway' },
  { brand: 'Initio', name: 'Oud for Greatness' },
  { brand: 'Initio', name: 'Oud for Happiness' },
  { brand: 'Initio', name: 'Absolute Aphrodisiac' },
  { brand: 'Eight & Bob', name: 'Egypt' },
  { brand: 'Alexandre.J', name: 'Mandarine Sultane' },
  { brand: 'Pantheon Roma', name: 'Annone' },
];
