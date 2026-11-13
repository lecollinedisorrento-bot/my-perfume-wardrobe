// Lightweight, pressure-free achievements. No streaks, no "you'll lose it"
// mechanics — just collectible badges for things you already did.

import { resolveFamily } from './families';
import type { Combination, Fragrance, SpinRecord, WearLog } from './types';

export interface AchievementDef {
  id: string;
  color: 'blue' | 'pink' | 'lime' | 'tangerine' | 'lilac';
  glyph: 'star' | 'flower' | 'drop' | 'spark' | 'wheel' | 'flask' | 'heart' | 'crown';
  check: (s: AchievementState) => boolean;
}

export interface AchievementState {
  fragrances: Fragrance[];
  wears: WearLog[];
  combinations: Combination[];
  spins: SpinRecord[];
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_perfume', color: 'pink', glyph: 'star', check: (s) => s.fragrances.length >= 1 },
  { id: 'five_bottles', color: 'blue', glyph: 'drop', check: (s) => s.fragrances.length >= 5 },
  { id: 'shelf_of_ten', color: 'lilac', glyph: 'crown', check: (s) => s.fragrances.length >= 10 },
  { id: 'first_layer', color: 'lime', glyph: 'flask', check: (s) => s.combinations.length >= 1 },
  {
    id: 'favorite_combo',
    color: 'pink',
    glyph: 'heart',
    check: (s) => s.combinations.some((c) => c.success === true || (c.rating ?? 0) >= 4),
  },
  {
    id: 'first_week',
    color: 'tangerine',
    glyph: 'spark',
    // seven distinct days logged, in any order or spacing — no streak pressure
    check: (s) => new Set(s.wears.map((w) => w.day)).size >= 7,
  },
  {
    id: 'five_families',
    color: 'lime',
    glyph: 'flower',
    check: (s) =>
      new Set(
        s.wears
          .map((w) => s.fragrances.find((f) => f.id === w.fragranceId))
          .filter(Boolean)
          .map((f) => resolveFamily(f!.family)?.id ?? f!.family)
          .filter(Boolean),
      ).size >= 5,
  },
  { id: 'ten_spins', color: 'blue', glyph: 'wheel', check: (s) => s.spins.length >= 10 },
];

export function evaluateAchievements(state: AchievementState, unlocked: Set<string>): string[] {
  return ACHIEVEMENTS.filter((a) => !unlocked.has(a.id) && a.check(state)).map((a) => a.id);
}
