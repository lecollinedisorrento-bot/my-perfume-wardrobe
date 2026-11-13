// Roulette + slot machine logic. The result is always chosen with a uniform,
// crypto-backed random draw among eligible perfumes BEFORE any animation runs;
// the animation is then computed to stop exactly on that result.

import { resolveFamily } from './families';
import type { Fragrance, Season, WearLog, WeatherSnapshot, Preferences } from './types';
import { daysBetween, localDay, randomFloat, randomInt } from './util';
import { lastWornMap, weatherFit } from './recommend';
import { weatherProfile } from './weather';

export interface SpinFilters {
  favoritesOnly: boolean;
  season: Season | null;
  occasion: string | null;
  weatherOnly: boolean;
  excludeRecentDays: number; // 0 = off
  families: string[];
}

export const DEFAULT_FILTERS: SpinFilters = {
  favoritesOnly: false,
  season: null,
  occasion: null,
  weatherOnly: false,
  excludeRecentDays: 0,
  families: [],
};

export function eligibleFragrances(
  all: Fragrance[],
  filters: SpinFilters,
  ctx: { wears: WearLog[]; weather: WeatherSnapshot | null; prefs: Pick<Preferences, 'runsWarm'>; now?: Date },
): Fragrance[] {
  const last = lastWornMap(ctx.wears);
  const today = localDay(ctx.now ?? new Date());
  const wp = ctx.weather ? weatherProfile(ctx.weather, ctx.prefs.runsWarm) : null;
  return all.filter((f) => {
    if (filters.favoritesOnly && !f.favorite) return false;
    // Unknown usage data is kept: we don't know that it doesn't fit.
    if (filters.season && f.usage.seasons.length && !f.usage.seasons.includes(filters.season)) return false;
    if (filters.occasion && f.usage.occasions.length && !(f.usage.occasions as string[]).includes(filters.occasion))
      return false;
    if (filters.families.length) {
      const fam = resolveFamily(f.family)?.id ?? f.family;
      if (!filters.families.includes(fam)) return false;
    }
    if (filters.excludeRecentDays > 0) {
      const l = last.get(f.id);
      if (l && daysBetween(l, today) < filters.excludeRecentDays) return false;
    }
    if (filters.weatherOnly && wp) {
      const { fit, known } = weatherFit(f, wp);
      if (known && fit < 0.6) return false;
    }
    return true;
  });
}

export function pickWinner<T>(items: T[]): { index: number; item: T } {
  if (!items.length) throw new Error('No eligible items');
  const index = randomInt(items.length);
  return { index, item: items[index] };
}

// ── Wheel geometry ────────────────────────────────────────────────────────
// Segment i spans [i*seg, (i+1)*seg) degrees clockwise from 12 o'clock.
// The pointer sits at 12 o'clock. Rotating the wheel clockwise by R degrees
// puts original angle (360 - R mod 360) under the pointer.

export const MAX_WHEEL_SEGMENTS = 16;

export function segmentAtRotation(rotationDeg: number, n: number): number {
  const seg = 360 / n;
  const r = ((rotationDeg % 360) + 360) % 360;
  const a = (360 - r) % 360;
  return Math.min(n - 1, Math.floor(a / seg));
}

/**
 * Final rotation (absolute, degrees) that lands segment `index` under the pointer,
 * always moving forward from `current` by at least `minTurns` full turns.
 */
export function targetRotation(current: number, index: number, n: number, minTurns = 5, jitter = randomFloat()): number {
  const seg = 360 / n;
  const within = 0.2 + jitter * 0.6; // stay away from segment edges
  const a = (index + within) * seg; // original angle we want under the pointer
  const wantMod = (360 - a + 360) % 360;
  const curMod = ((current % 360) + 360) % 360;
  let delta = wantMod - curMod;
  if (delta < 0) delta += 360;
  return current + minTurns * 360 + delta;
}

/**
 * Choose which perfumes appear on the wheel. All eligible perfumes have the
 * same chance: the winner is drawn first from the full list; if there are more
 * than MAX_WHEEL_SEGMENTS, the wheel shows the winner plus a random sample.
 */
export function wheelLayout<T extends { id: string }>(eligible: T[]): { segments: T[]; winnerIndex: number; winner: T } {
  const { item: winner } = pickWinner(eligible);
  let segments: T[];
  if (eligible.length <= MAX_WHEEL_SEGMENTS) {
    segments = eligible.slice();
  } else {
    const others = eligible.filter((e) => e.id !== winner.id);
    shuffle(others);
    segments = [winner, ...others.slice(0, MAX_WHEEL_SEGMENTS - 1)];
    shuffle(segments);
  }
  return { segments, winnerIndex: segments.findIndex((s) => s.id === winner.id), winner };
}

export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── Slot machine ──────────────────────────────────────────────────────────
// Each reel draws independently and uniformly. The winner is the perfume shown
// on 2+ reels; if all three differ, one of the three reels is drawn uniformly.
// The rule is symmetric across perfumes, so every eligible perfume keeps the
// same overall chance of winning.

export interface SlotOutcome {
  reels: [string, string, string];
  winnerId: string;
  match: 1 | 2 | 3;
  winnerReels: number[];
}

export function slotOutcome(ids: string[]): SlotOutcome {
  if (!ids.length) throw new Error('No eligible items');
  const reels = [ids[randomInt(ids.length)], ids[randomInt(ids.length)], ids[randomInt(ids.length)]] as [
    string,
    string,
    string,
  ];
  return resolveSlots(reels, randomInt(3));
}

export function resolveSlots(reels: [string, string, string], tieBreak: number): SlotOutcome {
  const [a, b, c] = reels;
  if (a === b && b === c) return { reels, winnerId: a, match: 3, winnerReels: [0, 1, 2] };
  if (a === b) return { reels, winnerId: a, match: 2, winnerReels: [0, 1] };
  if (a === c) return { reels, winnerId: a, match: 2, winnerReels: [0, 2] };
  if (b === c) return { reels, winnerId: b, match: 2, winnerReels: [1, 2] };
  return { reels, winnerId: reels[tieBreak], match: 1, winnerReels: [tieBreak] };
}

/** Wheel easing: fast start, long realistic deceleration. */
export const WHEEL_EASING = 'cubic-bezier(0.12, 0.66, 0.1, 1)';
