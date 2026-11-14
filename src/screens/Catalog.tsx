import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../state/store';
import { useI18n } from '../i18n';
import { useUi } from '../state/ui';
import { IconBack, IconPlus, IconSearch } from '../components/Icons';
import { applyCatalog, loadCatalog, searchCatalog, type CatalogIndex, type CatalogItem } from '../services/catalog';
import { blankFragrance, fragranceKey } from '../domain/fragrance';
import { Accord } from '../components/ui';
import { normalizeKey } from '../domain/util';

const PAGE = 40;

export default function Catalog() {
  const { fragrances, saveFragrance } = useStore();
  const { t, tk } = useI18n();
  const { toast } = useUi();
  const nav = useNavigate();
  const [index, setIndex] = useState<CatalogIndex | null>(null);
  const [q, setQ] = useState('');
  const [brand, setBrand] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    void loadCatalog().then(setIndex);
  }, []);
  useEffect(() => setLimit(PAGE), [q, brand]);

  const owned = useMemo(() => new Set(fragrances.map(fragranceKey)), [fragrances]);
  const brandCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of index?.items ?? []) m.set(i.b, (m.get(i.b) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [index]);

  const results = useMemo(() => {
    const items = (index?.items ?? []).filter((i) => !brand || i.b === brand);
    if (q.trim().length >= 2) return searchCatalog(items, q, 200);
    return [...items].sort((a, b) => a.b.localeCompare(b.b) || a.n.localeCompare(b.n));
  }, [index, q, brand]);

  const add = async (item: CatalogItem) => {
    const saved = await saveFragrance(applyCatalog(blankFragrance(), item));
    toast(t('add.addedSub', { name: `${item.b} ${item.n}` }), 'lime');
    return saved;
  };

  return (
    <main className="page catalog">
      <div className="topbar">
        <button className="btn btn-icon btn-sm" onClick={() => nav(-1)} aria-label={t('common.back')}>
          <IconBack />
        </button>
        <h1>{t('cat.title')}</h1>
      </div>
      <p className="dim" style={{ fontWeight: 600, marginBottom: 12 }}>
        {t('cat.sub', { n: index?.items.length ?? 0, b: brandCounts.length })}
      </p>

      <div className="search-wrap" style={{ marginBottom: 12 }}>
        <IconSearch />
        <input className="input input-pill" type="search" placeholder={t('cat.search')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('common.search')} />
      </div>

      <div className="hscroll" style={{ paddingTop: 0 }}>
        <button className="chip" aria-pressed={!brand} onClick={() => setBrand(null)}>
          {t('spin.filter.all')}
        </button>
        {brandCounts.map(([b, n]) => (
          <button key={b} className="chip" aria-pressed={brand === b} onClick={() => setBrand(brand === b ? null : b)}>
            {b} <span className="dim">{n}</span>
          </button>
        ))}
      </div>

      {!index ? (
        <p className="dim">{t('common.loading')}</p>
      ) : index.items.length === 0 ? (
        <p className="dim">{t('cat.empty')}</p>
      ) : results.length === 0 ? (
        <p className="dim">{t('add.catalogNone')}</p>
      ) : (
        <ul className="cat-list" data-testid="catalog-list">
          {results.slice(0, limit).map((i) => {
            const have = owned.has(normalizeKey(`${i.b} ${i.n}`));
            const notes = [...i.t.top, ...i.t.heart, ...i.t.base, ...i.t.flat];
            return (
              <li key={`${i.b}|${i.n}|${i.c ?? ''}|${i.col ?? ''}`} className="cat-row">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span className="kicker dim">
                    {i.b}
                    {i.col ? ` · ${i.col}` : ''}
                  </span>
                  <strong className="display-lc" style={{ display: 'block', fontSize: 16 }}>
                    {i.n}
                  </strong>
                  <span className="tiny dim">
                    {[i.c, i.ns !== 'none' ? tk(`src.${i.ns}`) : t('src.none'), `${i.s.length} ${t('profile.sources').toLowerCase()}`].filter(Boolean).join(' · ')}
                  </span>
                  {notes.length > 0 && (
                    <div className="pcard-accords" style={{ flexWrap: 'wrap', marginTop: 6 }}>
                      {notes.slice(0, 5).map((n) => (
                        <Accord key={n} name={n} />
                      ))}
                    </div>
                  )}
                </div>
                {have ? (
                  <span className="tag" style={{ alignSelf: 'center' }}>
                    ✓ {t('cat.owned')}
                  </span>
                ) : (
                  <button className="btn btn-icon btn-sm btn-lime" style={{ alignSelf: 'center' }} aria-label={`${t('common.add')} ${i.b} ${i.n}`} onClick={() => void add(i)}>
                    <IconPlus />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {results.length > limit && (
        <button className="btn btn-block" style={{ marginTop: 12 }} onClick={() => setLimit((l) => l + PAGE)}>
          {t('cat.more', { n: results.length - limit })}
        </button>
      )}
      <p className="tiny dim" style={{ marginTop: 16 }}>
        {t('cat.note')} {index?.built ? `· ${index.built}` : ''}
      </p>
      <Link to="/wardrobe" className="sr-only">
        {t('nav.wardrobe')}
      </Link>
    </main>
  );
}
