import { useNavigate } from 'react-router-dom';
import { useStore } from '../state/store';
import { useI18n } from '../i18n';
import { ACHIEVEMENTS, type AchievementDef } from '../domain/achievements';
import { IconBack, Burst } from '../components/Icons';
import { Toggle } from '../components/ui';

function Glyph({ g }: { g: AchievementDef['glyph'] }) {
  const p = { fill: 'var(--white)', stroke: 'var(--ink)', strokeWidth: 3, strokeLinejoin: 'round' as const };
  switch (g) {
    case 'star':
      return <path d="m24 6 5 11 12 1-9 8 3 12-11-7-11 7 3-12-9-8 12-1 5-11Z" {...p} />;
    case 'drop':
      return <path d="M24 6s-12 13-12 21a12 12 0 0 0 24 0c0-8-12-21-12-21Z" {...p} />;
    case 'crown':
      return <path d="M8 34 6 14l10 8 8-12 8 12 10-8-2 20H8Z" {...p} />;
    case 'flask':
      return <path d="M19 6h10M20 6v11L10 36a4 4 0 0 0 3 6h22a4 4 0 0 0 3-6L28 17V6" {...p} />;
    case 'heart':
      return <path d="M24 40S7 30 7 18a8 8 0 0 1 17-3 8 8 0 0 1 17 3c0 12-17 22-17 22Z" {...p} />;
    case 'spark':
      return <path d="M24 4c1 10 5 15 16 16-11 1-15 6-16 16-1-10-5-15-16-16 11-1 15-6 16-16Z" {...p} />;
    case 'flower':
      return (
        <g>
          {[0, 72, 144, 216, 288].map((r) => (
            <ellipse key={r} cx="24" cy="13" rx="7" ry="10" {...p} transform={`rotate(${r} 24 24)`} />
          ))}
          <circle cx="24" cy="24" r="6" fill="var(--lime)" stroke="var(--ink)" strokeWidth={3} />
        </g>
      );
    case 'wheel':
      return (
        <g>
          <circle cx="24" cy="24" r="16" {...p} />
          <path d="M24 8v32M8 24h32M13 13l22 22M35 13 13 35" stroke="var(--ink)" strokeWidth={2.5} />
        </g>
      );
  }
}

export default function Achievements() {
  const { unlocked, prefs, updatePrefs } = useStore();
  const { t, tk, locale } = useI18n();
  const nav = useNavigate();
  return (
    <main className="page">
      <div className="topbar">
        <button className="btn btn-icon btn-sm" onClick={() => nav(-1)} aria-label={t('common.back')}>
          <IconBack />
        </button>
        <h1>{t('ach.title')}</h1>
      </div>
      <p className="dim" style={{ fontWeight: 600, marginBottom: 12 }}>
        {t('ach.sub')}
      </p>
      <Toggle label={t('set.achievements')} checked={prefs.achievementsEnabled} onChange={(v) => void updatePrefs({ achievementsEnabled: v })} />
      {prefs.achievementsEnabled && (
        <div className="badge-grid" style={{ marginTop: 16 }}>
          {ACHIEVEMENTS.map((a, i) => {
            const at = unlocked.get(a.id);
            return (
              <div key={a.id} className={`badge-card ${at ? 'on' : 'locked'}`} style={{ ['--i' as string]: i }} data-testid={`badge-${a.id}`} data-unlocked={!!at}>
                <Burst size={92} color={at ? `var(--${a.color})` : 'var(--surface-2)'} className={at ? 'badge-burst' : ''}>
                  <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true" style={{ opacity: at ? 1 : 0.35 }}>
                    <Glyph g={a.glyph} />
                  </svg>
                </Burst>
                <strong className="display-lc" style={{ fontSize: 14 }}>
                  {tk(`ach.${a.id}`)}
                </strong>
                <span className="tiny dim">{tk(`ach.${a.id}.d`)}</span>
                <span className="tiny" style={{ fontWeight: 800 }}>
                  {at ? new Date(at).toLocaleDateString(locale) : t('ach.locked')}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
