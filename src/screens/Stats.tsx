import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../state/store';
import { useI18n } from '../i18n';
import { collectionStats } from '../domain/stats';
import { IconBack } from '../components/Icons';
import { PerfumeCard } from '../components/PerfumeCard';
import { SEASONS } from '../domain/types';
import { FAMILIES } from '../domain/families';

export default function Stats() {
  const { fragrances, wears } = useStore();
  const { t, tk } = useI18n();
  const nav = useNavigate();
  const s = useMemo(() => collectionStats(fragrances, wears), [fragrances, wears]);
  const maxFam = Math.max(1, ...s.families.map((f) => f.count));
  const maxSeason = Math.max(1, ...Object.values(s.seasons));
  const maxWorn = Math.max(1, ...s.mostWorn.map((m) => m.count));

  return (
    <main className="page stats">
      <div className="topbar">
        <button className="btn btn-icon btn-sm" onClick={() => nav(-1)} aria-label={t('common.back')}>
          <IconBack />
        </button>
        <h1>{t('stats.title')}</h1>
      </div>

      <div className="stat-tiles">
        <div className="stat-tile c-blue dots">
          <span className="display stat-num">{s.total}</span>
          <span className="small">{t('stats.total')}</span>
        </div>
        <div className="stat-tile c-pink">
          <span className="display stat-num">{s.favorites}</span>
          <span className="small">{t('stats.favorites')}</span>
        </div>
        <div className="stat-tile c-lime">
          <span className="display stat-num">{s.totalWears}</span>
          <span className="small">{t('stats.wears')}</span>
        </div>
        <div className="stat-tile c-tangerine dots">
          <span className="display stat-num">{s.avgRating != null ? s.avgRating.toFixed(1) : '—'}</span>
          <span className="small">{t('stats.avgRating')}</span>
        </div>
        <div className="stat-tile c-lilac">
          <span className="display stat-num">{s.distinctWornThisMonth}</span>
          <span className="small">{t('stats.thisMonth')}</span>
        </div>
        <div className="stat-tile c-surface">
          <span className="display stat-num">{s.researched}</span>
          <span className="small">{t('stats.researched')}</span>
        </div>
      </div>

      <section className="section card">
        <h2 className="h-sec">{t('stats.mostWorn')}</h2>
        {s.mostWorn.length === 0 ? (
          <p className="dim small">{t('stats.noWears')}</p>
        ) : (
          <ol className="bars" aria-label={t('stats.mostWorn')}>
            {s.mostWorn.map(({ fragrance, count }, i) => (
              <li key={fragrance.id}>
                <Link to={`/perfume/${fragrance.id}`} className="bar-label">
                  {fragrance.name}
                </Link>
                <span className="bar" style={{ ['--w' as string]: `${(count / maxWorn) * 100}%`, ['--i' as string]: i, ['--c' as string]: 'var(--pink)' }} />
                <span className="bar-val">{count}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="section card">
        <h2 className="h-sec">{t('stats.families')}</h2>
        <ol className="bars">
          {s.families.slice(0, 8).map((f, i) => {
            const color = FAMILIES.find((x) => x.id === f.family)?.color ?? 'lilac';
            return (
              <li key={f.family}>
                <span className="bar-label">{f.family === 'Unknown' ? t('common.unknown') : f.family}</span>
                <span className="bar" style={{ ['--w' as string]: `${(f.count / maxFam) * 100}%`, ['--i' as string]: i, ['--c' as string]: `var(--${color === 'ink' ? 'lilac' : color})` }} />
                <span className="bar-val">{f.count}</span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="section card">
        <h2 className="h-sec">{t('stats.seasons')}</h2>
        <div className="season-cols">
          {SEASONS.map((season, i) => (
            <div key={season} className="season-col">
              <span className="season-val display">{s.seasons[season]}</span>
              <span className="season-bar" style={{ ['--h' as string]: `${(s.seasons[season] / maxSeason) * 100}%`, ['--i' as string]: i }} data-season={season} />
              <span className="tiny" style={{ fontWeight: 800 }}>
                {tk(`season.${season}`)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="h-sec">{t('stats.recent')}</h2>
        <div className="hscroll">
          {s.recentlyAdded.map((f, i) => (
            <PerfumeCard key={f.id} f={f} mini i={i} />
          ))}
        </div>
      </section>
    </main>
  );
}
