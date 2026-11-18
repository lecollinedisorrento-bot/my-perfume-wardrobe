import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../state/store';
import { useI18n } from '../i18n';
import { collectionStats } from '../domain/stats';
import { IconBack } from '../components/Icons';
import { PerfumeCard } from '../components/PerfumeCard';
import { SEASONS, type Season } from '../domain/types';
import { FAMILIES } from '../domain/families';

export default function Stats() {
  const { fragrances, wears } = useStore();
  const { t, tk, fam } = useI18n();
  const nav = useNavigate();
  const s = useMemo(() => collectionStats(fragrances, wears), [fragrances, wears]);
  const maxFam = Math.max(1, ...s.families.map((f) => f.count));
  const maxSeason = Math.max(1, ...Object.values(s.seasons));
  const maxWorn = Math.max(1, ...s.mostWorn.map((m) => m.count));
  const [openSeason, setOpenSeason] = useState<Season | null>(null);
  const insight = useMemo(() => {
    const summer = new Set(s.seasonMembers.summer.map((m) => m.id));
    const cold = new Set([...s.seasonMembers.autumn, ...s.seasonMembers.winter].map((m) => m.id));
    const warm = [...cold].filter((id) => !summer.has(id)).length;
    const fresh = summer.size;
    const mood =
      s.total === 0
        ? t('stats.moodEmpty')
        : warm > fresh * 1.5
          ? t('stats.moodWarm', { n: warm, total: s.total, fresh })
          : fresh > warm * 1.5
            ? t('stats.moodFresh', { n: fresh, total: s.total, warm })
            : t('stats.moodBalanced', { warm, fresh });
    const have = new Set(s.families.map((f) => f.family));
    const missing = ['Citrus', 'Aquatic', 'Green', 'Floral', 'Woody', 'Powdery', 'Spicy', 'Leather', 'Amber', 'Gourmand'].filter((x) => !have.has(x));
    return { mood, summer: s.seasonMembers.summer.map((m) => m.name), missing: s.total ? missing : [] };
  }, [s, t]);

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

      <section className="section card c-lilac insight" data-testid="stats-insight">
        <h2 className="h-sec">{t('stats.character')}</h2>
        <p>{insight.mood}</p>
        {insight.summer.length > 0 && (
          <p className="small">
            <strong>{t('stats.forHeat')}</strong> {insight.summer.join(', ')}
          </p>
        )}
        {insight.missing.length > 0 && (
          <p className="small">
            <strong>{t('stats.missing')}</strong> {insight.missing.map((m) => fam(m)).join(', ')}
          </p>
        )}
      </section>

      <section className="section card">
        <h2 className="h-sec">{t('stats.families')}</h2>
        <ol className="bars bars-fam">
          {s.families.slice(0, 10).map((f, i) => {
            const color = FAMILIES.find((x) => x.id === f.family)?.color ?? 'lilac';
            return (
              <li key={f.family}>
                <span className="bar-label">{f.family === 'Unknown' ? t('common.unknown') : fam(f.family)}</span>
                <span className="bar" style={{ ['--w' as string]: `${(f.count / maxFam) * 100}%`, ['--i' as string]: i, ['--c' as string]: `var(--${color === 'ink' ? 'lilac' : color})` }} />
                <span className="bar-val">{f.count}</span>
                <span className="bar-members tiny dim">
                  {f.members.map((m, j) => (
                    <span key={m.id}>
                      {j > 0 && ' · '}
                      <Link to={`/perfume/${m.id}`}>{m.name}</Link>
                    </span>
                  ))}
                </span>
              </li>
            );
          })}
        </ol>
        {s.estimatedFamilies > 0 && <p className="tiny dim" style={{ marginTop: 12 }}>{t('stats.estimatedNote', { n: s.estimatedFamilies })}</p>}
      </section>

      <section className="section card">
        <h2 className="h-sec">{t('stats.seasons')}</h2>
        <div className="season-cols">
          {SEASONS.map((season, i) => (
            <button
              key={season}
              type="button"
              className={`season-col${openSeason === season ? ' on' : ''}`}
              onClick={() => setOpenSeason(openSeason === season ? null : season)}
              aria-expanded={openSeason === season}
            >
              <span className="season-val display">{s.seasons[season]}</span>
              <span className="season-bar" style={{ ['--h' as string]: `${(s.seasons[season] / maxSeason) * 100}%`, ['--i' as string]: i }} data-season={season} />
              <span className="tiny" style={{ fontWeight: 800 }}>
                {tk(`season.${season}`)}
              </span>
            </button>
          ))}
        </div>
        <p className="tiny dim" style={{ marginTop: 12 }}>
          {openSeason
            ? s.seasonMembers[openSeason].map((m) => m.name).join(' · ') || t('stats.noneSeason')
            : t('stats.tapSeason')}
        </p>
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
