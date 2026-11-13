import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FILTERS,
  eligibleFragrances,
  MAX_WHEEL_SEGMENTS,
  pickWinner,
  resolveSlots,
  segmentAtRotation,
  slotOutcome,
  targetRotation,
  wheelLayout,
} from '../../src/domain/roulette';
import { blankFragrance } from '../../src/domain/fragrance';
import { localDay } from '../../src/domain/util';
import { manualWeather } from '../../src/domain/weather';

const f = (name: string, extra = {}) => blankFragrance({ brand: 'B', name, ...extra });

describe('wheel geometry', () => {
  it('always lands the pointer on the chosen segment', () => {
    for (let n = 1; n <= MAX_WHEEL_SEGMENTS; n++) {
      for (let index = 0; index < n; index++) {
        for (const current of [0, 37, 359, 1234.5, -90]) {
          for (const jitter of [0, 0.5, 0.999]) {
            const r = targetRotation(current, index, n, 5, jitter);
            expect(segmentAtRotation(r, n)).toBe(index);
            expect(r).toBeGreaterThanOrEqual(current + 5 * 360);
          }
        }
      }
    }
  });

  it('wheel layout always contains the winner and at most 16 segments', () => {
    const items = Array.from({ length: 40 }, (_, i) => ({ id: String(i) }));
    for (let i = 0; i < 200; i++) {
      const l = wheelLayout(items);
      expect(l.segments.length).toBe(MAX_WHEEL_SEGMENTS);
      expect(l.segments[l.winnerIndex].id).toBe(l.winner.id);
      expect(new Set(l.segments.map((s) => s.id)).size).toBe(MAX_WHEEL_SEGMENTS);
    }
  });

  it('draws winners uniformly (all eligible, even beyond 16)', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ id: String(i) }));
    const counts = new Map<string, number>();
    const N = 40_000;
    for (let i = 0; i < N; i++) {
      const w = wheelLayout(items).winner.id;
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
    expect(counts.size).toBe(20);
    // chi-square, 19 dof: critical value at p=0.001 ≈ 43.8
    const exp = N / 20;
    const chi = [...counts.values()].reduce((s, c) => s + (c - exp) ** 2 / exp, 0);
    expect(chi).toBeLessThan(43.8);
  });

  it('pickWinner rejects empty lists', () => {
    expect(() => pickWinner([])).toThrow();
  });
});

describe('slot machine', () => {
  it('resolves matches correctly', () => {
    expect(resolveSlots(['a', 'a', 'a'], 0)).toMatchObject({ winnerId: 'a', match: 3 });
    expect(resolveSlots(['a', 'b', 'a'], 1)).toMatchObject({ winnerId: 'a', match: 2, winnerReels: [0, 2] });
    expect(resolveSlots(['c', 'b', 'b'], 0)).toMatchObject({ winnerId: 'b', match: 2 });
    expect(resolveSlots(['a', 'b', 'c'], 2)).toMatchObject({ winnerId: 'c', match: 1, winnerReels: [2] });
  });

  it('winner always appears on the reels and is uniform overall', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const counts: Record<string, number> = {};
    const N = 30_000;
    for (let i = 0; i < N; i++) {
      const o = slotOutcome(ids);
      expect(o.reels).toContain(o.winnerId);
      for (const r of o.winnerReels) expect(o.reels[r]).toBe(o.winnerId);
      counts[o.winnerId] = (counts[o.winnerId] ?? 0) + 1;
    }
    const exp = N / ids.length;
    const chi = Object.values(counts).reduce((s, c) => s + (c - exp) ** 2 / exp, 0);
    expect(chi).toBeLessThan(18.5); // 4 dof, p=0.001
  });
});

describe('eligibility filters', () => {
  const now = new Date('2026-07-15T12:00:00');
  const fresh = f('Fresh', { family: 'Citrus', accords: ['citrus', 'fresh'], favorite: true, usage: { seasons: ['summer'], times: [], occasions: ['work'] } });
  const heavy = f('Heavy', { family: 'Oud', accords: ['oud', 'leather', 'smoky'], usage: { seasons: ['winter'], times: [], occasions: ['nightlife'] } });
  const unknown = f('Unknown');
  const all = [fresh, heavy, unknown];
  const base = { wears: [], weather: null, prefs: { runsWarm: 'neutral' as const }, now };

  it('favourites only', () => {
    expect(eligibleFragrances(all, { ...DEFAULT_FILTERS, favoritesOnly: true }, base).map((x) => x.name)).toEqual(['Fresh']);
  });
  it('season keeps unknown-data perfumes', () => {
    expect(eligibleFragrances(all, { ...DEFAULT_FILTERS, season: 'summer' }, base).map((x) => x.name)).toEqual(['Fresh', 'Unknown']);
  });
  it('excludes recently worn', () => {
    const wears = [{ id: 'w', fragranceId: fresh.id, day: localDay(now), at: now.toISOString(), source: 'manual' as const }];
    expect(eligibleFragrances(all, { ...DEFAULT_FILTERS, excludeRecentDays: 3 }, { ...base, wears }).map((x) => x.name)).toEqual(['Heavy', 'Unknown']);
  });
  it('weather suitability drops heavy perfumes in heat', () => {
    const out = eligibleFragrances(all, { ...DEFAULT_FILTERS, weatherOnly: true }, { ...base, weather: manualWeather(33, { humid: true }) });
    expect(out.map((x) => x.name)).toEqual(['Fresh', 'Unknown']);
  });
  it('family filter', () => {
    expect(eligibleFragrances(all, { ...DEFAULT_FILTERS, families: ['Oud'] }, base).map((x) => x.name)).toEqual(['Heavy']);
  });
});
