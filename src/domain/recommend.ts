// Local, deterministic recommendation engine. It runs fully offline and is
// always labelled "Local match" in the UI — it is NOT AI.

import { traitsFor, resolveFamily } from './families';
import type {
  Fragrance,
  Mood,
  Preferences,
  RecommendationContext,
  TimeOfDay,
  WearLog,
} from './types';
import { daysBetween, localDay, seasonFor, timeOfDay } from './util';
import { weatherProfile, type WeatherProfile } from './weather';

export interface Reason {
  key: string;
  params?: Record<string, string | number>;
}

export interface Scored {
  fragrance: Fragrance;
  score: number;
  reasons: Reason[];
}

interface MoodSpec {
  accords: string[];
  families: string[];
  weight?: [number, number]; // preferred weight range
  freshness?: [number, number];
  loud?: boolean;
  times?: TimeOfDay[];
}

export const MOOD_SPECS: Record<Mood, MoodSpec> = {
  main_character: { accords: ['amber', 'oud', 'sweet', 'leather', 'saffron', 'rose'], families: ['Amber', 'Oud', 'Leather'], weight: [0.6, 1], loud: true },
  clean_energy: { accords: ['citrus', 'fresh', 'aromatic', 'musky', 'green', 'aquatic'], families: ['Citrus', 'Fresh', 'Aromatic', 'Musk', 'Aquatic'], freshness: [0.65, 1], times: ['morning', 'afternoon'] },
  dark_mysterious: { accords: ['oud', 'leather', 'smoky', 'incense', 'patchouli', 'animalic'], families: ['Oud', 'Leather', 'Smoky'], weight: [0.65, 1], times: ['evening', 'night'] },
  soft_cozy: { accords: ['musky', 'vanilla', 'powdery', 'amber', 'iris', 'almond'], families: ['Musk', 'Powdery', 'Gourmand'], weight: [0.3, 0.75] },
  date_night: { accords: ['vanilla', 'amber', 'sweet', 'rose', 'white floral', 'tobacco', 'boozy'], families: ['Amber', 'Gourmand', 'Floral'], times: ['evening', 'night'] },
  loud_entrance: { accords: ['oud', 'amber', 'sweet', 'warm spicy', 'fruity'], families: ['Oud', 'Amber', 'Gourmand'], loud: true },
  fresh_start: { accords: ['citrus', 'green', 'aromatic', 'fresh', 'bergamot', 'herbal'], families: ['Citrus', 'Green', 'Aromatic', 'Fresh'], freshness: [0.7, 1], times: ['morning'] },
  after_hours: { accords: ['boozy', 'tobacco', 'oud', 'gourmand', 'leather', 'coffee', 'rum'], families: ['Gourmand', 'Oud', 'Leather', 'Amber'], times: ['night', 'evening'] },
};

export interface Learning {
  familyAffinity: Record<string, number>;
  accordAffinity: Record<string, number>;
  events: number;
}

/** Learns soft affinities from ratings and wears since the last reset. */
export function computeLearning(
  fragrances: Fragrance[],
  wears: WearLog[],
  prefs: Pick<Preferences, 'learningEnabled' | 'learningResetAt'>,
): Learning {
  const out: Learning = { familyAffinity: {}, accordAffinity: {}, events: 0 };
  if (!prefs.learningEnabled) return out;
  const since = prefs.learningResetAt ?? '1970-01-01';
  const byId = new Map(fragrances.map((f) => [f.id, f]));
  const bump = (f: Fragrance, amount: number) => {
    const fam = resolveFamily(f.family)?.id ?? f.family;
    if (fam) out.familyAffinity[fam] = (out.familyAffinity[fam] ?? 0) + amount;
    f.accords.slice(0, 4).forEach((a) => {
      const k = a.toLowerCase();
      out.accordAffinity[k] = (out.accordAffinity[k] ?? 0) + amount * 0.6;
    });
    out.events++;
  };
  for (const w of wears) {
    if (w.at < since) continue;
    const f = byId.get(w.fragranceId);
    if (f) bump(f, 1);
  }
  for (const f of fragrances) {
    if (f.rating != null && f.updatedAt >= since) bump(f, (f.rating - 3) * 0.8);
  }
  // Normalise to roughly -1..1
  const norm = (rec: Record<string, number>) => {
    const max = Math.max(1, ...Object.values(rec).map(Math.abs));
    for (const k of Object.keys(rec)) rec[k] = rec[k] / max;
  };
  norm(out.familyAffinity);
  norm(out.accordAffinity);
  return out;
}

export interface ScoreInput {
  context: RecommendationContext;
  prefs: Preferences;
  wears: WearLog[];
  learning?: Learning;
  now?: Date;
  latitude?: number | null;
}

export function lastWornMap(wears: WearLog[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const w of wears) {
    for (const id of [w.fragranceId, w.secondaryId]) {
      if (!id) continue;
      const prev = m.get(id);
      if (!prev || prev < w.day) m.set(id, w.day);
    }
  }
  return m;
}

export function wearCounts(wears: WearLog[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const w of wears) m.set(w.fragranceId, (m.get(w.fragranceId) ?? 0) + 1);
  return m;
}

function rangeFit(v: number, [lo, hi]: [number, number]) {
  if (v >= lo && v <= hi) return 1;
  const d = v < lo ? lo - v : v - hi;
  return Math.max(0, 1 - d * 3);
}

export function weatherFit(f: Fragrance, wp: WeatherProfile): { fit: number; known: boolean } {
  // Explicit comfortable temperature range wins when present.
  if (f.usage.tempMinC != null && f.usage.tempMaxC != null) {
    const t = wp.feelsLikeC;
    if (t >= f.usage.tempMinC && t <= f.usage.tempMaxC) return { fit: 1, known: true };
    const d = t < f.usage.tempMinC ? f.usage.tempMinC - t : t - f.usage.tempMaxC;
    return { fit: Math.max(0, 1 - d / 10), known: true };
  }
  const tr = traitsFor(f.family, f.accords);
  if (!tr.known) return { fit: 0.5, known: false };
  const freshFit = 1 - Math.abs(tr.freshness - wp.idealFreshness);
  const weightFit = tr.weight <= wp.idealWeight ? 1 : Math.max(0, 1 - (tr.weight - wp.idealWeight) * 2.2);
  let fit = freshFit * 0.55 + weightFit * 0.45;
  if (wp.humid && tr.sweetness > 0.75 && (wp.band === 'hot' || wp.band === 'warm')) fit -= 0.15;
  return { fit: Math.max(0, Math.min(1, fit)), known: true };
}

export function scoreFragrance(f: Fragrance, input: ScoreInput): Scored {
  const { context: ctx, prefs } = input;
  const now = input.now ?? new Date();
  const reasons: Reason[] = [];
  let score = 0;
  const tr = traitsFor(f.family, f.accords);
  const accLower = f.accords.map((a) => a.toLowerCase());
  const notesLower = [...f.notes.top, ...f.notes.heart, ...f.notes.base].map((n) => n.toLowerCase());

  // Weather / temperature
  const weather = ctx.weather;
  if (weather) {
    const wp = weatherProfile(weather, prefs.runsWarm);
    const { fit, known } = weatherFit(f, wp);
    score += (fit - 0.5) * 3;
    if (known && fit >= 0.75) reasons.push({ key: `why.weather.${wp.band}`, params: { t: Math.round(wp.feelsLikeC) } });
    if (known && wp.rainy && tr.weight > 0.45 && tr.freshness < 0.6) {
      score += 0.4;
      reasons.push({ key: 'why.rain' });
    }
    if (known && wp.humid && fit >= 0.7 && tr.weight < 0.5) reasons.push({ key: 'why.humid' });
  }

  // Season
  const season = seasonFor(now, input.latitude);
  if (f.usage.seasons.length) {
    if (f.usage.seasons.includes(season)) {
      score += 0.8;
      reasons.push({ key: 'why.season', params: { season } });
    } else score -= 0.4;
  }

  // Time of day
  const tod = ctx.timeOfDay ?? timeOfDay(now);
  if (f.usage.times.length) {
    if (f.usage.times.includes(tod)) {
      score += 0.6;
      reasons.push({ key: 'why.time', params: { time: tod } });
    } else score -= 0.3;
  }

  // Occasion
  if (ctx.occasion) {
    if ((f.usage.occasions as string[]).includes(ctx.occasion)) {
      score += 1.4;
      reasons.push({ key: 'why.occasion', params: { occasion: ctx.occasion } });
    } else if (f.usage.occasions.length) score -= 0.5;
  }

  // Mood
  if (ctx.mood) {
    const spec = MOOD_SPECS[ctx.mood];
    const famId = resolveFamily(f.family)?.id;
    const accordHits = spec.accords.filter((a) => accLower.some((x) => x.includes(a))).length;
    let m = accordHits * 0.6 + (famId && spec.families.includes(famId) ? 0.9 : 0);
    if (spec.weight && tr.known) m += (rangeFit(tr.weight, spec.weight) - 0.5) * 1.2;
    if (spec.freshness && tr.known) m += (rangeFit(tr.freshness, spec.freshness) - 0.5) * 1.2;
    if (spec.loud && f.performance.projection) m += (f.performance.projection - 3) * 0.3;
    if (spec.times?.includes(tod)) m += 0.2;
    score += m;
    if (m > 0.9) reasons.push({ key: 'why.mood', params: { mood: ctx.mood } });
  }

  // Desired intensity
  const wantIntensity = ctx.intensity ?? (prefs.intensity !== 'any' ? prefs.intensity : null);
  if (wantIntensity) {
    const lvl = f.performance.intensity ?? f.performance.projection ?? (tr.known ? Math.round(1 + tr.weight * 4) : null);
    if (lvl != null) {
      const target = wantIntensity === 'soft' ? 1.5 : wantIntensity === 'moderate' ? 3 : 4.5;
      const d = Math.abs(lvl - target);
      score += (1.5 - d) * 0.4;
      if (d <= 1 && ctx.intensity) reasons.push({ key: `why.intensity.${wantIntensity}` });
    }
  }

  // Family filter / preference
  const famId = resolveFamily(f.family)?.id ?? f.family;
  if (ctx.family) {
    if (famId === ctx.family || f.family.toLowerCase().includes(ctx.family.toLowerCase())) {
      score += 1.5;
      reasons.push({ key: 'why.family', params: { family: ctx.family } });
    } else score -= 1;
  }
  if (prefs.favoriteFamilies.includes(famId)) {
    score += 0.5;
    reasons.push({ key: 'why.prefFamily', params: { family: famId } });
  }
  const accordLikes = prefs.favoriteAccords.filter((a) => accLower.includes(a.toLowerCase()));
  if (accordLikes.length) {
    score += 0.35 * accordLikes.length;
    reasons.push({ key: 'why.prefAccord', params: { accord: accordLikes[0] } });
  }
  const disliked = prefs.dislikedNotes.filter((n) =>
    [...notesLower, ...accLower].some((x) => x.includes(n.toLowerCase())),
  );
  if (disliked.length) {
    score -= 1.5 * disliked.length;
    reasons.push({ key: 'why.disliked', params: { note: disliked[0] } });
  }

  // Impression (free text) — loose keyword overlap
  if (ctx.impression) {
    const words = ctx.impression.toLowerCase().split(/[^a-zà-ü]+/).filter((w) => w.length > 3);
    const blob = [f.character, f.personality, ...accLower].join(' ').toLowerCase();
    const hits = words.filter((w) => blob.includes(w)).length;
    score += hits * 0.5;
  }

  // Personal signals
  if (f.favorite) score += 0.5;
  if (f.rating != null) score += (f.rating - 3) * 0.35;
  if (input.learning) {
    const la = input.learning.familyAffinity[famId] ?? 0;
    const lc = accLower.reduce((s, a) => s + (input.learning!.accordAffinity[a] ?? 0), 0) / Math.max(1, accLower.length);
    score += la * 0.4 + lc * 0.3;
  }

  // Recency: gently push perfumes not worn lately
  const last = lastWornMap(input.wears).get(f.id);
  if (last) {
    const d = daysBetween(last, localDay(now));
    if (d <= 0) score -= 1.2;
    else if (d <= 2) score -= 0.6;
    else if (d >= 21) {
      score += 0.3;
      reasons.push({ key: 'why.neglected', params: { days: d } });
    }
  }

  return { fragrance: f, score, reasons: dedupeReasons(reasons).slice(0, 4) };
}

function dedupeReasons(r: Reason[]) {
  const seen = new Set<string>();
  return r.filter((x) => (seen.has(x.key) ? false : (seen.add(x.key), true)));
}

export function rankFragrances(fragrances: Fragrance[], input: ScoreInput): Scored[] {
  return fragrances
    .map((f) => scoreFragrance(f, input))
    .sort((a, b) => b.score - a.score || a.fragrance.name.localeCompare(b.fragrance.name));
}

/** Perfumes not worn for a while (or never), favourites first. */
export function neglected(fragrances: Fragrance[], wears: WearLog[], minDays = 21, now = new Date()): Fragrance[] {
  const last = lastWornMap(wears);
  const today = localDay(now);
  return fragrances
    .filter((f) => {
      const l = last.get(f.id);
      return !l || daysBetween(l, today) >= minDays;
    })
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || (b.rating ?? 0) - (a.rating ?? 0));
}

/** Rough versatility: how many seasons, times and occasions a perfume covers. */
export function versatility(f: Fragrance): number {
  return f.usage.seasons.length * 1.2 + f.usage.times.length + f.usage.occasions.length * 0.8;
}
