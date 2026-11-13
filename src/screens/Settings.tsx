import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore, useAiState } from '../state/store';
import { useI18n } from '../i18n';
import { useUi } from '../state/ui';
import { ChipToggle, Notice, Segmented, Sheet, Toggle, splitList } from '../components/ui';
import { IconBack, IconBadge } from '../components/Icons';
import { WeatherSheet } from '../components/Weather';
import { FAMILIES } from '../domain/families';
import { MOODS, OCCASIONS, SEASONS, type Preferences } from '../domain/types';
import { BackupError, createBackup, downloadJson, parseBackup, restoreBackup } from '../db/backup';
import { resetEverything } from '../db/repo';
import { BASE_URL } from '../services/base';

const VERSION = '1.0.0';

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferredPrompt: BIPEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BIPEvent;
  });
}

function TextList({ label, value, onCommit }: { label: string; value: string[]; onCommit: (v: string[]) => void }) {
  const { t } = useI18n();
  const [text, setText] = useState(value.join(', '));
  useEffect(() => {
    setText(value.join(', '));
  }, [value]);
  return (
    <label className="field">
      <span className="label">{label}</span>
      <input className="input" value={text} onChange={(e) => setText(e.target.value)} onBlur={() => onCommit(splitList(text))} />
      <span className="hint">{t('set.listHint')}</span>
    </label>
  );
}

export default function Settings() {
  const store = useStore();
  const { prefs, updatePrefs, learning, resetLearning, reload, importSample, health } = store;
  const { t, tk } = useI18n();
  const { toast, confetti } = useUi();
  const ai = useAiState();
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [wxOpen, setWxOpen] = useState(false);
  const [restoreFile, setRestoreFile] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [eraseText, setEraseText] = useState('');
  const [installable, setInstallable] = useState(!!deferredPrompt);
  const standalone = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches;

  useEffect(() => {
    const h = () => setInstallable(true);
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  const set = (patch: Partial<Preferences>) => void updatePrefs(patch);

  const topLearned = Object.entries(learning.familyAffinity)
    .filter(([, v]) => v > 0.2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);

  return (
    <main className="page settings">
      <div className="topbar">
        <button className="btn btn-icon btn-sm" onClick={() => nav(-1)} aria-label={t('common.back')}>
          <IconBack />
        </button>
        <h1>{t('set.title')}</h1>
      </div>

      <section className="card stack">
        <h2 className="h-sec">{t('set.profile')}</h2>
        <label className="field">
          <span className="label">{t('set.name')}</span>
          <input className="input" defaultValue={prefs.name} onBlur={(e) => set({ name: e.target.value.trim().slice(0, 40) })} />
        </label>
        <div className="field">
          <span className="label">{t('set.language')}</span>
          <Segmented<'en' | 'it'> options={['en', 'it'] as const} value={prefs.language} onChange={(v) => set({ language: v })} render={(v) => (v === 'en' ? 'English' : 'Italiano')} label={t('set.language')} />
        </div>
        <div className="field">
          <span className="label">{t('set.units')}</span>
          <Segmented<'metric' | 'imperial'> options={['metric', 'imperial'] as const} value={prefs.units} onChange={(v) => set({ units: v })} render={(v) => t(v === 'metric' ? 'set.metric' : 'set.imperial')} label={t('set.units')} />
        </div>
        <div className="field">
          <span className="label">{t('set.appearance')}</span>
          <Segmented<Preferences['theme']> options={['system', 'light', 'dark'] as const} value={prefs.theme} onChange={(v) => set({ theme: v })} render={(v) => tk(`set.theme.${v}`)} label={t('set.appearance')} />
        </div>
        <div className="field">
          <span className="label">{t('set.motion')}</span>
          <Segmented<Preferences['reduceMotion']> options={['system', 'on', 'off'] as const} value={prefs.reduceMotion} onChange={(v) => set({ reduceMotion: v })} render={(v) => tk(`set.motion.${v}`)} label={t('set.motion')} />
        </div>
        <Toggle label={t('set.sound')} checked={prefs.soundEnabled} onChange={(v) => set({ soundEnabled: v })} />
        <Toggle label={t('set.haptics')} checked={prefs.hapticsEnabled} onChange={(v) => set({ hapticsEnabled: v })} />
      </section>

      <section className="card stack section">
        <h2 className="h-sec">{t('set.weather')}</h2>
        <p className="small" style={{ fontWeight: 700 }}>
          {prefs.weather.mode === 'off' ? t('set.weather.off') : prefs.weather.mode === 'auto' ? t('set.weather.auto') : `${t('set.weather.city')}: ${prefs.weather.city?.name ?? '—'}`}
        </p>
        <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setWxOpen(true)}>
          {t('common.edit')}
        </button>
        <div className="field">
          <span className="label">{t('set.runsWarm')}</span>
          <Segmented<Preferences['runsWarm']> options={['cold', 'neutral', 'warm'] as const} value={prefs.runsWarm} onChange={(v) => set({ runsWarm: v })} render={(v) => tk(`set.runsWarm.${v}`)} label={t('set.runsWarm')} />
        </div>
      </section>

      <section className="card stack section">
        <h2 className="h-sec">{t('set.taste')}</h2>
        <p className="hint">{t('set.tasteSub')}</p>
        <div className="field">
          <span className="label">{t('set.favFamilies')}</span>
          <ChipToggle options={FAMILIES.map((f) => f.id)} value={prefs.favoriteFamilies} onChange={(v) => set({ favoriteFamilies: v })} render={(f) => f} size="sm" />
        </div>
        <TextList label={t('set.favAccords')} value={prefs.favoriteAccords} onCommit={(v) => set({ favoriteAccords: v.map((x) => x.toLowerCase()) })} />
        <TextList label={t('set.disliked')} value={prefs.dislikedNotes} onCommit={(v) => set({ dislikedNotes: v })} />
        <div className="field">
          <span className="label">{t('set.intensity')}</span>
          <Segmented<Preferences['intensity']> options={['any', 'soft', 'moderate', 'loud'] as const} value={prefs.intensity} onChange={(v) => set({ intensity: v })} render={(v) => (v === 'any' ? t('common.any') : tk(`intensity.${v}`))} label={t('set.intensity')} />
        </div>
        <label className="field">
          <span className="label">{t('set.projection')}</span>
          <select className="select" value={prefs.projection} onChange={(e) => set({ projection: e.target.value as Preferences['projection'] })}>
            {(['any', 'close', 'moderate', 'big'] as const).map((v) => (
              <option key={v} value={v}>
                {v === 'any' ? t('common.any') : tk(`set.projection.${v}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">{t('set.longevity')}</span>
          <select className="select" value={prefs.longevity} onChange={(e) => set({ longevity: e.target.value as Preferences['longevity'] })}>
            {(['any', 'short', 'moderate', 'long'] as const).map((v) => (
              <option key={v} value={v}>
                {v === 'any' ? t('common.any') : tk(`set.longevity.${v}`)}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span className="label">{t('set.occasions')}</span>
          <ChipToggle options={OCCASIONS} value={prefs.occasions} onChange={(v) => set({ occasions: v })} render={(o) => tk(`occ.${o}`)} size="sm" />
        </div>
        <TextList label={t('set.customOccasions')} value={prefs.customOccasions} onCommit={(v) => set({ customOccasions: v.slice(0, 12) })} />
        <div className="field">
          <span className="label">{t('set.seasons')}</span>
          <ChipToggle options={SEASONS} value={prefs.seasons} onChange={(v) => set({ seasons: v })} render={(o) => tk(`season.${o}`)} size="sm" />
        </div>
        <div className="field">
          <span className="label">{t('set.moods')}</span>
          <ChipToggle options={MOODS} value={prefs.moods} onChange={(v) => set({ moods: v })} render={(o) => tk(`mood.${o}`)} size="sm" />
        </div>
      </section>

      <section className="card stack section">
        <h2 className="h-sec">{t('set.learning')}</h2>
        <p className="hint">{t('set.learningSub')}</p>
        <Toggle label={t('set.learningOn')} checked={prefs.learningEnabled} onChange={(v) => set({ learningEnabled: v })} />
        {prefs.learningEnabled && (
          <p className="small" data-testid="learning-summary">
            {t('set.learningSeen', { n: learning.events })}
            {topLearned.length ? ` · ${t('set.learningTop', { list: topLearned.join(', ') })}` : ''}
          </p>
        )}
        <button
          className="btn btn-sm"
          style={{ alignSelf: 'flex-start' }}
          onClick={async () => {
            await resetLearning();
            toast(t('set.learningDone'));
          }}
        >
          {t('set.learningReset')}
        </button>
      </section>

      <section className="card stack section">
        <div className="row">
          <h2 className="h-sec" style={{ margin: 0 }}>
            {t('ach.title')}
          </h2>
          <span className="spacer" />
          <Link to="/badges" className="btn btn-sm">
            <IconBadge />
            {t('common.seeAll')}
          </Link>
        </div>
        <Toggle label={t('set.achievements')} checked={prefs.achievementsEnabled} onChange={(v) => set({ achievementsEnabled: v })} />
      </section>

      <section className="card stack section">
        <h2 className="h-sec">{t('set.ai')}</h2>
        <p className="small" data-testid="ai-status">
          <strong>{t('ai.status')}:</strong>{' '}
          {health === null
            ? t('ai.statusUnknown')
            : ai.available && health
              ? t('ai.statusOn', { provider: health.ai.provider, model: health.ai.model ?? '' })
              : ai.reason === 'offline'
                ? t('ai.offline')
                : t('ai.statusOff')}
        </p>
        <p className="small">{t('set.privacy')}</p>
        <p className="small dim">{t('ai.consentBody')}</p>
        {prefs.aiConsent && (
          <button className="link-btn small" style={{ alignSelf: 'flex-start' }} onClick={() => set({ aiConsent: false })}>
            {t('common.reset')} — {t('ai.consentTitle')}
          </button>
        )}
      </section>

      <section className="card stack section">
        <h2 className="h-sec">{t('set.data')}</h2>
        <div className="row">
          <button
            className="btn btn-primary"
            data-testid="export"
            onClick={async () => {
              const b = await createBackup();
              downloadJson(b, `perfume-wardrobe-backup-${new Date().toISOString().slice(0, 10)}.json`);
            }}
          >
            {t('set.export')}
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            {t('set.import')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            data-testid="import-file"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setRestoreFile(await f.text());
              e.target.value = '';
            }}
          />
        </div>
        <p className="hint">{t('set.exportSub')}</p>
        <hr className="rule" />
        <button
          className="btn btn-lime"
          style={{ alignSelf: 'flex-start' }}
          onClick={async () => {
            const n = await importSample();
            toast(t('set.sampleDone', { n }), 'lime');
          }}
        >
          {t('set.sample')}
        </button>
        <p className="hint">{t('set.sampleSub')}</p>
        <hr className="rule" />
        <button className="btn btn-danger" style={{ alignSelf: 'flex-start' }} onClick={() => setResetOpen(true)}>
          {t('set.reset')}
        </button>
        <p className="hint">{t('set.resetSub')}</p>
      </section>

      <section className="card stack section">
        <h2 className="h-sec">{t('set.install')}</h2>
        {standalone ? (
          <p className="small">✓ {t('set.installed')}</p>
        ) : (
          <>
            <p className="small">{t('set.installSub')}</p>
            {installable && (
              <button
                className="btn btn-primary"
                style={{ alignSelf: 'flex-start' }}
                onClick={async () => {
                  await deferredPrompt?.prompt();
                  deferredPrompt = null;
                  setInstallable(false);
                }}
              >
                {t('set.install')}
              </button>
            )}
            <p className="hint">{t('set.installIos')}</p>
          </>
        )}
      </section>

      <section className="section">
        <h2 className="h-sec">{t('set.about')}</h2>
        <p className="small dim">{t('set.aboutText', { v: VERSION })}</p>
      </section>

      <WeatherSheet open={wxOpen} onClose={() => setWxOpen(false)} />

      <Sheet open={!!restoreFile} onClose={() => setRestoreFile(null)} title={t('set.import')}>
        <div className="stack">
          <Notice>{t('set.exportSub')}</Notice>
          {(['merge', 'replace'] as const).map((mode) => (
            <button
              key={mode}
              className={`btn ${mode === 'replace' ? 'btn-danger' : 'btn-primary'}`}
              data-testid={`restore-${mode}`}
              onClick={async () => {
                try {
                  const b = parseBackup(restoreFile!);
                  const r = await restoreBackup(b, mode);
                  await reload();
                  setRestoreFile(null);
                  toast(t('set.imported', { n: r.fragrances }), 'lime');
                  confetti();
                } catch (e) {
                  setRestoreFile(null);
                  toast(e instanceof BackupError && e.code === 'newer_version' ? t('set.importNewer') : t('set.importError'), 'error');
                }
              }}
            >
              {t(mode === 'merge' ? 'set.importMerge' : 'set.importReplace')}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={resetOpen} onClose={() => setResetOpen(false)} title={t('set.reset')}>
        <div className="stack">
          <p style={{ fontWeight: 600 }}>{t('set.resetSub')}</p>
          <label className="field">
            <span className="label">{t('set.resetConfirm')}</span>
            <input className="input" value={eraseText} onChange={(e) => setEraseText(e.target.value)} autoCapitalize="characters" data-testid="erase-input" />
          </label>
          <button
            className="btn btn-danger"
            disabled={eraseText.trim() !== 'ERASE'}
            onClick={async () => {
              await resetEverything();
              try {
                localStorage.clear();
              } catch {
                /* ignore */
              }
              location.href = BASE_URL;
            }}
          >
            {t('set.reset')}
          </button>
        </div>
      </Sheet>
    </main>
  );
}
