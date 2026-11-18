import { familyIdOf, resolveFamily, seasonsOf } from './families';
import type { Fragrance, Season, WearLog } from './types';
import { SEASONS } from './types';
import { wearCounts } from './recommend';

export interface CollectionStats {
  total: number;
  favorites: number;
  rated: number;
  avgRating: number | null;
  researched: number;
  mostWorn: { fragrance: Fragrance; count: number }[];
  families: { family: string; count: number; members: Fragrance[]; estimated: number }[];
  seasons: Record<Season, number>;
  seasonMembers: Record<Season, Fragrance[]>;
  /** Perfumes whose family was estimated from the notes. */
  estimatedFamilies: number;
  recentlyAdded: Fragrance[];
  totalWears: number;
  distinctWornThisMonth: number;
}

export function collectionStats(fragrances: Fragrance[], wears: WearLog[], now = new Date()): CollectionStats {
  const counts = wearCounts(wears);
  const famMap = new Map<string, { members: Fragrance[]; estimated: number }>();
  let estimatedFamilies = 0;
  for (const f of fragrances) {
    const fam = familyIdOf(f) ?? 'Unknown';
    const est = fam !== 'Unknown' && !resolveFamily(f.family) && !f.family?.trim();
    if (est) estimatedFamilies++;
    const e = famMap.get(fam) ?? { members: [], estimated: 0 };
    e.members.push(f);
    if (est) e.estimated++;
    famMap.set(fam, e);
  }
  const seasons = Object.fromEntries(SEASONS.map((s) => [s, 0])) as Record<Season, number>;
  const seasonMembers = Object.fromEntries(SEASONS.map((s) => [s, [] as Fragrance[]])) as Record<Season, Fragrance[]>;
  for (const f of fragrances)
    for (const s of seasonsOf(f)) {
      seasons[s]++;
      seasonMembers[s].push(f);
    }
  const rated = fragrances.filter((f) => f.rating != null);
  const monthPrefix = now.toISOString().slice(0, 7);
  return {
    total: fragrances.length,
    favorites: fragrances.filter((f) => f.favorite).length,
    rated: rated.length,
    avgRating: rated.length ? rated.reduce((s, f) => s + (f.rating ?? 0), 0) / rated.length : null,
    researched: fragrances.filter((f) => f.research && f.research.status !== 'unverified').length,
    mostWorn: fragrances
      .map((f) => ({ fragrance: f, count: counts.get(f.id) ?? 0 }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    families: [...famMap.entries()]
      .map(([family, e]) => ({ family, count: e.members.length, members: e.members, estimated: e.estimated }))
      .sort((a, b) => b.count - a.count),
    seasons,
    seasonMembers,
    estimatedFamilies,
    recentlyAdded: [...fragrances].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
    totalWears: wears.length,
    distinctWornThisMonth: new Set(wears.filter((w) => w.day.startsWith(monthPrefix)).map((w) => w.fragranceId)).size,
  };
}
