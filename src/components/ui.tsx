// Small shared UI building blocks.

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconClose, IconHeart, IconStar, IconInfo } from './Icons';
import { accordColor } from '../domain/families';
import { useI18n } from '../i18n';
import type { Verification } from '../domain/types';

export function Sheet({
  open,
  onClose,
  title,
  children,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const { t } = useI18n();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    setTimeout(() => ref.current?.querySelector<HTMLElement>('[data-autofocus], input, button')?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={labelledBy ?? (title ? id : undefined)} ref={ref}>
        <div className="sheet-handle" />
        {title && (
          <div className="sheet-head">
            <h2 id={id}>{title}</h2>
            <button className="btn btn-icon btn-sm" onClick={onClose} aria-label={t('common.close')}>
              <IconClose />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function FavButton({ on, onToggle, label }: { on: boolean; onToggle: () => void; label?: string }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className="fav-btn"
      aria-pressed={on}
      aria-label={label ?? (on ? t('card.unfavorite') : t('card.favorite'))}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
    >
      <IconHeart filled={on} />
    </button>
  );
}

export function Stars({
  value,
  onChange,
  readonly,
  label,
}: {
  value: number | null;
  onChange?: (v: number | null) => void;
  readonly?: boolean;
  label: string;
}) {
  const v = value ?? 0;
  return (
    <div className={`stars ${readonly ? 'readonly' : ''}`} role={readonly ? 'img' : 'radiogroup'} aria-label={readonly ? `${label}: ${v}/5` : label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={n <= v ? 'on' : ''}
          disabled={readonly}
          tabIndex={readonly ? -1 : 0}
          role={readonly ? undefined : 'radio'}
          aria-checked={readonly ? undefined : n === v}
          aria-label={readonly ? undefined : `${n}/5`}
          onClick={() => onChange?.(n === v ? null : n)}
        >
          <IconStar filled={n <= v} />
        </button>
      ))}
    </div>
  );
}

export function Meter({ label, value, color = 'blue' }: { label: string; value: number | null | undefined; color?: string }) {
  const { t } = useI18n();
  return (
    <div className="meter">
      <span>{label}</span>
      <div className="pips" style={{ ['--bar' as string]: `var(--${color})` }} aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={`pip ${value != null && n <= value ? 'on' : ''}`} style={{ ['--i' as string]: n }} />
        ))}
      </div>
      <span className="small dim">{value != null ? `${value}/5` : t('common.unknown')}</span>
    </div>
  );
}

export function Accord({ name }: { name: string }) {
  return <span className={`accord c-${accordColor(name)}`}>{name}</span>;
}

export function Accords({ list, max = 8 }: { list: string[]; max?: number }) {
  return (
    <div className="chips" style={{ gap: 6 }}>
      {list.slice(0, max).map((a) => (
        <Accord key={a} name={a} />
      ))}
    </div>
  );
}

export function ChipToggle<T extends string>({
  options,
  value,
  onChange,
  render,
  multi = true,
  size,
}: {
  options: readonly T[];
  value: T[];
  onChange: (v: T[]) => void;
  render: (o: T) => ReactNode;
  multi?: boolean;
  size?: 'sm';
}) {
  return (
    <div className="chips">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            className={`chip ${size === 'sm' ? 'chip-sm' : ''}`}
            aria-pressed={on}
            onClick={() => onChange(multi ? (on ? value.filter((x) => x !== o) : [...value, o]) : on ? [] : [o])}
          >
            {render(o)}
          </button>
        );
      })}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  render,
  label,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  render: (o: T) => ReactNode;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o} type="button" aria-pressed={o === value} onClick={() => onChange(o)}>
          {render(o)}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; hint?: ReactNode }) {
  return (
    <label className="toggle">
      <span>
        <span style={{ fontWeight: 700 }}>{label}</span>
        {hint && <span className="hint" style={{ display: 'block' }}>{hint}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function AiLoader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="ai-loader" role="status" aria-live="polite">
      <div className="drops" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="display-lc" style={{ fontSize: 18 }}>
        {title}
      </div>
      {sub && <p className="dim small">{sub}</p>}
    </div>
  );
}

export function EngineTag({ engine }: { engine: string | null | undefined }) {
  const { t } = useI18n();
  if (!engine || engine === 'local') return <span className="tag engine-tag">{t('ai.engineLocal')}</span>;
  if (engine.startsWith('mock:')) return <span className="tag engine-tag" style={{ color: 'var(--danger)' }}>{t('ai.engineMock')}</span>;
  const model = engine.split(':').slice(1).join(':') || engine;
  return (
    <span className="tag engine-tag">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2c.6 5.3 2.5 7.6 9 9-6.5 1.4-8.4 3.7-9 9-.6-5.3-2.5-7.6-9-9 6.5-1.4 8.4-3.7 9-9Z" fill="currentColor" />
      </svg>
      {t('ai.engineAi', { model })}
    </span>
  );
}

export function VerificationTag({ status }: { status: Verification }) {
  const { tk } = useI18n();
  return (
    <span className={`tag ver-${status}`} title={tk(`ver.${status}.sub`)}>
      {status === 'verified' ? '✓ ' : status === 'unverified' ? '! ' : ''}
      {tk(`ver.${status}`)}
    </span>
  );
}

export function Notice({ children, tone }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  return (
    <div className="notice" style={tone === 'warn' ? { borderColor: 'var(--tangerine)' } : undefined}>
      <IconInfo />
      <div>{children}</div>
    </div>
  );
}

export function SectionHead({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {action}
    </div>
  );
}

/** Splits a comma-separated input into a clean list. */
export function splitList(s: string): string[] {
  return [...new Set(s.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean))];
}
