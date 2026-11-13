import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStore, useAiState } from '../state/store';
import { useI18n, type MessageKey } from '../i18n';
import { useUi } from '../state/ui';
import { BottleImage } from '../components/BottleImage';
import { AiLoader, ChipToggle, EngineTag, Notice, Segmented, Toggle } from '../components/ui';
import { IconSparkle } from '../components/Icons';
import { MOODS, OCCASIONS, TIMES, type Fragrance, type Mood, type RecommendationContext, type TimeOfDay } from '../domain/types';
import { FAMILIES, familyColor } from '../domain/families';
import { rankFragrances, neglected, versatility } from '../domain/recommend';
import { manualWeather } from '../domain/weather';
import { api, aiErrorMessage, contextBase, toCollectionItem, toPrefsCtx, toWeatherCtx } from '../services/api';
import { useAiConsent } from '../components/AiConsent';
import { describeWeather, useTemp } from '../components/Weather';
import { MoodArt, MOOD_COLORS } from './moods';
import { translateParams } from './Home';
import { saveRecommendation } from '../db/repo';
import { nowIso, uid, timeOfDay } from '../domain/util';
import { PerfumeCard } from '../components/PerfumeCard';

interface Result {
  engine: string;
  summary: string;
  picks: { f?: Fragrance; external?: { brand: string; name: string }; reason: string; weatherNote?: string }[];
  weatherUsed: string | null;
}

const QUESTIONS: MessageKey[] = [
  'discover.q.today',
  'discover.q.hot',
  'discover.q.versatile',
  'discover.q.unusual',
  'discover.q.personality',
  'discover.q.neglect',
  'discover.q.date',
  'discover.q.similar',
];

export default function Discover() {
  const { fragrances, wears, prefs, weather, learning, wearToday } = useStore();
  const { t, tk, lang } = useI18n();
  const { toast } = useUi();
  const ai = useAiState();
  const consent = useAiConsent();
  const fmt = useTemp();
  const [params] = useSearchParams();
  const [mood, setMood] = useState<Mood | null>((params.get('mood') as Mood) ?? null);
  const [occasion, setOccasion] = useState<string[]>([]);
  const [time, setTime] = useState<TimeOfDay[]>([]);
  const [intensity, setIntensity] = useState<'any' | 'soft' | 'moderate' | 'loud'>('any');
  const [family, setFamily] = useState<string[]>([]);
  const [impression, setImpression] = useState('');
  const [query, setQuery] = useState('');
  const [external, setExternal] = useState(false);
  const [wxMode, setWxMode] = useState<'live' | 'manual'>(weather && !weather.manual ? 'live' : 'manual');
  const [mTemp, setMTemp] = useState(weather?.tempC != null ? Math.round(weather.tempC) : 20);
  const [mRain, setMRain] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [answer, setAnswer] = useState<{ q: string; text: string; ids: string[]; engine: string } | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const m = params.get('mood') as Mood | null;
    if (m && (MOODS as readonly string[]).includes(m)) setMood(m);
  }, [params]);

  const usedWeather = useMemo(
    () => (wxMode === 'live' && weather ? weather : manualWeather(mTemp, { rainy: mRain })),
    [wxMode, weather, mTemp, mRain],
  );

  const context: RecommendationContext = {
    mood,
    occasion: occasion[0] ?? null,
    timeOfDay: time[0] ?? null,
    intensity: intensity === 'any' ? null : intensity,
    impression: impression || null,
    family: family[0] ?? null,
    weather: usedWeather,
    query: query || null,
    external,
  };

  const scrollToResults = () => setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);

  const runLocal = (why?: string): Result => {
    const ranked = rankFragrances(fragrances, { context, prefs, wears, learning }).slice(0, 3);
    if (why) setNotice(why);
    return {
      engine: 'local',
      summary: '',
      picks: ranked.map((r) => ({
        f: r.fragrance,
        reason: r.reasons.map((x) => tk(x.key, translateParams(x.params, tk))).join(' · ') || '—',
      })),
      weatherUsed: describeWeather(usedWeather, tk, fmt),
    };
  };

  const go = async () => {
    setNotice(null);
    setAnswer(null);
    if (!ai.available) {
      setResult(runLocal(ai.reason === 'offline' ? t('ai.offline') : ai.reason === 'not_configured' ? t('ai.notConfigured') : undefined));
      scrollToResults();
      return;
    }
    if (!(await consent.ensure())) {
      setResult(runLocal());
      return;
    }
    setBusy(true);
    scrollToResults();
    try {
      const res = await api.recommend({
        collection: fragrances.map((f) => toCollectionItem(f, wears)),
        context: {
          ...contextBase(usedWeather),
          weather: toWeatherCtx(usedWeather),
          mood: mood ? tk(`mood.${mood}`) : null,
          occasion: context.occasion,
          timeOfDay: context.timeOfDay ?? timeOfDay(),
          intensity: context.intensity,
          impression: context.impression,
          family: context.family,
          query: context.query,
        },
        prefs: toPrefsCtx(prefs),
        external,
        lang,
      });
      const r: Result = {
        engine: res.engine,
        summary: res.summary,
        picks: res.picks.map((p) => ({
          f: p.id ? fragrances.find((f) => f.id === p.id) : undefined,
          external: p.external ?? undefined,
          reason: p.reason,
          weatherNote: p.weatherNote,
        })),
        weatherUsed: describeWeather(usedWeather, tk, fmt),
      };
      setResult(r);
      await saveRecommendation({
        id: uid('r_'),
        at: nowIso(),
        engine: 'ai',
        context: { ...context },
        picks: res.picks.map((p) => ({ fragranceId: p.id ?? undefined, external: p.external ?? undefined, reason: p.reason })),
        summary: res.summary,
      });
    } catch (e) {
      setResult(runLocal(t('ai.error', { msg: aiErrorMessage(e, lang) })));
    } finally {
      setBusy(false);
    }
  };

  const ask = async (key: MessageKey) => {
    const q = t(key);
    setResult(null);
    setNotice(null);
    // Offline-capable answers for the questions we can compute honestly.
    const localAnswer = () => {
      if (key === 'discover.q.versatile') {
        const top = [...fragrances].sort((a, b) => versatility(b) - versatility(a)).slice(0, 3);
        return { q, text: t('discover.localVersatile'), ids: top.map((f) => f.id), engine: 'local' };
      }
      if (key === 'discover.q.neglect') {
        return { q, text: t('discover.localNeglect'), ids: neglected(fragrances, wears).slice(0, 5).map((f) => f.id), engine: 'local' };
      }
      return null;
    };
    if (!ai.available) {
      const la = localAnswer();
      setAnswer(la ?? { q, text: t('discover.localNone'), ids: [], engine: 'local' });
      scrollToResults();
      return;
    }
    if (!(await consent.ensure())) return;
    setBusy(true);
    scrollToResults();
    try {
      const res = await api.ask({
        question: q,
        collection: fragrances.map((f) => toCollectionItem(f, wears)),
        context: contextBase(weather),
        prefs: toPrefsCtx(prefs),
        lang,
      });
      setAnswer({ q, text: res.answer, ids: res.mentionedIds, engine: res.engine });
    } catch (e) {
      toast(t('ai.error', { msg: aiErrorMessage(e, lang) }), 'error');
      const la = localAnswer();
      if (la) setAnswer(la);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page discover">
      <div className="topbar">
        <h1>{t('discover.title')}</h1>
      </div>
      <p className="dim" style={{ fontWeight: 600, marginBottom: 16 }}>
        {t('discover.sub')}
      </p>
      {fragrances.length === 0 && <Notice>{t('discover.emptyCollection')}</Notice>}

      <section>
        <h2 className="h-sec">{t('discover.moods')}</h2>
        <div className="mood-grid">
          {MOODS.map((m, i) => (
            <button
              key={m}
              className={`mood-card c-${MOOD_COLORS[m]} ${mood === m ? 'on' : ''}`}
              aria-pressed={mood === m}
              onClick={() => setMood(mood === m ? null : m)}
              style={{ ['--i' as string]: i }}
              data-testid={`mood-${m}`}
            >
              <MoodArt mood={m} size={50} />
              <span className="display mood-title">{tk(`mood.${m}`)}</span>
              <span className="tiny mood-sub">{tk(`mood.${m}.sub`)}</span>
            </button>
          ))}
        </div>
        <p className="tiny dim" style={{ marginTop: 8 }}>
          {t('mood.note')}
        </p>
      </section>

      <details className="section card fine-tune">
        <summary className="display-lc">{t('discover.fineTune')}</summary>
        <div className="stack" style={{ marginTop: 14 }}>
          <div className="field">
            <span className="label">{t('discover.occasion')}</span>
            <ChipToggle
              multi={false}
              options={[...OCCASIONS, ...prefs.customOccasions] as string[]}
              value={occasion}
              onChange={setOccasion}
              render={(o) => ((OCCASIONS as readonly string[]).includes(o) ? tk(`occ.${o}`) : o)}
              size="sm"
            />
          </div>
          <div className="field">
            <span className="label">{t('discover.time')}</span>
            <ChipToggle multi={false} options={TIMES} value={time} onChange={setTime} render={(o) => tk(`time.${o}`)} size="sm" />
          </div>
          <div className="field">
            <span className="label">{t('discover.intensity')}</span>
            <Segmented<'any' | 'soft' | 'moderate' | 'loud'>
              options={['any', 'soft', 'moderate', 'loud'] as const}
              value={intensity}
              onChange={setIntensity}
              render={(o) => (o === 'any' ? t('common.any') : tk(`intensity.${o}`))}
              label={t('discover.intensity')}
            />
          </div>
          <div className="field">
            <span className="label">{t('discover.family')}</span>
            <ChipToggle multi={false} options={FAMILIES.map((f) => f.id)} value={family} onChange={setFamily} render={(o) => o} size="sm" />
          </div>
          <label className="field">
            <span className="label">{t('discover.impression')}</span>
            <input className="input" value={impression} onChange={(e) => setImpression(e.target.value)} placeholder={t('discover.impressionPlaceholder')} />
          </label>
          <div className="field">
            <span className="label">{t('discover.weather')}</span>
            <Segmented<'live' | 'manual'>
              options={(weather && !weather.manual ? ['live', 'manual'] : ['manual']) as readonly ('live' | 'manual')[]}
              value={weather && !weather.manual ? wxMode : 'manual'}
              onChange={setWxMode}
              render={(o) => (o === 'live' ? t('discover.weatherLive') : t('wx.manual'))}
              label={t('discover.weather')}
            />
            {(wxMode === 'manual' || !weather || weather.manual) && (
              <>
                <label className="field">
                  <span className="label">
                    {t('discover.temperature')}: {fmt(mTemp)}
                  </span>
                  <input type="range" min={-10} max={42} value={mTemp} onChange={(e) => setMTemp(Number(e.target.value))} aria-label={t('discover.temperature')} />
                </label>
                <Toggle label={t('wx.manualRain')} checked={mRain} onChange={setMRain} />
              </>
            )}
          </div>
        </div>
      </details>

      <section className="section">
        <label className="field">
          <span className="label">{t('discover.ask')}</span>
          <textarea className="textarea" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('discover.askPlaceholder')} rows={2} style={{ minHeight: 70 }} />
        </label>
        {ai.available && (
          <div style={{ marginTop: 8 }}>
            <Toggle label={t('discover.external')} hint={t('discover.externalNote')} checked={external} onChange={setExternal} />
          </div>
        )}
        <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 12 }} onClick={() => void go()} disabled={busy || !fragrances.length} data-testid="discover-go">
          <IconSparkle />
          {t('discover.go')}
        </button>
      </section>

      <div ref={resultsRef} style={{ scrollMarginTop: 16 }} />
      {busy && <AiLoader title={t('ai.thinking')} />}
      {notice && !busy && <Notice tone="warn">{notice}</Notice>}

      {result && !busy && (
        <section className="section" data-testid="discover-results">
          <h2 className="h-sec">{t('discover.results')}</h2>
          {result.summary && <p className="serif" style={{ fontSize: 21, marginBottom: 12 }}>{result.summary}</p>}
          <div className="stack" style={{ ['--gap' as string]: '12px' }}>
            {result.picks.map((p, i) => (
              <article key={i} className={`card match ${p.f ? `c-${familyColor(p.f.family) === 'ink' ? 'lilac' : familyColor(p.f.family)}` : 'c-surface'}`} style={{ ['--i' as string]: i }}>
                <span className="match-rank display">{i + 1}</span>
                {p.f ? (
                  <Link to={`/perfume/${p.f.id}`} className="match-main">
                    <span className="match-bottle">
                      <BottleImage fragrance={p.f} />
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span className="kicker">{p.f.brand}</span>
                      <strong className="display-lc" style={{ fontSize: 19, display: 'block' }}>
                        {p.f.name}
                      </strong>
                    </span>
                  </Link>
                ) : (
                  p.external && (
                    <div className="match-main">
                      <span style={{ minWidth: 0 }}>
                        <span className="sticker flat c-tangerine">{t('discover.externalTag')}</span>
                        <span className="kicker" style={{ display: 'block', marginTop: 6 }}>
                          {p.external.brand}
                        </span>
                        <strong className="display-lc" style={{ fontSize: 19 }}>
                          {p.external.name}
                        </strong>
                      </span>
                    </div>
                  )
                )}
                <p style={{ fontWeight: 600 }}>{p.reason}</p>
                {p.weatherNote && <p className="small dim">☂ {p.weatherNote}</p>}
                {p.f && (
                  <button
                    className="btn btn-sm btn-ink"
                    style={{ alignSelf: 'flex-start' }}
                    onClick={async () => {
                      await wearToday(p.f!.id, 'recommendation');
                      toast(`${t('home.worn')}: ${p.f!.name}`, 'lime');
                    }}
                  >
                    {t('discover.wearThis')}
                  </button>
                )}
              </article>
            ))}
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <EngineTag engine={result.engine} />
          </div>
          {result.weatherUsed && <p className="tiny dim" style={{ marginTop: 6 }}>{t('wx.context', { desc: result.weatherUsed })} · {t('profile.tendency')}</p>}
        </section>
      )}

      <section className="section">
        <h2 className="h-sec">{t('discover.questions')}</h2>
        <div className="chips">
          {QUESTIONS.map((q) => (
            <button key={q} className="chip" style={{ whiteSpace: 'normal', textAlign: 'left', minHeight: 40 }} onClick={() => void ask(q)} disabled={busy || !fragrances.length}>
              {t(q)}
            </button>
          ))}
        </div>
      </section>

      {answer && !busy && (
        <section className="section card c-lime dots" data-testid="consultant-answer">
          <span className="kicker">{t('discover.answer')}</span>
          <h3 className="serif" style={{ fontSize: 24, margin: '4px 0 10px' }}>
            {answer.q}
          </h3>
          <p style={{ whiteSpace: 'pre-wrap', fontWeight: 600 }}>{answer.text}</p>
          {answer.ids.length > 0 && (
            <div className="hscroll" style={{ marginTop: 10 }}>
              {answer.ids
                .map((id) => fragrances.find((f) => f.id === id))
                .filter(Boolean)
                .map((f, i) => (
                  <PerfumeCard key={f!.id} f={f!} mini i={i} />
                ))}
            </div>
          )}
          <EngineTag engine={answer.engine} />
        </section>
      )}
      {consent.element}
    </main>
  );
}
