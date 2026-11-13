import { describe, expect, it } from 'vitest';
import { blankFragrance } from '../../src/domain/fragrance';
import { computeLearning, neglected, rankFragrances } from '../../src/domain/recommend';
import { manualWeather, weatherProfile, tempBand } from '../../src/domain/weather';
import { DEFAULT_PREFS } from '../../src/db/repo';
import { localLayerSuggestion } from '../../src/domain/layering';
import { evaluateAchievements } from '../../src/domain/achievements';
import { collectionStats } from '../../src/domain/stats';
import { resolveFamily, traitsFor } from '../../src/domain/families';

const citrus = blankFragrance({ brand: 'A', name: 'Citrus Splash', family: 'Citrus Aromatic', accords: ['citrus', 'aromatic', 'fresh'] });
const amber = blankFragrance({ brand: 'B', name: 'Amber Night', family: 'Amber Woody', accords: ['amber', 'vanilla', 'warm spicy'], notes: { top: [], heart: [], base: ['vanilla', 'tonka'] } });
const oud = blankFragrance({ brand: 'C', name: 'Oud Smoke', family: 'Oud', accords: ['oud', 'smoky', 'leather'] });
const all = [citrus, amber, oud];
const prefs = { ...DEFAULT_PREFS };
const now = new Date('2026-05-10T10:00:00');

describe('weather engine', () => {
  it('bands temperatures', () => {
    expect(tempBand(31)).toBe('hot');
    expect(tempBand(2)).toBe('cold');
    expect(weatherProfile(manualWeather(10, { rainy: true })).rainy).toBe(true);
  });
  it('people who run warm feel heat sooner', () => {
    expect(weatherProfile(manualWeather(26), 'warm').band).toBe('hot');
    expect(weatherProfile(manualWeather(26), 'neutral').band).toBe('warm');
  });
});

describe('local recommendations', () => {
  it('prefers fresh scents when it is hot', () => {
    const r = rankFragrances(all, { context: { weather: manualWeather(33, { humid: true }) }, prefs, wears: [], now });
    expect(r[0].fragrance.id).toBe(citrus.id);
    expect(r.at(-1)!.fragrance.id).not.toBe(citrus.id);
    expect(r[0].reasons.some((x) => x.key === 'why.weather.hot')).toBe(true);
  });
  it('prefers rich scents when it is cold', () => {
    const r = rankFragrances(all, { context: { weather: manualWeather(-2) }, prefs, wears: [], now });
    expect(r[0].fragrance.id).not.toBe(citrus.id);
  });
  it('respects moods', () => {
    const r = rankFragrances(all, { context: { mood: 'dark_mysterious', weather: manualWeather(15) }, prefs, wears: [], now });
    expect(r[0].fragrance.id).toBe(oud.id);
    const fresh = rankFragrances(all, { context: { mood: 'fresh_start', weather: manualWeather(15) }, prefs, wears: [], now });
    expect(fresh[0].fragrance.id).toBe(citrus.id);
  });
  it('penalises disliked notes and explains it', () => {
    const r = rankFragrances(all, { context: { weather: manualWeather(5) }, prefs: { ...prefs, dislikedNotes: ['vanilla'] }, wears: [], now });
    const a = r.find((x) => x.fragrance.id === amber.id)!;
    expect(a.reasons.some((x) => x.key === 'why.disliked')).toBe(true);
  });
  it('pushes down what was worn today', () => {
    const wears = [{ id: 'w', fragranceId: citrus.id, day: '2026-05-10', at: now.toISOString(), source: 'manual' as const }];
    const base = rankFragrances(all, { context: { weather: manualWeather(30) }, prefs, wears: [], now });
    const after = rankFragrances(all, { context: { weather: manualWeather(30) }, prefs, wears, now });
    expect(after.find((x) => x.fragrance.id === citrus.id)!.score).toBeLessThan(base.find((x) => x.fragrance.id === citrus.id)!.score);
  });
  it('neglected lists never-worn perfumes', () => {
    expect(neglected(all, [], 21, now).length).toBe(3);
  });
  it('learning is empty after a reset and when disabled', () => {
    const wears = [{ id: 'w', fragranceId: oud.id, day: '2026-05-01', at: '2026-05-01T10:00:00Z', source: 'manual' as const }];
    expect(computeLearning(all, wears, { learningEnabled: true, learningResetAt: null }).events).toBe(1);
    expect(computeLearning(all, wears, { learningEnabled: true, learningResetAt: '2026-05-05T00:00:00Z' }).events).toBe(0);
    expect(computeLearning(all, wears, { learningEnabled: false, learningResetAt: null }).events).toBe(0);
  });
});

describe('families', () => {
  it('resolves free-text families', () => {
    expect(resolveFamily('Oriental Woody')?.id).toBe('Amber');
    expect(resolveFamily('Woody Aromatic')?.id).toBe('Aromatic');
    expect(resolveFamily('')).toBeNull();
    expect(traitsFor('', []).known).toBe(false);
  });
});

describe('layering heuristics', () => {
  it('warns about two heavyweights and keeps the score subjective-range', () => {
    const s = localLayerSuggestion(oud, blankFragrance({ brand: 'D', name: 'Leather', family: 'Leather', accords: ['leather', 'smoky', 'oud'] }));
    expect(s.conflicts).toBe('lab.c.heavy');
    expect(s.compatibility).toBeGreaterThanOrEqual(5);
    expect(s.compatibility).toBeLessThanOrEqual(92);
  });
  it('applies the heavier perfume first', () => {
    const s = localLayerSuggestion(citrus, amber);
    expect(s.order.startsWith('B Amber Night')).toBe(true);
  });
});

describe('achievements & stats', () => {
  it('unlocks without streak mechanics', () => {
    const wears = Array.from({ length: 7 }, (_, i) => ({ id: String(i), fragranceId: citrus.id, day: `2026-01-${String(i * 3 + 1).padStart(2, '0')}`, at: '', source: 'manual' as const }));
    const ids = evaluateAchievements({ fragrances: all, wears, combinations: [], spins: [] }, new Set());
    expect(ids).toContain('first_perfume');
    expect(ids).toContain('first_week'); // 7 distinct days, not consecutive
    expect(ids).not.toContain('five_bottles');
  });
  it('computes stats', () => {
    const s = collectionStats(all, [{ id: 'w', fragranceId: oud.id, day: '2026-05-01', at: '', source: 'spin' }]);
    expect(s.total).toBe(3);
    expect(s.mostWorn[0].fragrance.id).toBe(oud.id);
    expect(s.families.length).toBe(3);
  });
});
