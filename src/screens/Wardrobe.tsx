import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../state/store';
import { useI18n } from '../i18n';
import { PerfumeCard, PerfumeRow } from '../components/PerfumeCard';
import { IconChart, IconGrid, IconList, IconPlus, IconSearch, Flower, Sparkle } from '../components/Icons';
import { ChipToggle, Sheet } from '../components/ui';
import { resolveFamily } from '../domain/families';
import { SEASONS, type Season } from '../domain/types';
import { normalizeKey } from '../domain/util';
import { useRelativeDay, useWearInfo } from '../state/hooks';
import { useUi } from '../state/ui';

type SortKey = 'recent' | 'name' | 'brand' | 'rating' | 'worn' | 'lastWorn';
const SORTS: SortKey[] = ['recent', 'name', 'brand', 'rating', 'worn', 'lastWorn'];

function readView(): 'grid' | 'list' {
  try {
    return localStorage.getItem('mpw.view') === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

export function Wardrobe() {
  const { fragrances, importSample } = useStore();
  const { t, tk } = useI18n();
  const { toast } = useUi();
  const { last, counts } = useWearInfo();
  const rel = useRelativeDay();
  const [q, setQ] = useState('');
  const [view, setView] = useState<'grid' | 'list'>(readView);
  const [favOnly, setFavOnly] = useState(false);
  const [families, setFamilies] = useState<string[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [sort, setSort] = useState<SortKey>('recent');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const allFamilies = useMemo(
    () => [...new Set(fragrances.map((f) => resolveFamily(f.family)?.id ?? f.family).filter(Boolean))].sort(),
    [fragrances],
  );

  const list = useMemo(() => {
    const nq = normalizeKey(q);
    const out = fragrances.filter((f) => {
      if (nq && !normalizeKey(`${f.brand} ${f.name} ${f.accords.join(' ')}`).includes(nq)) return false;
      if (favOnly && !f.favorite) return false;
      if (families.length && !families.includes(resolveFamily(f.family)?.id ?? f.family)) return false;
      if (seasons.length && !seasons.some((s) => f.usage.seasons.includes(s))) return false;
      return true;
    });
    const by: Record<SortKey, (a: (typeof out)[0], b: (typeof out)[0]) => number> = {
      recent: (a, b) => b.createdAt.localeCompare(a.createdAt),
      name: (a, b) => a.name.localeCompare(b.name),
      brand: (a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name),
      rating: (a, b) => (b.rating ?? -1) - (a.rating ?? -1),
      worn: (a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0),
      lastWorn: (a, b) => (last.get(b.id) ?? '').localeCompare(last.get(a.id) ?? ''),
    };
    return out.sort(by[sort]);
  }, [fragrances, q, favOnly, families, seasons, sort, counts, last]);

  // Stable collectible numbers: order of addition.
  const numbers = useMemo(() => {
    const m = new Map<string, number>();
    [...fragrances].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).forEach((f, i) => m.set(f.id, i + 1));
    return m;
  }, [fragrances]);

  const setViewPersist = (v: 'grid' | 'list') => {
    setView(v);
    try {
      localStorage.setItem('mpw.view', v);
    } catch {
      /* ignore */
    }
  };

  const activeFilters = (favOnly ? 1 : 0) + families.length + seasons.length;

  if (!fragrances.length) {
    return (
      <main className="page">
        <div className="topbar">
          <h1>{t('wardrobe.title')}</h1>
        </div>
        <div className="empty card card-xl c-lilac dots" style={{ marginTop: 12 }}>
          <div className="row" style={{ justifyContent: 'center' }}>
            <Flower size={90} className="wiggle" />
            <Sparkle size={36} color="var(--lime)" className="float" />
          </div>
          <h2>{t('wardrobe.emptyTitle')}</h2>
          <p style={{ color: 'inherit' }}>{t('wardrobe.emptySub')}</p>
          <Link to="/wardrobe/new" className="btn btn-ink btn-lg">
            <IconPlus />
            {t('wardrobe.add')}
          </Link>
          <button
            className="btn"
            onClick={async () => {
              const n = await importSample();
              toast(t('set.sampleDone', { n }), 'lime');
            }}
          >
            {t('wardrobe.importSample')}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="topbar">
        <h1>{t('wardrobe.title')}</h1>
        <span className="spacer" />
        <Link to="/wardrobe/stats" className="btn btn-icon btn-sm" aria-label={t('wardrobe.stats')}>
          <IconChart />
        </Link>
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <span className="sticker c-lime">{t('wardrobe.count', { n: fragrances.length })}</span>
        <span className="sticker r2 c-pink">
          ♥ {fragrances.filter((f) => f.favorite).length}
        </span>
      </div>

      <div className="search-wrap" style={{ marginBottom: 12 }}>
        <IconSearch />
        <input
          className="input input-pill"
          type="search"
          placeholder={t('wardrobe.search')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={t('common.search')}
        />
      </div>

      <div className="row" style={{ marginBottom: 16 }}>
        <button className="chip" aria-pressed={favOnly} onClick={() => setFavOnly((v) => !v)}>
          ♥ {t('wardrobe.favorites')}
        </button>
        <button className="chip" aria-pressed={activeFilters - (favOnly ? 1 : 0) > 0} onClick={() => setFiltersOpen(true)}>
          {t('common.filters')}
          {families.length + seasons.length > 0 ? ` · ${families.length + seasons.length}` : ''}
        </button>
        <label className="sr-only" htmlFor="sort">
          {t('wardrobe.sort')}
        </label>
        <select id="sort" className="select chip" style={{ width: 'auto', minHeight: 36, padding: '0 12px' }} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {tk(`wardrobe.sort.${s}`)}
            </option>
          ))}
        </select>
        <span className="spacer" />
        <div className="segmented" role="group" aria-label={t('wardrobe.grid')}>
          <button aria-pressed={view === 'grid'} onClick={() => setViewPersist('grid')} aria-label={t('wardrobe.grid')}>
            <IconGrid style={{ width: 18, height: 18 }} />
          </button>
          <button aria-pressed={view === 'list'} onClick={() => setViewPersist('list')} aria-label={t('wardrobe.list')}>
            <IconList style={{ width: 18, height: 18 }} />
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <p>{t('wardrobe.noMatch')}</p>
          <button
            className="btn btn-sm"
            onClick={() => {
              setQ('');
              setFavOnly(false);
              setFamilies([]);
              setSeasons([]);
            }}
          >
            {t('common.clear')}
          </button>
        </div>
      ) : view === 'grid' ? (
        <div className="grid-2 wide-3" data-testid="wardrobe-grid">
          {list.map((f, i) => (
            <PerfumeCard key={f.id} f={f} index={numbers.get(f.id)} i={Math.min(i, 12)} />
          ))}
        </div>
      ) : (
        <div className="stack" style={{ ['--gap' as string]: '10px' }} data-testid="wardrobe-list">
          {list.map((f, i) => (
            <PerfumeRow key={f.id} f={f} i={Math.min(i, 12)} meta={sort === 'worn' ? `×${counts.get(f.id) ?? 0}` : sort === 'lastWorn' ? rel(last.get(f.id)) : undefined} />
          ))}
        </div>
      )}

      <Link to="/wardrobe/new" className="fab" aria-label={t('wardrobe.add')}>
        <IconPlus />
      </Link>

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title={t('common.filters')}>
        <div className="stack">
          <div className="field">
            <span className="label">{t('wardrobe.family')}</span>
            {allFamilies.length ? (
              <ChipToggle options={allFamilies} value={families} onChange={setFamilies} render={(f) => f} />
            ) : (
              <span className="dim small">—</span>
            )}
          </div>
          <div className="field">
            <span className="label">{t('wardrobe.season')}</span>
            <ChipToggle options={SEASONS} value={seasons} onChange={setSeasons} render={(s) => tk(`season.${s}`)} />
          </div>
          <div className="row">
            <button className="btn btn-primary" onClick={() => setFiltersOpen(false)}>
              {t('common.apply')}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setFamilies([]);
                setSeasons([]);
              }}
            >
              {t('common.clear')}
            </button>
          </div>
        </div>
      </Sheet>
    </main>
  );
}
