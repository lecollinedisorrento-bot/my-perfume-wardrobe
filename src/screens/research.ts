import type { ResearchResponse } from '../shared/api';
import { CONCENTRATIONS, type Concentration, type Fragrance, type Level } from '../domain/types';

export function matchConcentration(raw: string, fallback: Concentration): Concentration {
  const s = raw.toLowerCase();
  if (!s || s === 'unknown') return fallback;
  if (s.includes('extrait')) return 'Extrait de Parfum';
  if (s.includes('elixir')) return 'Elixir';
  if (s.includes('cologne') && !s.includes('parfum')) return 'Eau de Cologne';
  if (s.includes('toilette') || s === 'edt') return 'Eau de Toilette';
  if (s.includes('eau de parfum') || s === 'edp') return 'Eau de Parfum';
  if (s.includes('attar') || s.includes('oil')) return 'Attar / Oil';
  if (s.includes('parfum') || s.includes('pure perfume')) return 'Parfum';
  const exact = CONCENTRATIONS.find((c) => c.toLowerCase() === s);
  return exact ?? 'Other';
}

const lvl = (v: number | null): Level | undefined => (v == null ? undefined : (Math.max(1, Math.min(5, Math.round(v))) as Level));

/** Merges a verified research result into a fragrance, keeping all personal data. */
export function applyResearch(f: Fragrance, r: ResearchResponse): Fragrance {
  const p = r.profile;
  return {
    ...f,
    concentration: matchConcentration(p.concentration, f.concentration),
    releaseYear: p.releaseYear,
    perfumer: p.perfumer,
    country: p.country,
    family: p.family || f.family,
    accords: p.accords,
    notes: { ...p.notes, flat: [] },
    noteSource: p.notes.top.length + p.notes.heart.length + p.notes.base.length ? p.noteSource : 'none',
    character: p.character,
    evolution: p.evolution,
    personality: p.personality,
    performance:
      f.performance.basis === 'user'
        ? f.performance
        : {
            basis: 'estimate',
            longevity: lvl(p.performance.longevity),
            projection: lvl(p.performance.projection),
            sillage: lvl(p.performance.sillage),
            intensity: lvl(p.performance.intensity),
          },
    usage: {
      seasons: p.usage.seasons as Fragrance['usage']['seasons'],
      times: p.usage.times as Fragrance['usage']['times'],
      occasions: p.usage.occasions as Fragrance['usage']['occasions'],
      tempMinC: p.usage.tempMinC ?? undefined,
      tempMaxC: p.usage.tempMaxC ?? undefined,
    },
    research: {
      status: r.research.status,
      confidence: r.research.confidence,
      sources: r.research.sources,
      researchedAt: r.research.researchedAt,
      engine: r.research.engine,
      droppedUnsupported: r.research.droppedUnsupported,
    },
  };
}
