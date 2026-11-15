import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CURATED_AVOID, CURATED_PAIRINGS } from '../../src/domain/pairings';
import { SAMPLE_COLLECTION, fragranceKey } from '../../src/domain/fragrance';

const dir = join(__dirname, '../../catalog/brands');
const catalogue = new Set(
  readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => {
      const b = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      return b.fragrances.map((x: { name: string }) => fragranceKey({ brand: b.brand, name: x.name }));
    }),
);

describe('hand-studied pairings', () => {
  it('only name perfumes that exist in the catalogue', () => {
    for (const c of CURATED_PAIRINGS) {
      expect(catalogue.has(fragranceKey(c.base)), `${c.base.brand} ${c.base.name}`).toBe(true);
      expect(catalogue.has(fragranceKey(c.top)), `${c.top.brand} ${c.top.name}`).toBe(true);
    }
    for (const a of CURATED_AVOID) {
      expect(catalogue.has(fragranceKey(a.a))).toBe(true);
      expect(catalogue.has(fragranceKey(a.b))).toBe(true);
    }
  });

  it('never both recommends and advises against the same pair', () => {
    const pair = (x: { brand: string; name: string }, y: { brand: string; name: string }) => [fragranceKey(x), fragranceKey(y)].sort().join('|');
    const good = new Set(CURATED_PAIRINGS.map((c) => pair(c.base, c.top)));
    for (const a of CURATED_AVOID) expect(good.has(pair(a.a, a.b))).toBe(false);
    expect(good.size).toBe(CURATED_PAIRINGS.length); // no duplicates
  });

  it('covers every perfume of the sample wardrobe at least once', () => {
    const used = new Set(CURATED_PAIRINGS.flatMap((c) => [fragranceKey(c.base), fragranceKey(c.top)]));
    const missing = SAMPLE_COLLECTION.filter((s) => !used.has(fragranceKey(s)) && !['Irth'].includes(s.name));
    expect(missing).toEqual([]);
  });

  it('has text in both languages and a sane score', () => {
    for (const c of CURATED_PAIRINGS) {
      for (const l of ['it', 'en'] as const) for (const k of ['title', 'spray', 'why', 'feel'] as const) expect(c[l][k].length).toBeGreaterThan(5);
      expect(c.score).toBeGreaterThanOrEqual(50);
      expect(c.score).toBeLessThanOrEqual(95);
    }
  });
});
