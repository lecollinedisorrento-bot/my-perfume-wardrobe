// Deterministic TEST provider used by automated tests only (AI_PROVIDER=mock).
// It is reported everywhere as engine "mock:test-fixture" so it can never be
// mistaken for real AI, and it never claims sources (research → unverified).

import type { AIProvider, RawResearch } from './provider';

export class MockProvider implements AIProvider {
  readonly id = 'mock';
  readonly model = 'test-fixture';
  readonly webResearch = false;

  async identify(req: { query?: string; imageDataUrl?: string }) {
    const q = (req.query ?? '').trim();
    if (!q && req.imageDataUrl) {
      return { status: 'not_found' as const, candidates: [], question: 'Test fixture: please type the name on the label.' };
    }
    if (/irth/i.test(q)) {
      return {
        status: 'ambiguous' as const,
        candidates: [
          { brand: 'Nabeel', name: 'Irth', concentration: 'Eau de Parfum', confidence: 'medium' as const, note: 'Original' },
          { brand: 'Nabeel', name: 'Irth Boom', concentration: 'Eau de Parfum', confidence: 'medium' as const, note: 'Flanker' },
        ],
        question: 'Test fixture: original or Boom?',
      };
    }
    const [brand, ...rest] = q.split(' ');
    return {
      status: 'identified' as const,
      candidates: [{ brand: brand || 'Test', name: rest.join(' ') || 'Fixture', concentration: 'Eau de Parfum', confidence: 'high' as const, note: 'Test fixture' }],
      question: null,
    };
  }

  async research(req: { brand: string; name: string }): Promise<RawResearch> {
    const fresh = /fresh|citrus|aqua|salt|mandarine/i.test(req.name);
    return {
      retrieved: [],
      searchAvailable: false,
      draft: {
        identityMatch: true,
        confidence: 'low',
        concentration: 'Eau de Parfum',
        releaseYear: 2001, // must be dropped by verification (no source)
        perfumer: 'Fixture Perfumer', // must be dropped by verification
        country: null,
        family: fresh ? 'Citrus Aromatic' : 'Amber Woody',
        accords: fresh ? ['citrus', 'aromatic', 'fresh', 'musky'] : ['amber', 'woody', 'warm spicy', 'vanilla'],
        notes: fresh
          ? { top: ['bergamot', 'mandarin'], heart: ['lavender'], base: ['musk'] }
          : { top: ['saffron'], heart: ['rose'], base: ['amber', 'vanilla'] },
        noteSource: 'official', // must be downgraded (no sources)
        character: 'Test fixture character text.',
        evolution: 'Test fixture evolution text.',
        personality: 'Test fixture personality.',
        performance: { longevity: 4, projection: 3, sillage: 3, intensity: 3 },
        usage: fresh
          ? { seasons: ['spring', 'summer'], times: ['morning', 'afternoon'], occasions: ['work', 'casual'], tempMinC: 18, tempMaxC: 34 }
          : { seasons: ['autumn', 'winter'], times: ['evening', 'night'], occasions: ['date', 'nightlife'], tempMinC: -5, tempMaxC: 18 },
        sources: [{ index: 3, name: 'Invented', type: 'official', supports: ['notes'] }], // invalid ref → dropped
      },
    };
  }

  async recommend(req: { collection: { id: string; name: string }[]; external: boolean }) {
    if (req.external) {
      return { picks: [{ id: null, external: { brand: 'Fixture', name: 'External Pick' }, reason: 'Test fixture external.', weatherNote: '' }], summary: 'Test fixture summary.' };
    }
    return {
      picks: req.collection.slice(0, 2).map((c) => ({ id: c.id, external: null, reason: `Test fixture reason for ${c.name}.`, weatherNote: 'Test fixture weather note.' })).concat([{ id: 'not-in-collection', external: null, reason: 'must be filtered', weatherNote: '' }]),
      summary: 'Test fixture summary.',
    };
  }

  async layer(req: { candidates: { id: string }[] }) {
    return {
      suggestions: req.candidates.slice(0, 2).map((c, i) => ({
        secondaryId: c.id,
        order: 'Test fixture order',
        sprayDistribution: '2 chest, 1 neck',
        interaction: 'Test fixture interaction',
        impression: 'Test fixture impression',
        occasions: ['date'],
        conflicts: '',
        explanation: 'Test fixture explanation',
        compatibility: 80 - i * 10,
      })),
    };
  }

  async ask(req: { collection: { id: string }[] }) {
    return { answer: 'Test fixture answer.', mentionedIds: req.collection.slice(0, 1).map((c) => c.id) };
  }
}
