// Validates catalog/brands/*.json against catalog/SPEC.md and builds
// public/catalog/index.json (the compact file the app loads on demand).
//   node scripts/validate-catalog.mjs          → validate + build
//   node scripts/validate-catalog.mjs --check  → validate only
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const dir = new URL('catalog/brands/', root);
const SOURCE_TYPES = new Set(['official', 'retailer', 'database', 'publication']);
const FACTS = new Set(['notes', 'accords', 'family', 'year', 'perfumer', 'concentration', 'discontinued', 'performance', 'usage']);
const LEVEL = (x) => (Number.isInteger(x) && x >= 1 && x <= 5 ? x : null);
const SEASONS = new Set(['spring', 'summer', 'autumn', 'winter']);
const TIMES = new Set(['morning', 'afternoon', 'evening', 'night']);
const BASES = new Set(['official', 'retailer', 'reviews', 'search']);

const errors = [];
const warnings = [];
const out = [];
const seen = new Set();

// Cut-out bottle photos (scripts/fetch-images.py): "Brand|Name" → {file, page, source, type}.
const imgMapUrl = new URL('catalog/images.json', root);
const images = existsSync(imgMapUrl) ? JSON.parse(readFileSync(imgMapUrl, 'utf8')) : {};
const imgDir = new URL('public/catalog/img/', root);

const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : [];
for (const file of files) {
  let b;
  try {
    b = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
  } catch (e) {
    errors.push(`${file}: invalid JSON (${e.message})`);
    continue;
  }
  const where = (i, msg) => `${file} [${b.fragrances?.[i]?.name ?? i}]: ${msg}`;
  if (!b.brand || !b.slug) errors.push(`${file}: missing brand/slug`);
  if (!Array.isArray(b.fragrances)) {
    errors.push(`${file}: fragrances must be an array`);
    continue;
  }
  b.fragrances.forEach((f, i) => {
    if (!f.name || typeof f.name !== 'string') return errors.push(where(i, 'missing name'));
    const key = `${b.brand}|${f.name}|${f.concentration ?? ''}`.toLowerCase();
    if (seen.has(key)) warnings.push(where(i, 'duplicate entry'));
    seen.add(key);
    const sources = Array.isArray(f.sources) ? f.sources : [];
    const valid = sources.filter((s) => {
      const ok = typeof s?.url === 'string' && /^https?:\/\/[^\s]+$/.test(s.url) && SOURCE_TYPES.has(s.type);
      if (!ok) warnings.push(where(i, `dropped malformed source ${JSON.stringify(s?.url ?? s)}`));
      return ok;
    });
    if (!valid.length) return errors.push(where(i, 'no valid source — entry rejected'));
    const supported = new Set(valid.flatMap((s) => (Array.isArray(s.supports) ? s.supports.filter((x) => FACTS.has(x)) : [])));
    const notes = f.notes ?? {};
    const list = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().toLowerCase()) : []);
    const n = { top: list(notes.top), heart: list(notes.heart), base: list(notes.base), flat: list(notes.flat) };
    const hasNotes = n.top.length + n.heart.length + n.base.length + n.flat.length > 0;
    const strip = (field, fact) => {
      if (f[field] != null && !(Array.isArray(f[field]) && !f[field].length) && !supported.has(fact)) {
        warnings.push(where(i, `${field} removed: no source supports "${fact}"`));
        return true;
      }
      return false;
    };
    const entry = {
      b: b.brand,
      n: f.name.trim(),
      c: f.concentration && !strip('concentration', 'concentration') ? f.concentration : null,
      y: Number.isInteger(f.releaseYear) && !strip('releaseYear', 'year') ? f.releaseYear : null,
      p: f.perfumer && !strip('perfumer', 'perfumer') ? f.perfumer : null,
      f: f.family && !strip('family', 'family') ? f.family : null,
      a: list(f.accords).length && !strip('accords', 'accords') ? list(f.accords).slice(0, 8) : [],
      t: hasNotes && supported.has('notes') ? n : { top: [], heart: [], base: [], flat: [] },
      ns: hasNotes && supported.has('notes') ? (f.noteSource === 'official' && valid.some((s) => s.type === 'official' && s.supports?.includes('notes')) ? 'official' : 'reported') : 'none',
      col: f.collection ?? null,
      d: f.discontinued === true || undefined,
      s: valid.map((s) => ({ u: s.url, n: s.name || new URL(s.url).hostname, t: s.type, f: (s.supports ?? []).filter((x) => FACTS.has(x)) })),
      r: b.retrievedAt ?? null,
    };
    const img = images[`${b.brand}|${f.name}`];
    if (img?.file && existsSync(new URL(img.file, imgDir))) entry.i = { f: img.file, u: img.page, n: img.source || new URL(img.page).hostname, t: img.type || 'official' };
    const pf = f.performance ?? {};
    const perf = { l: LEVEL(pf.longevity), s: LEVEL(pf.sillage), p: LEVEL(pf.projection) };
    if (perf.l || perf.s || perf.p) {
      if (!supported.has('performance')) warnings.push(where(i, 'performance removed: no source supports "performance"'));
      else entry.pf = { ...perf, b: BASES.has(pf.basis) ? pf.basis : 'reviews', e: typeof f.performanceEvidence === 'string' ? f.performanceEvidence.slice(0, 240) : null };
    }
    const us = f.usage ?? {};
    const seasons = list(us.seasons).filter((x) => SEASONS.has(x));
    const times = list(us.times).filter((x) => TIMES.has(x));
    if (seasons.length || times.length) {
      if (!supported.has('usage')) warnings.push(where(i, 'usage removed: no source supports "usage"'));
      else entry.u = { s: seasons, t: times };
    }
    if (hasNotes && !supported.has('notes')) warnings.push(where(i, 'notes removed: no source supports "notes"'));
    out.push(entry);
  });
}

for (const w of warnings) console.warn('warn:', w);
for (const e of errors) console.error('ERROR:', e);
console.log(`\n${files.length} brand files · ${out.length} fragrances accepted · ${warnings.length} warnings · ${errors.length} errors`);

if (!process.argv.includes('--check')) {
  mkdirSync(new URL('public/catalog/', root), { recursive: true });
  const brands = [...new Set(out.map((e) => e.b))].sort();
  writeFileSync(new URL('public/catalog/index.json', root), JSON.stringify({ v: 1, built: new Date().toISOString().slice(0, 10), brands, items: out }));
  console.log('wrote public/catalog/index.json');
}
// Rejected entries are reported as errors but never block the build: they're excluded.
