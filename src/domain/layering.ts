// Local layering heuristics (offline fallback). Labelled "Local match" in the
// UI. Compatibility is a subjective vibe score, never a measurement.

import { resolveFamily, traitsFor } from './families';
import type { Combination, Fragrance } from './types';

export interface LayerSuggestion
  extends Omit<Combination, 'id' | 'createdAt' | 'rating' | 'notes' | 'success'> {
  reasonsKeys: string[];
}

function shared(a: string[], b: string[]) {
  const bl = b.map((x) => x.toLowerCase());
  return a.filter((x) => bl.includes(x.toLowerCase()));
}

export function localLayerSuggestion(primary: Fragrance, secondary: Fragrance): LayerSuggestion {
  const ta = traitsFor(primary.family, primary.accords);
  const tb = traitsFor(secondary.family, secondary.accords);
  const common = shared(primary.accords, secondary.accords);
  const notesA = [...primary.notes.top, ...primary.notes.heart, ...primary.notes.base];
  const notesB = [...secondary.notes.top, ...secondary.notes.heart, ...secondary.notes.base];
  const commonNotes = shared(notesA, notesB);
  const reasons: string[] = [];
  let score = 50;

  if (common.length) {
    score += Math.min(20, common.length * 7);
    reasons.push('lab.r.sharedAccords');
  }
  if (commonNotes.length) {
    score += Math.min(10, commonNotes.length * 4);
    reasons.push('lab.r.bridge');
  }
  const freshGap = Math.abs(ta.freshness - tb.freshness);
  if (freshGap > 0.45 && Math.max(ta.weight, tb.weight) > 0.6) {
    score += 8;
    reasons.push('lab.r.contrast');
  }
  let conflictKey = '';
  if (ta.weight > 0.8 && tb.weight > 0.8) {
    score -= 18;
    conflictKey = 'lab.c.heavy';
  } else if (ta.sweetness > 0.75 && tb.sweetness > 0.75) {
    score -= 14;
    conflictKey = 'lab.c.sweet';
  } else if (ta.freshness > 0.85 && tb.freshness > 0.85 && !common.length) {
    score -= 6;
    conflictKey = 'lab.c.fleeting';
  }
  if (!ta.known || !tb.known) {
    score = Math.min(score, 55);
    reasons.push('lab.r.unknown');
  }
  if (primary.id === secondary.id) score = 40;
  score = Math.max(5, Math.min(92, Math.round(score)));

  // Heavier goes on first (closer to skin), lighter on top.
  const heavierFirst = ta.weight >= tb.weight;
  const base = heavierFirst ? primary : secondary;
  const top = heavierFirst ? secondary : primary;
  const famA = resolveFamily(primary.family)?.id ?? (primary.family || '—');
  const famB = resolveFamily(secondary.family)?.id ?? (secondary.family || '—');
  const occasions: string[] = [];
  const avgWeight = (ta.weight + tb.weight) / 2;
  if (avgWeight < 0.45) occasions.push('casual', 'work');
  else if (avgWeight < 0.7) occasions.push('date', 'casual');
  else occasions.push('nightlife', 'special');

  return {
    primaryId: primary.id,
    secondaryId: secondary.id,
    order: `${base.brand} ${base.name} → ${top.brand} ${top.name}`,
    sprayDistribution: `1–2 × ${base.name} (chest), 1–2 × ${top.name} (neck / wrists)`,
    interaction: common.length ? common.slice(0, 3).join(' · ') : `${famA} × ${famB}`,
    impression: '',
    occasions,
    conflicts: conflictKey,
    explanation: '',
    compatibility: score,
    engine: 'local',
    reasonsKeys: reasons,
  };
}

export function rankLocalPartners(primary: Fragrance, all: Fragrance[]): LayerSuggestion[] {
  return all
    .filter((f) => f.id !== primary.id)
    .map((f) => localLayerSuggestion(primary, f))
    .sort((a, b) => b.compatibility - a.compatibility);
}
