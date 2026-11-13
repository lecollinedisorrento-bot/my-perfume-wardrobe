import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { useI18n } from '../i18n';
import { manualWeather, weatherEmoji, weatherLabelKey } from '../domain/weather';
import { cToF } from '../domain/util';
import type { CityRef, WeatherSnapshot } from '../domain/types';
import { weatherProvider } from '../services/weather';
import { Sheet, Toggle, Notice } from './ui';
import { IconPin, IconSearch, IconRefresh } from './Icons';

export function useTemp() {
  const { prefs } = useStore();
  return (c: number) => (prefs.units === 'imperial' ? `${cToF(c)}°F` : `${Math.round(c)}°`);
}

export function describeWeather(w: WeatherSnapshot, tk: (k: string, p?: Record<string, string | number>) => string, fmt: (c: number) => string) {
  const parts = [w.manual ? tk('wx.manual') : w.place, `${fmt(w.tempC)} ${tk(weatherLabelKey(w.code)).toLowerCase()}`, tk('wx.feels', { t: fmt(w.feelsLikeC) })];
  if (w.humidity >= 75) parts.push(tk('wx.humidity', { n: Math.round(w.humidity) }));
  if (w.precipitationMm > 0.1) parts.push(tk('wx.rainMm', { n: w.precipitationMm }));
  return parts.filter(Boolean).join(' · ');
}

export function WeatherPill({ onClick }: { onClick: () => void }) {
  const { weather, weatherStatus, prefs } = useStore();
  const { t, tk } = useI18n();
  const fmt = useTemp();
  if (!weather) {
    return (
      <button className="chip" onClick={onClick} data-testid="weather-pill">
        {weatherStatus === 'loading' ? t('wx.locating') : prefs.weather.mode === 'off' ? t('wx.setup') : t('wx.unavailable').split('.')[0]}
      </button>
    );
  }
  return (
    <button className="chip" onClick={onClick} data-testid="weather-pill" aria-label={describeWeather(weather, tk, fmt)}>
      <span aria-hidden="true" style={{ fontSize: 16 }}>
        {weatherEmoji(weather.code, weather.isDay)}
      </span>
      <strong>{fmt(weather.tempC)}</strong>
      <span className="dim" style={{ fontWeight: 600 }}>
        {weather.manual ? t('wx.manual') : weather.place || tk(weatherLabelKey(weather.code))}
      </span>
    </button>
  );
}

export function WeatherSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { prefs, weather, weatherStatus, refreshWeather, updatePrefs, setManualWeather, manualWeather: manual } = useStore();
  const { t, tk, lang } = useI18n();
  const fmt = useTemp();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<CityRef[] | null>(null);
  const [searchErr, setSearchErr] = useState(false);
  const [mTemp, setMTemp] = useState(manual?.tempC ?? 20);
  const [mRain, setMRain] = useState(manual ? manual.precipitationMm > 0 : false);
  const [mHumid, setMHumid] = useState(manual ? manual.humidity >= 75 : false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    const h = setTimeout(() => {
      weatherProvider
        .searchCity(q, lang)
        .then((r) => {
          setResults(r);
          setSearchErr(false);
        })
        .catch(() => setSearchErr(true));
    }, 300);
    return () => clearTimeout(h);
  }, [q, lang]);

  const pickCity = async (c: CityRef) => {
    await updatePrefs({ weather: { mode: 'city', city: c } });
    setManualWeather(null);
    setQ('');
    setResults(null);
    // prefs are read from a ref inside refreshWeather, so this sees the new city
    await refreshWeather();
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('set.weather')}>
      <div className="stack">
        {weather && (
          <div className={`card flat ${weather.manual ? 'c-lilac' : 'c-blue'} dots`} data-testid="weather-current">
            <div className="row nowrap">
              <span style={{ fontSize: 40 }} aria-hidden="true">
                {weatherEmoji(weather.code, weather.isDay)}
              </span>
              <div className="stack" style={{ ['--gap' as string]: '2px' }}>
                <strong className="display-lc" style={{ fontSize: 28 }}>
                  {fmt(weather.tempC)}
                </strong>
                <span className="small">{describeWeather(weather, tk, fmt)}</span>
                <span className="tiny dim">
                  {weather.manual ? t('wx.manual') : `${t('wx.provider')} · ${t('wx.stale', { time: new Date(weather.fetchedAt).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' }) })}`}
                </span>
              </div>
            </div>
          </div>
        )}
        {weatherStatus === 'denied' && <Notice tone="warn">{t('wx.denied')}</Notice>}
        {weatherStatus === 'error' && <Notice tone="warn">{t('wx.unavailable')}</Notice>}

        <p className="dim small">{t('wx.setupSub')}</p>
        <div className="row">
          <button className="btn btn-primary" onClick={() => void refreshWeather({ askLocation: true })} disabled={weatherStatus === 'loading'}>
            <IconPin />
            {weatherStatus === 'loading' ? t('wx.locating') : t('wx.useLocation')}
          </button>
          {prefs.weather.mode !== 'off' && (
            <button className="btn btn-sm" onClick={() => void refreshWeather()} aria-label={t('wx.refresh')}>
              <IconRefresh />
            </button>
          )}
        </div>

        <div className="field">
          <label className="label" htmlFor="city-q">
            {t('wx.pickCity')}
          </label>
          <div className="search-wrap">
            <IconSearch />
            <input id="city-q" className="input input-pill" placeholder={t('wx.cityPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
          </div>
          {searchErr && <span className="error-text">{t('err.network')}</span>}
          {results && results.length === 0 && <span className="dim small">{t('wx.noResults')}</span>}
          {results && results.length > 0 && (
            <div className="stack" style={{ ['--gap' as string]: '6px' }} role="listbox" aria-label={t('wx.pickCity')}>
              {results.map((c) => (
                <button key={`${c.lat},${c.lon}`} role="option" aria-selected={false} className="chip" style={{ justifyContent: 'flex-start' }} onClick={() => void pickCity(c)}>
                  <IconPin style={{ width: 16, height: 16 }} />
                  {c.name}
                  <span className="dim" style={{ fontWeight: 600 }}>
                    {[c.admin, c.country].filter(Boolean).join(', ')}
                  </span>
                </button>
              ))}
            </div>
          )}
          {prefs.weather.mode === 'city' && prefs.weather.city && (
            <span className="small dim">
              {t('set.weather.city')}: <strong>{prefs.weather.city.name}</strong>
            </span>
          )}
        </div>

        <div className="card flat stack" style={{ ['--gap' as string]: '10px' }}>
          <strong className="display-lc" style={{ fontSize: 15 }}>
            {t('wx.manualTitle')}
          </strong>
          <label className="field">
            <span className="label">
              {t('wx.manualTemp')}: {fmt(mTemp)}
            </span>
            <input type="range" min={-10} max={42} value={mTemp} onChange={(e) => setMTemp(Number(e.target.value))} aria-label={t('wx.manualTemp')} />
          </label>
          <Toggle label={t('wx.manualRain')} checked={mRain} onChange={setMRain} />
          <Toggle label={t('wx.manualHumid')} checked={mHumid} onChange={setMHumid} />
          <div className="row">
            <button
              className="btn btn-lime"
              onClick={() => {
                setManualWeather(manualWeather(mTemp, { rainy: mRain, humid: mHumid }));
                onClose();
              }}
            >
              {t('common.apply')}
            </button>
            {manual && (
              <button className="btn btn-ghost" onClick={() => setManualWeather(null)}>
                {t('common.clear')}
              </button>
            )}
          </div>
        </div>
        {prefs.weather.mode !== 'off' && (
          <button className="link-btn small" onClick={() => void updatePrefs({ weather: { mode: 'off', city: null } })}>
            {t('set.weather.off')}
          </button>
        )}
      </div>
    </Sheet>
  );
}
