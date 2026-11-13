import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../state/store';
import { useI18n } from '../i18n';
import { useUi } from '../state/ui';
import { ChipToggle, Notice } from '../components/ui';
import { Burst, Flower, IconPin, Sparkle } from '../components/Icons';
import { FAMILIES } from '../domain/families';
import { WeatherSheet } from '../components/Weather';

const TOTAL = 5;

export function Onboarding() {
  const { prefs, updatePrefs, refreshWeather, weatherStatus, weather, importSample } = useStore();
  const { t } = useI18n();
  const { confetti } = useUi();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [name, setName] = useState(prefs.name);
  const [wxOpen, setWxOpen] = useState(false);
  const [firstName, setFirstName] = useState('');

  const finish = async (go: string) => {
    await updatePrefs({ onboarded: true, name: name.trim().slice(0, 40) });
    confetti();
    nav(go, { replace: true });
  };

  return (
    <main className={`onb onb-${step}`}>
      <div className="onb-inner">
        {step > 1 && (
          <div className="row" style={{ marginBottom: 16 }}>
            <span className="kicker">{t('onb.step', { n: step, total: TOTAL })}</span>
            <span className="spacer" />
            <div className="onb-dots" aria-hidden="true">
              {Array.from({ length: TOTAL }, (_, i) => (
                <span key={i} className={i < step ? 'on' : ''} />
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <section className="onb-welcome">
            <div className="onb-art" aria-hidden="true">
              <Flower size={120} className="wiggle onb-flower" />
              <Burst size={110} color="var(--lime)" className="rot-label onb-burst">
                <span className="display" style={{ fontSize: 12 }}>
                  NEW!
                </span>
              </Burst>
              <Sparkle size={48} color="var(--blue)" className="float onb-spark" />
            </div>
            <span className="kicker">{t('app.name')}</span>
            <h1 className="display onb-title">{t('onb.welcome')}</h1>
            <p className="onb-sub">{t('onb.welcomeSub')}</p>
            <button className="btn btn-ink btn-lg" onClick={() => setStep(2)} data-testid="onb-start">
              {t('onb.start')}
            </button>
          </section>
        )}

        {step === 2 && (
          <section className="stack">
            <h1 className="display onb-h">{t('onb.lang')}</h1>
            <div className="onb-langs">
              {(['en', 'it'] as const).map((l) => (
                <button key={l} className={`card card-press onb-lang ${prefs.language === l ? 'c-lime' : ''}`} aria-pressed={prefs.language === l} onClick={() => void updatePrefs({ language: l })} data-testid={`lang-${l}`}>
                  <span className="display" style={{ fontSize: 34 }}>
                    {l.toUpperCase()}
                  </span>
                  <span style={{ fontWeight: 700 }}>{l === 'en' ? 'English' : 'Italiano'}</span>
                </button>
              ))}
            </div>
            <label className="field">
              <span className="label">{t('onb.name')}</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={40} />
            </label>
            <Nav onBack={() => setStep(1)} onNext={() => setStep(3)} />
          </section>
        )}

        {step === 3 && (
          <section className="stack">
            <h1 className="display onb-h">{t('onb.prefs')}</h1>
            <p className="onb-sub">{t('onb.prefsSub')}</p>
            <ChipToggle options={FAMILIES.map((f) => f.id)} value={prefs.favoriteFamilies} onChange={(v) => void updatePrefs({ favoriteFamilies: v })} render={(f) => f} />
            <Nav onBack={() => setStep(2)} onNext={() => setStep(4)} skip />
          </section>
        )}

        {step === 4 && (
          <section className="stack">
            <h1 className="display onb-h">{t('onb.weather')}</h1>
            <p className="onb-sub">{t('onb.weatherSub')}</p>
            {weather && (
              <div className="card c-blue dots">
                <strong className="display-lc">
                  {Math.round(weather.tempC)}° {weather.place}
                </strong>
              </div>
            )}
            {weatherStatus === 'denied' && <Notice tone="warn">{t('wx.denied')}</Notice>}
            {weatherStatus === 'error' && <Notice tone="warn">{t('wx.unavailable')}</Notice>}
            <div className="row">
              <button className="btn btn-primary" onClick={() => void refreshWeather({ askLocation: true })} disabled={weatherStatus === 'loading'}>
                <IconPin />
                {weatherStatus === 'loading' ? t('wx.locating') : t('wx.useLocation')}
              </button>
              <button className="btn" onClick={() => setWxOpen(true)}>
                {t('wx.pickCity')}
              </button>
            </div>
            <Nav onBack={() => setStep(3)} onNext={() => setStep(5)} skip={!weather} />
            <WeatherSheet open={wxOpen} onClose={() => setWxOpen(false)} />
          </section>
        )}

        {step === 5 && (
          <section className="stack">
            <h1 className="display onb-h">{t('onb.first')}</h1>
            <p className="onb-sub">{t('onb.firstSub')}</p>
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                if (firstName.trim()) void finish(`/wardrobe/new?q=${encodeURIComponent(firstName.trim())}`);
              }}
            >
              <input className="input" placeholder={t('add.namePlaceholder')} value={firstName} onChange={(e) => setFirstName(e.target.value)} aria-label={t('add.namePlaceholder')} />
              <button className="btn btn-pink btn-lg" type="submit" disabled={!firstName.trim()}>
                {t('wardrobe.add')}
              </button>
            </form>
            <div className="row">
              <button
                className="btn btn-lime"
                onClick={async () => {
                  await importSample();
                  await finish('/wardrobe');
                }}
                data-testid="onb-sample"
              >
                {t('wardrobe.importSample')}
              </button>
              <button className="btn btn-ghost" onClick={() => void finish('/')} data-testid="onb-finish">
                {t('onb.finish')} →
              </button>
            </div>
            <p className="hint">{t('set.sampleSub')}</p>
          </section>
        )}
      </div>
    </main>
  );
}

function Nav({ onBack, onNext, skip }: { onBack: () => void; onNext: () => void; skip?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="row" style={{ marginTop: 12 }}>
      <button className="btn btn-ghost" onClick={onBack}>
        ← {t('common.back')}
      </button>
      <span className="spacer" />
      <button className="btn btn-ink" onClick={onNext} data-testid="onb-next">
        {skip ? t('common.skip') : t('common.next')} →
      </button>
    </div>
  );
}
