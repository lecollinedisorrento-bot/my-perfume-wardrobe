import { describe, expect, it } from 'vitest';
import { applyCatalog, catalogResearch, findCatalogMatch, searchCatalog, type CatalogItem } from '../../src/services/catalog';
import { blankFragrance } from '../../src/domain/fragrance';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const item = (over: Partial<CatalogItem> = {}): CatalogItem => ({
  b: 'Electimuss',
  n: 'Mercurial Cashmere',
  c: 'Pure Parfum',
  y: 2018,
  p: null,
  f: 'Woody Floral Musk',
  a: ['musky', 'woody'],
  t: { top: ['bergamot'], heart: ['rose'], base: ['musk'], flat: [] },
  ns: 'official',
  col: null,
  s: [{ u: 'https://electimuss.example/mc', n: 'Electimuss', t: 'official', f: ['notes', 'year', 'concentration'] }],
  r: '2026-11-14',
  ...over,
});

const items = [
  item(),
  item({ n: 'Mercurial Cashmere Extrait', c: null, ns: 'reported', s: [{ u: 'https://db.example/x', n: 'DB', t: 'database', f: ['notes'] }] }),
  item({ b: 'Nabeel', n: 'Irth', ns: 'none', t: { top: [], heart: [], base: [], flat: [] }, s: [{ u: 'https://nabeel.example/irth', n: 'Nabeel', t: 'official', f: [] }] }),
  item({ b: 'Nabeel', n: 'Irth Boom' }),
];

describe('catalogue search', () => {
  it('matches all words across brand and name, best first', () => {
    expect(searchCatalog(items, 'mercurial').map((i) => i.n)).toEqual(['Mercurial Cashmere', 'Mercurial Cashmere Extrait']);
    expect(searchCatalog(items, 'nabeel irth')[0].n).toBe('Irth');
    expect(searchCatalog(items, 'irth boom').map((i) => i.n)).toEqual(['Irth Boom']);
    expect(searchCatalog(items, 'zzz')).toEqual([]);
    expect(searchCatalog(items, '')).toEqual([]);
  });
  it('is accent and case insensitive', () => {
    expect(searchCatalog([item({ n: 'Fougère Royale' })], 'FOUGERE')).toHaveLength(1);
  });
  it('finds exact shelf matches', () => {
    expect(findCatalogMatch(items, 'nabeel', 'irth boom')?.n).toBe('Irth Boom');
    expect(findCatalogMatch(items, 'Nabeel', 'Irth B')).toBeNull();
  });
});

describe('catalogue → profile', () => {
  it('fills facts with provenance and keeps personal data', () => {
    const base = blankFragrance({ brand: 'x', name: 'y', favorite: true, personalNotes: 'mine', rating: 4 });
    const f = applyCatalog(base, items[0]);
    expect(f).toMatchObject({ brand: 'Electimuss', name: 'Mercurial Cashmere', releaseYear: 2018, noteSource: 'official', favorite: true, personalNotes: 'mine', rating: 4, concentration: 'Parfum' });
    expect(f.research).toMatchObject({ status: 'verified', engine: 'catalog', confidence: 'high' });
    expect(f.research!.sources[0]).toMatchObject({ url: 'https://electimuss.example/mc', type: 'official' });
  });
  it('computes honest status', () => {
    expect(catalogResearch(items[1]).status).toBe('partially_verified');
    expect(catalogResearch(items[2]).status).toBe('unverified');
  });
});

describe('validator', () => {
  it('rejects sourceless entries and strips unsupported facts', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cat-'));
    mkdirSync(join(dir, 'catalog/brands'), { recursive: true });
    mkdirSync(join(dir, 'scripts'));
    cpSync('scripts/validate-catalog.mjs', join(dir, 'scripts/validate-catalog.mjs'));
    writeFileSync(
      join(dir, 'catalog/brands/t.json'),
      JSON.stringify({
        brand: 'T',
        slug: 't',
        fragrances: [
          { name: 'No Source', notes: { top: ['a'] }, sources: [] },
          { name: 'Bad Url', sources: [{ url: 'not a url', type: 'official', supports: ['notes'] }] },
          {
            name: 'Ok',
            releaseYear: 2001,
            perfumer: 'Someone',
            notes: { top: ['Lemon'], heart: [], base: [] },
            noteSource: 'official',
            sources: [{ url: 'https://shop.example/ok', type: 'retailer', supports: ['notes'] }],
          },
        ],
      }),
    );
    execFileSync('node', [join(dir, 'scripts/validate-catalog.mjs')], { cwd: dir, stdio: 'pipe' });
    const idx = JSON.parse(readFileSync(join(dir, 'public/catalog/index.json'), 'utf8'));
    expect(idx.items).toHaveLength(1);
    expect(idx.items[0]).toMatchObject({ n: 'Ok', y: null, p: null, ns: 'reported', t: { top: ['lemon'] } });
  });
});
