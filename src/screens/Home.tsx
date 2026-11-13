import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore, useAiState } from '../state/store';
import { useI18n } from '../i18n';
import { useRanking, useRelativeDay } from '../state/hooks';
import { BottleImage } from '../components/BottleImage';
import { PerfumeCard } from '../components/PerfumeCard';
import { WeatherPill, WeatherSheet } from '../components/Weather';
import { AiLoader, EngineTag, SectionHead } from '../components/ui';
import { Burst, Flower, IconGear, IconWheel, IconFlask, IconSparkle, Sparkle } from '../components/Icons';
import { MOODS, type Fragrance } from '../domain/types';
import { localDay, timeOfDay } from '../domain/util';
import { neglected } from '../domain/recommend';
import { useUi } from '../state/ui';
import { api, aiErrorMessage, contextBase, toCollectionItem, toPrefsCtx } from '../services/api';
import { useAiConsent } from '../components/AiConsent';
import { MoodArt, MOOD_COLORS } from './moods';
import { vibrate } from '../services/feedback';

export function Home() {
  const { fragrances, prefs, wears, combinations, wearToday, weather } = useStore();
  const { t, tk, locale, lang } = useI18n();
  const nav = useNavigate();
  const { toast, confetti } = useUi();
  const ai = useAiState();
  const consent = useAiConsent();
  const rel = useRelativeDay();
  const [wxOpen, setWxOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [aiPick, setAiPick] = useState<{ id: string; reason: string; weatherNote: string; engine: string } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const ctx = useMemo(() => ({}), []);
  const ranked = useRanking(ctx);
  const today = localDay();
  const wornToday = wears.filter((w) => w.day === today);
  const local = ranked.length ? ranked[offset % ranked.length] : null;
  const pick: Fragrance | null = aiPick ? fragrances.find((f) => f.id === aiPick.id) ?? null : local?.fragrance ?? null;
  const tod = timeOfDay();
  const name = prefs.name.trim() || t('home.hi.anon');
  const now = new Date();
  const issue = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);

  const recent = useMemo(
    () =>
      [...wears]
        .sort((a, b) => b.at.localeCompare(a.at))
        .map((w) => ({ w, f: fragrances.find((f) => f.id === w.fragranceId) }))
        .filter((x) => x.f)
        .slice(0, 5),
    [wears, fragrances],
  );
  const favCombos = useMemo(
    () =>
      combinations
        .filter((c) => c.success === true || (c.rating ?? 0) >= 4)
        .concat(combinations.filter((c) => !(c.success === true || (c.rating ?? 0) >= 4)))
        .slice(0, 4),
    [combinations],
  );
  const shelfWhispers = useMemo(() => neglected(fragrances, wears).slice(0, 6), [fragrances, wears]);

  const askAi = async () => {
    if (!(await consent.ensure())) return;
    setAiBusy(true);
    try {
      const res = await api.recommend({
        collection: fragrances.map((f) => toCollectionItem(f, wears)),
        context: { ...contextBase(weather), timeOfDay: tod, query: 'What should I wear today?' },
        prefs: toPrefsCtx(prefs),
        external: false,
        lang,
      });
      const first = res.picks.find((p) => p.id);
      if (first?.id) setAiPick({ id: first.id, reason: first.reason, weatherNote: first.weatherNote, engine: res.engine });
    } catch (e) {
      toast(t('ai.error', { msg: aiErrorMessage(e, lang) }), 'error');
    } finally {
      setAiBusy(false);
    }
  };

  const wear = async (f: Fragrance, e: React.MouseEvent) => {
    await wearToday(f.id, aiPick ? 'recommendation' : 'recommendation');
    vibrate(20);
    confetti({ x: e.clientX, y: e.clientY });
    toast(`${t('home.worn')}: ${f.name}`, 'lime');
  };

  return (
    <main className="page home">
      <header className="row nowrap" style={{ marginBottom: 6 }}>
        <span className="kicker dim">{t('home.kicker', { n: issue, date: now.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' }) })}</span>
        <span className="spacer" />
        <WeatherPill onClick={() => setWxOpen(true)} />
        <Link to="/settings" className="btn btn-icon btn-sm" aria-label={t('common.settings')}>
          <IconGear />
        </Link>
      </header>

      <h1 className="home-hello">
        {tk(`home.hi.${tod}`, { name })}
        <Sparkle size={30} color="var(--lime)" className="home-hello-spark float" />
      </h1>

      {fragrances.length === 0 ? (
        <section className="card card-xl c-pink dots home-empty">
          <Flower size={110} className="wiggle" />
          <h2 className="display" style={{ fontSize: 26 }}>
            {t('home.emptyTitle')}
          </h2>
          <p style={{ fontWeight: 600 }}>{t('home.emptySub')}</p>
          <Link to="/wardrobe/new" className="btn btn-ink btn-lg">
            {t('home.addFirst')}
          </Link>
        </section>
      ) : (
        <section className="today card card-xl c-blue dots" aria-labelledby="today-h" data-testid="today-card">
          <div className="today-head">
            <h2 id="today-h" className="serif" style={{ fontSize: 30 }}>
              {t('home.todaySmells')}
            </h2>
            <Burst size={70} color="var(--lime)" className="today-burst rot-label">
              <span className="display" style={{ fontSize: 10, color: 'var(--ink)' }}>
                {String(new Date().getDate()).padStart(2, '0')}
              </span>
            </Burst>
          </div>
          {aiBusy ? (
            <AiLoader title={t('ai.thinking')} />
          ) : (
            pick && (
              <>
                <Link to={`/perfume/${pick.id}`} className="today-pick">
                  <div className="today-bottle">
                    <BottleImage fragrance={pick} />
                  </div>
                  <div className="stack" style={{ ['--gap' as string]: '4px', minWidth: 0 }}>
                    <span className="kicker">{pick.brand}</span>
                    <span className="display today-name">{pick.name}</span>
                    {pick.accords.length > 0 && <span className="small dim">{pick.accords.slice(0, 3).join(' · ')}</span>}
                  </div>
                </Link>
                <ul className="today-why">
                  {aiPick ? (
                    <>
                      <li>{aiPick.reason}</li>
                      {aiPick.weatherNote && <li>{aiPick.weatherNote}</li>}
                    </>
                  ) : (
                    local?.reasons.slice(0, 3).map((r) => <li key={r.key}>{tk(r.key, translateParams(r.params, tk))}</li>)
                  )}
                </ul>
                <div className="row" style={{ marginTop: 4 }}>
                  <EngineTag engine={aiPick ? aiPick.engine : 'local'} />
                </div>
              </>
            )
          )}
          <div className="row today-actions">
            {pick && (
              <button className="btn btn-lime" onClick={(e) => void wear(pick, e)} disabled={wornToday.some((w) => w.fragranceId === pick.id)}>
                {wornToday.some((w) => w.fragranceId === pick.id) ? t('profile.wornToday') : t('home.wearIt')}
              </button>
            )}
            <button
              className="btn"
              onClick={() => {
                setAiPick(null);
                setOffset((o) => o + 1);
              }}
            >
              {t('home.another')}
            </button>
            {ai.available && (
              <button className="btn btn-pink" onClick={() => void askAi()} disabled={aiBusy}>
                <IconSparkle />
                {t('home.askAi')}
              </button>
            )}
          </div>
        </section>
      )}

      <section className="section">
        <SectionHead title={t('home.mood')} action={<Link to="/discover">{t('common.seeAll')}</Link>} />
        <div className="hscroll">
          {MOODS.map((m, i) => (
            <button key={m} className={`mood-mini c-${MOOD_COLORS[m]}`} onClick={() => nav(`/discover?mood=${m}`)} style={{ ['--i' as string]: i }}>
              <MoodArt mood={m} size={44} />
              <span className="display">{tk(`mood.${m}`)}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="section grid-2">
        <Link to="/spin" className="card card-press c-pink feature-card" data-testid="surprise-card">
          <IconWheel className="feature-icon spin-idle" />
          <h3 className="display" style={{ fontSize: 20 }}>
            {t('home.surprise')}
          </h3>
          <p className="small dim">{t('home.surpriseSub')}</p>
        </Link>
        <Link to="/lab" className="card card-press c-lime feature-card">
          <IconFlask className="feature-icon" />
          <h3 className="display" style={{ fontSize: 20 }}>
            {t('home.readyToMix')}
          </h3>
          <p className="small dim">{t('lab.sub')}</p>
        </Link>
      </section>

      {wornToday.length > 0 && (
        <section className="section">
          <SectionHead title={t('home.wornToday')} />
          <div className="chips">
            {wornToday.map((w) => {
              const f = fragrances.find((x) => x.id === w.fragranceId);
              const s = w.secondaryId ? fragrances.find((x) => x.id === w.secondaryId) : null;
              return f ? (
                <Link key={w.id} to={`/perfume/${f.id}`} className="chip on">
                  {f.name}
                  {s ? ` + ${s.name}` : ''}
                </Link>
              ) : null;
            })}
          </div>
        </section>
      )}

      {fragrances.length > 0 && (
        <section className="section">
          <SectionHead title={t('home.collection')} action={<Link to="/wardrobe">{t('common.seeAll')}</Link>} />
          <div className="hscroll">
            {[...fragrances]
              .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.createdAt.localeCompare(a.createdAt))
              .slice(0, 10)
              .map((f, i) => (
                <PerfumeCard key={f.id} f={f} mini i={i} />
              ))}
          </div>
        </section>
      )}

      <section className="section">
        <SectionHead title={t('home.recent')} />
        {recent.length === 0 ? (
          <p className="dim small">{t('home.recentEmpty')}</p>
        ) : (
          <ol className="diary">
            {recent.map(({ w, f }) => (
              <li key={w.id}>
                <Link to={`/perfume/${f!.id}`} className="diary-row">
                  <span className="diary-day">{rel(w.day)}</span>
                  <span className="diary-name">
                    <strong>{f!.name}</strong> <span className="dim">· {f!.brand}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      {shelfWhispers.length > 0 && fragrances.length > 2 && (
        <section className="section">
          <SectionHead title={t('home.nextObsession')} />
          <p className="dim small" style={{ marginTop: -6, marginBottom: 10 }}>
            {t('home.neglectedSub')}
          </p>
          <div className="hscroll">
            {shelfWhispers.map((f, i) => (
              <PerfumeCard key={f.id} f={f} mini i={i} />
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <SectionHead title={t('home.combos')} action={<Link to="/lab">{t('nav.lab')}</Link>} />
        {favCombos.length === 0 ? (
          <p className="dim small">{t('home.combosEmpty')}</p>
        ) : (
          <div className="stack" style={{ ['--gap' as string]: '10px' }}>
            {favCombos.map((c) => {
              const a = fragrances.find((f) => f.id === c.primaryId);
              const b = fragrances.find((f) => f.id === c.secondaryId);
              if (!a || !b) return null;
              return (
                <Link key={c.id} to={`/lab?combo=${c.id}`} className="combo-row">
                  <span className="combo-bottles">
                    <BottleImage fragrance={a} />
                    <BottleImage fragrance={b} />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <strong>{a.name}</strong> + <strong>{b.name}</strong>
                    <span className="tiny dim" style={{ display: 'block' }}>
                      {t('lab.score')} {c.compatibility}
                      {c.success === true ? ` · ${t('lab.success')}` : ''}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="section">
        <Link to="/discover" className="card card-press c-tangerine dots feature-wide">
          <div>
            <h3 className="display" style={{ fontSize: 24 }}>
              {t('home.discover')}
            </h3>
            <p className="small dim">{t('home.discoverSub')}</p>
          </div>
          <Flower size={72} color="var(--lilac)" className="wiggle" />
        </Link>
      </section>

      <WeatherSheet open={wxOpen} onClose={() => setWxOpen(false)} />
      {consent.element}
    </main>
  );
}

/** Reason params may contain enum ids (season/time/occasion/mood) — translate them. */
export function translateParams(
  params: Record<string, string | number> | undefined,
  tk: (k: string, p?: Record<string, string | number>) => string,
): Record<string, string | number> | undefined {
  if (!params) return params;
  const out: Record<string, string | number> = { ...params };
  if (typeof out.season === 'string') out.season = tk(`season.${out.season}`).toLowerCase();
  if (typeof out.time === 'string') out.time = tk(`time.${out.time}`).toLowerCase();
  if (typeof out.occasion === 'string') {
    const k = `occ.${out.occasion}`;
    const tr = tk(k);
    out.occasion = (tr === k ? String(out.occasion) : tr).toLowerCase();
  }
  if (typeof out.mood === 'string') out.mood = tk(`mood.${out.mood}`);
  return out;
}
