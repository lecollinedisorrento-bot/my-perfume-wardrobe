import { Art } from '../components/Art';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../state/store';
import { useI18n } from '../i18n';
import { useUi } from '../state/ui';
import { BottleImage } from '../components/BottleImage';
import { Accords, ChipToggle, Segmented, Sheet, Toggle } from '../components/ui';
import { IconFilter, IconSound } from '../components/Icons';
import {
  DEFAULT_FILTERS,
  eligibleFragrances,
  MAX_WHEEL_SEGMENTS,
  segmentAtRotation,
  slotOutcome,
  targetRotation,
  WHEEL_EASING,
  wheelLayout,
  shuffle,
  type SlotOutcome,
  type SpinFilters,
} from '../domain/roulette';
import { OCCASIONS, SEASONS, type Fragrance } from '../domain/types';
import { resolveFamily, familyColor } from '../domain/families';
import { localDay, uid, nowIso, randomInt } from '../domain/util';
import { sfx, vibrate } from '../services/feedback';
import { useRelativeDay } from '../state/hooks';

const SEG_COLORS = ['var(--blue)', 'var(--pink)', 'var(--lime)', 'var(--tangerine)', 'var(--lilac)'];
const SEG_TEXT = ['#fff', '#202020', '#202020', '#202020', '#202020'];

function loadFilters(): SpinFilters {
  try {
    return { ...DEFAULT_FILTERS, ...JSON.parse(localStorage.getItem('mpw.spinFilters') ?? '{}') };
  } catch {
    return DEFAULT_FILTERS;
  }
}

export default function Spin() {
  const { fragrances, wears, weather, prefs, recordSpin, wearToday, updatePrefs, spins } = useStore();
  const { t, tk } = useI18n();
  const { reducedMotion } = useUi();
  const [mode, setMode] = useState<'wheel' | 'slots'>(() => {
    try {
      return localStorage.getItem('mpw.spinMode') === 'slots' ? 'slots' : 'wheel';
    } catch {
      return 'wheel';
    }
  });
  const [filters, setFilters] = useState<SpinFilters>(loadFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [result, setResult] = useState<{ f: Fragrance; spinId: string; label?: string } | null>(null);
  const [spinning, setSpinning] = useState(false);
  const rel = useRelativeDay();

  useEffect(() => {
    try {
      localStorage.setItem('mpw.spinFilters', JSON.stringify(filters));
      localStorage.setItem('mpw.spinMode', mode);
    } catch {
      /* ignore */
    }
  }, [filters, mode]);

  const eligible = useMemo(
    () => eligibleFragrances(fragrances, filters, { wears, weather, prefs }),
    [fragrances, filters, wears, weather, prefs],
  );

  const onResult = async (f: Fragrance, label?: string) => {
    const rec = { id: uid('s_'), at: nowIso(), mode, fragranceId: f.id, eligibleCount: eligible.length, addedToRotation: false };
    await recordSpin(rec);
    setResult({ f, spinId: rec.id, label });
  };

  const families = useMemo(() => [...new Set(fragrances.map((f) => resolveFamily(f.family)?.id ?? f.family).filter(Boolean))].sort(), [fragrances]);
  const activeCount =
    (filters.favoritesOnly ? 1 : 0) + (filters.season ? 1 : 0) + (filters.occasion ? 1 : 0) + (filters.weatherOnly ? 1 : 0) + (filters.excludeRecentDays ? 1 : 0) + filters.families.length;

  const history = useMemo(() => [...spins].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8), [spins]);

  return (
    <main className="page spin-page">
      <div className="topbar">
        <h1>{t('spin.title')}</h1>
        <span className="spacer" />
        <button
          className="btn btn-icon btn-sm"
          aria-pressed={prefs.soundEnabled}
          aria-label={t('spin.sound')}
          onClick={() => void updatePrefs({ soundEnabled: !prefs.soundEnabled })}
        >
          <IconSound off={!prefs.soundEnabled} />
        </button>
      </div>

      <div className="row" style={{ marginBottom: 14 }}>
        <Segmented<'wheel' | 'slots'>
          options={['wheel', 'slots'] as const}
          value={mode}
          onChange={(m) => {
            if (!spinning) {
              setMode(m);
              setResult(null);
            }
          }}
          render={(m) => t(m === 'wheel' ? 'spin.wheel' : 'spin.slots')}
          label={t('spin.title')}
        />
        <span className="spacer" />
        <button className="chip" onClick={() => setFiltersOpen(true)} aria-pressed={activeCount > 0} disabled={spinning}>
          <IconFilter style={{ width: 16, height: 16 }} />
          {t('common.filters')}
          {activeCount ? ` · ${activeCount}` : ''}
        </button>
      </div>

      {fragrances.length === 0 ? (
        <div className="empty card c-pink dots">
          <Art name="empty-wardrobe" className="empty-art" eager />
          <h2>{t('spin.empty')}</h2>
          <Link className="btn btn-ink" to="/wardrobe/new">
            {t('wardrobe.add')}
          </Link>
        </div>
      ) : eligible.length === 0 ? (
        <div className="empty card">
          <h2>{t('spin.noneEligible')}</h2>
          <button className="btn btn-primary" onClick={() => setFilters(DEFAULT_FILTERS)}>
            {t('common.reset')}
          </button>
        </div>
      ) : (
        <>
          <p className="row small" style={{ marginBottom: 8 }}>
            <span className="sticker flat c-lime" data-testid="eligible-count">
              {eligible.length === 1 ? t('spin.eligible1') : t('spin.eligible', { n: eligible.length })}
            </span>
          </p>
          {mode === 'wheel' ? (
            <Wheel eligible={eligible} reduced={reducedMotion} spinning={spinning} setSpinning={setSpinning} onResult={(f) => void onResult(f)} clearResult={() => setResult(null)} />
          ) : (
            <Slots eligible={eligible} reduced={reducedMotion} spinning={spinning} setSpinning={setSpinning} onResult={(f, label) => void onResult(f, label)} clearResult={() => setResult(null)} />
          )}
          <p className="tiny dim" style={{ textAlign: 'center', marginTop: 10 }}>
            {t('spin.fair')}
          </p>
        </>
      )}

      {result && !spinning && (
        <ResultCard
          key={result.spinId}
          f={result.f}
          label={result.label}
          onAdd={async () => {
            await wearToday(result.f.id, 'spin');
            const rec = spins.find((s) => s.id === result.spinId);
            if (rec) await recordSpin({ ...rec, addedToRotation: true });
          }}
        />
      )}

      <section className="section">
        <h2 className="h-sec">{t('spin.history')}</h2>
        {history.length === 0 ? (
          <div className="empty-inline">
            <Art name="empty-history" className="empty-inline-art" />
            <p className="dim small">{t('spin.historyEmpty')}</p>
          </div>
        ) : (
          <ol className="diary">
            {history.map((s) => {
              const f = fragrances.find((x) => x.id === s.fragranceId);
              if (!f) return null;
              return (
                <li key={s.id}>
                  <Link to={`/perfume/${f.id}`} className="diary-row">
                    <span className="diary-day">{rel(localDay(new Date(s.at)))}</span>
                    <span className="diary-name">
                      <strong>{f.name}</strong> <span className="dim">· {s.mode === 'wheel' ? t('spin.wheel') : t('spin.slots')}</span>
                      {s.addedToRotation ? ' ✓' : ''}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title={t('common.filters')}>
        <div className="stack">
          <Toggle label={t('spin.filter.favorites')} checked={filters.favoritesOnly} onChange={(v) => setFilters({ ...filters, favoritesOnly: v })} />
          <Toggle
            label={t('spin.filter.weather')}
            hint={weather ? undefined : t('wx.setup')}
            checked={filters.weatherOnly && !!weather}
            onChange={(v) => setFilters({ ...filters, weatherOnly: v })}
          />
          <div className="field">
            <span className="label">{t('spin.filter.recent')}</span>
            <Segmented<string>
              options={['0', '3', '7', '14'] as const}
              value={String(filters.excludeRecentDays)}
              onChange={(v) => setFilters({ ...filters, excludeRecentDays: Number(v) })}
              render={(v) => (v === '0' ? t('common.none') : `${v}d`)}
              label={t('spin.filter.recent')}
            />
          </div>
          <div className="field">
            <span className="label">{t('spin.filter.season')}</span>
            <ChipToggle multi={false} options={SEASONS} value={filters.season ? [filters.season] : []} onChange={(v) => setFilters({ ...filters, season: v[0] ?? null })} render={(s) => tk(`season.${s}`)} size="sm" />
          </div>
          <div className="field">
            <span className="label">{t('spin.filter.occasion')}</span>
            <ChipToggle
              multi={false}
              options={[...OCCASIONS, ...prefs.customOccasions] as string[]}
              value={filters.occasion ? [filters.occasion] : []}
              onChange={(v) => setFilters({ ...filters, occasion: v[0] ?? null })}
              render={(s) => (OCCASIONS as readonly string[]).includes(s) ? tk(`occ.${s}`) : s}
              size="sm"
            />
          </div>
          {families.length > 0 && (
            <div className="field">
              <span className="label">{t('spin.filter.families')}</span>
              <ChipToggle options={families} value={filters.families} onChange={(v) => setFilters({ ...filters, families: v })} render={(f) => f} size="sm" />
            </div>
          )}
          <p className="hint">{t('spin.filter.unknownNote')}</p>
          <div className="row">
            <button className="btn btn-primary" onClick={() => setFiltersOpen(false)}>
              {t('spin.eligible', { n: eligible.length })}
            </button>
            <button className="btn btn-ghost" onClick={() => setFilters(DEFAULT_FILTERS)}>
              {t('common.reset')}
            </button>
          </div>
        </div>
      </Sheet>
    </main>
  );
}

// ───────────────────────────── Wheel ─────────────────────────────

interface GameProps {
  eligible: Fragrance[];
  reduced: boolean;
  spinning: boolean;
  setSpinning: (v: boolean) => void;
  onResult: (f: Fragrance, label?: string) => void;
  clearResult: () => void;
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function Wheel({ eligible, reduced, spinning, setSpinning, onResult, clearResult }: GameProps) {
  const { t } = useI18n();
  const [segments, setSegments] = useState<Fragrance[]>(() => initialSegments(eligible));
  const [rotation, setRotation] = useState(0);
  const [animate, setAnimate] = useState(false);
  const wheelRef = useRef<SVGSVGElement>(null);
  const pointerRef = useRef<HTMLDivElement>(null);
  const pending = useRef<{ winner: Fragrance; index: number; target: number } | null>(null);
  const duration = reduced ? 350 : 5600;

  // Keep the idle wheel in sync with filters.
  useEffect(() => {
    if (!spinning) setSegments(initialSegments(eligible));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible.map((e) => e.id).join(',')]);

  const n = segments.length;
  const seg = 360 / n;

  const spin = (opts?: { from?: number; turns?: number }) => {
    if (spinning || !eligible.length) return;
    clearResult();
    const layout = wheelLayout(eligible); // the winner is drawn here, fairly — the finger only sets the feel
    const base = (opts?.from ?? rotation) % 360;
    // 1) reset rotation without animation and swap in the new segments
    setAnimate(false);
    setRotation(base);
    setSegments(layout.segments);
    const target = targetRotation(base, layout.winnerIndex, layout.segments.length, reduced ? 1 : (opts?.turns ?? 6));
    pending.current = { winner: layout.winner, index: layout.winnerIndex, target };
    setSpinning(true);
    vibrate(15);
    // 2) next frames: animate to the target
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setAnimate(true);
        setRotation(target);
      }),
    );
  };

  // ── Spin it by hand: the wheel follows the finger; a flick sends it spinning. ──
  const drag = useRef<{ prev: number; rot: number; seg: number; samples: { t: number; r: number }[] } | null>(null);
  const angleAt = (e: React.PointerEvent) => {
    const b = wheelRef.current!.getBoundingClientRect();
    return (Math.atan2(e.clientY - (b.top + b.height / 2), e.clientX - (b.left + b.width / 2)) * 180) / Math.PI;
  };
  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (spinning || !eligible.length) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setAnimate(false);
    drag.current = { prev: angleAt(e), rot: rotation, seg: segmentAtRotation(rotation, n), samples: [{ t: performance.now(), r: rotation }] };
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const a = angleAt(e);
    let diff = a - d.prev;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    d.prev = a;
    d.rot += diff;
    setRotation(d.rot);
    const s = segmentAtRotation(d.rot, n);
    if (s !== d.seg) {
      d.seg = s;
      sfx.tick();
      vibrate(4);
      pointerRef.current?.animate([{ transform: 'translateX(-50%) rotate(-18deg)' }, { transform: 'translateX(-50%) rotate(0)' }], { duration: 120 });
    }
    const now = performance.now();
    d.samples.push({ t: now, r: d.rot });
    while (d.samples.length > 2 && now - d.samples[0].t > 120) d.samples.shift();
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.samples.length < 2) return;
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const v = Math.abs((last.r - first.r) / Math.max(1, last.t - first.t)); // degrees per ms
    if (v >= 0.25) spin({ from: d.rot, turns: Math.max(3, Math.min(9, Math.round(v * 4))) });
  };

  // Ticks while spinning: read the live transform and click on segment changes.
  useEffect(() => {
    if (!spinning) return;
    let raf = 0;
    let lastSeg = -1;
    const loop = () => {
      const el = wheelRef.current;
      if (el) {
        const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
        const ang = (Math.atan2(m.b, m.a) * 180) / Math.PI;
        const s = segmentAtRotation(ang, n);
        if (s !== lastSeg && lastSeg !== -1) {
          sfx.tick();
          pointerRef.current?.animate([{ transform: 'translateX(-50%) rotate(-18deg)' }, { transform: 'translateX(-50%) rotate(0)' }], { duration: 120 });
        }
        lastSeg = s;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const done = setTimeout(() => {
      const p = pending.current;
      if (!p) return;
      // Sanity check: the pointer really sits on the drawn winner.
      if (segmentAtRotation(p.target, n) !== p.index) console.error('[wheel] landing mismatch');
      sfx.win();
      vibrate([30, 50, 60]);
      setSpinning(false);
      onResult(p.winner);
      pending.current = null;
    }, duration + 80);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning]);

  return (
    <>
    <div className="wheel-wrap">
      <div className="wheel-pointer" ref={pointerRef} aria-hidden="true" />
      <svg
        ref={wheelRef}
        className="wheel"
        viewBox="-110 -110 220 220"
        role="img"
        aria-label={`${t('spin.wheel')}: ${segments.map((s) => s.name).join(', ')}`}
        data-testid="wheel"
        data-rotation={rotation}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{
          touchAction: 'none',
          cursor: spinning ? 'default' : 'grab',
          transform: `rotate(${rotation}deg)`,
          transition: animate ? `transform ${duration}ms ${WHEEL_EASING}` : 'none',
        }}
      >
        <circle r="104" fill="var(--ink)" />
        {segments.map((f, i) => {
          const a0 = ((i * seg - 90) * Math.PI) / 180;
          const a1 = (((i + 1) * seg - 90) * Math.PI) / 180;
          const r = 100;
          const large = seg > 180 ? 1 : 0;
          const d = n === 1 ? '' : `M0 0 L${r * Math.cos(a0)} ${r * Math.sin(a0)} A${r} ${r} 0 ${large} 1 ${r * Math.cos(a1)} ${r * Math.sin(a1)} Z`;
          const mid = i * seg + seg / 2;
          const ci = i % SEG_COLORS.length === 0 && i === n - 1 && n > 1 ? 2 : i % SEG_COLORS.length; // avoid same colour neighbours
          return (
            <g key={f.id + i}>
              {n === 1 ? <circle r={r} fill={SEG_COLORS[0]} stroke="var(--ink)" strokeWidth="2" /> : <path d={d} fill={SEG_COLORS[ci]} stroke="var(--ink)" strokeWidth="2" />}
              <g transform={`rotate(${mid}) translate(0 ${n > 6 ? -68 : -62}) rotate(${n > 6 ? 90 : 0})`}>
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={SEG_TEXT[ci]}
                  fontFamily="Unbounded Variable, Arial Black, sans-serif"
                  fontWeight="700"
                  fontSize={n > 10 ? 6.2 : n > 6 ? 7.4 : 8.6}
                >
                  {truncate(f.name, n > 10 ? 13 : n > 6 ? 15 : 14)}
                </text>
              </g>
            </g>
          );
        })}
        {/* Clean rim drawn over the slice edges, with marquee lights on it. */}
        <circle r="103.5" fill="none" stroke="var(--ink)" strokeWidth="9" />
        <circle r="99" fill="none" stroke="var(--ink)" strokeWidth="1.5" />
        {Array.from({ length: n * 2 }, (_, i) => {
          const a = ((i * (seg / 2) - 90) * Math.PI) / 180;
          return <circle key={i} cx={103.5 * Math.cos(a)} cy={103.5 * Math.sin(a)} r="2.1" fill={i % 2 ? 'var(--lime)' : '#fff'} />;
        })}
      </svg>
      <button className="wheel-hub" onClick={() => spin()} disabled={spinning} data-testid="spin-button" aria-label={t('spin.go')}>
        <span className="display">{spinning ? '···' : t('spin.go')}</span>
      </button>
      <p className="tiny dim wheel-hint">{t('spin.flickHint')}</p>
    </div>
    {eligible.length > MAX_WHEEL_SEGMENTS && <p className="tiny dim wheel-note">{t('spin.sample', { shown: MAX_WHEEL_SEGMENTS, n: eligible.length })}</p>}
    </>
  );
}

function initialSegments(eligible: Fragrance[]) {
  return eligible.length <= MAX_WHEEL_SEGMENTS ? eligible.slice() : shuffle(eligible.slice()).slice(0, MAX_WHEEL_SEGMENTS);
}

// ───────────────────────────── Slot machine ─────────────────────────────

const ITEM_H = 104;
/** The three reel windows of public/art/slot-cabinet.webp, measured from the artwork (percent). */
const SLOT_WINDOWS: React.CSSProperties[] = [
  { left: '14.44%', top: '38.93%', width: '21.22%', height: '36.47%' },
  { left: '39.67%', top: '38.93%', width: '20.44%', height: '36.47%' },
  { left: '64.11%', top: '38.93%', width: '21.11%', height: '36.47%' },
];
const STRIP_LEN = 26;

/**
 * A lever you can actually pull: drag the knob down (ticks + haptics on the way),
 * past halfway it fires on release, otherwise it springs back. Tap or keyboard
 * still work. `pulled` plays the automatic pull when the big button is used.
 */
function Lever({ pulled, disabled, onPull, label }: { pulled: boolean; disabled: boolean; onPull: () => void; label: string }) {
  const TRAVEL = 130; // px the knob travels (matches .lever-knob)
  const [drag, setDrag] = useState<number | null>(null); // 0..1 while dragging
  const start = useRef<{ y: number; id: number } | null>(null);
  const lastTick = useRef(0);
  const moved = useRef(false);

  const onDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    start.current = { y: e.clientY, id: e.pointerId };
    moved.current = false;
    lastTick.current = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag(0);
  };
  const onMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!start.current || start.current.id !== e.pointerId) return;
    const p = Math.max(0, Math.min(1, (e.clientY - start.current.y) / TRAVEL));
    if (p > 0.05) moved.current = true;
    const notch = Math.floor(p * 4); // four notches on the way down
    if (notch > lastTick.current) {
      lastTick.current = notch;
      sfx.tick();
      vibrate(notch === 4 ? 18 : 6);
    }
    setDrag(p);
  };
  const onUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!start.current || start.current.id !== e.pointerId) return;
    const p = drag ?? 0;
    start.current = null;
    setDrag(null);
    if (moved.current && p >= 0.55) onPull();
    else if (moved.current) vibrate(4); // released early: springs back, no spin
  };

  const p = drag ?? (pulled ? 1 : 0);
  return (
    <button
      className={`lever ${drag != null ? 'dragging' : ''}`}
      style={{ ['--pull' as string]: p }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onClick={() => {
        // A tap (or Enter/Space) pulls; a finished drag already did.
        if (!moved.current && !disabled) onPull();
        moved.current = false;
      }}
      disabled={disabled}
      data-testid="spin-button"
      aria-label={label}
    >
      <Art name="slot-base" className="lever-base" eager />
      <Art name="slot-arm" className="lever-stick" eager />
      <Art name="slot-knob" className="lever-knob" eager />
    </button>
  );
}

const REEL_EASE = [0.2, 0.75, 0.25, 1.06] as const;

/** Times (0..1 of the duration) when a cubic-bezier easing passes each of `steps` equal steps. */
function stepTimes(steps: number, [x1, y1, x2, y2]: readonly [number, number, number, number]): number[] {
  const bez = (a: number, b: number, s: number) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  const out: number[] = [];
  let k = 1;
  for (let i = 1; i <= 400 && k <= steps; i++) {
    const s = i / 400;
    while (k <= steps && bez(y1, y2, s) >= k / steps) {
      out.push(bez(x1, x2, s));
      k++;
    }
  }
  return out;
}

function Slots({ eligible, reduced, spinning, setSpinning, onResult, clearResult }: GameProps) {
  const { t } = useI18n();
  const byId = useMemo(() => new Map(eligible.map((f) => [f.id, f])), [eligible]);
  const ids = useMemo(() => eligible.map((f) => f.id), [eligible]);
  const [strips, setStrips] = useState<string[][]>(() => [0, 1, 2].map(() => [ids[randomInt(ids.length)]]));
  const [offsets, setOffsets] = useState([0, 0, 0]);
  const [animate, setAnimate] = useState(false);
  const [outcome, setOutcome] = useState<SlotOutcome | null>(null);
  const [lever, setLever] = useState(false);
  // Reel windows scale with the screen, so one reel symbol = the window's real height.
  const reelRef = useRef<HTMLDivElement>(null);
  const [itemH, setItemH] = useState(ITEM_H);
  useEffect(() => {
    const el = reelRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (el.clientHeight) setItemH(el.clientHeight);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const durations = reduced ? [200, 250, 300] : [1700, 2400, 3100];

  useEffect(() => {
    if (!spinning) {
      setStrips([0, 1, 2].map(() => [ids[randomInt(ids.length)]]));
      setOffsets([0, 0, 0]);
      setAnimate(false);
      setOutcome(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(',')]);

  const pull = () => {
    if (spinning || !ids.length) return;
    clearResult();
    setOutcome(null);
    setLever(true);
    setTimeout(() => setLever(false), 350);
    const out = slotOutcome(ids);
    // Build strips: current symbol on top, random filler, real outcome last.
    const next = [0, 1, 2].map((r) => {
      const current = strips[r][strips[r].length - 1];
      const fill = Array.from({ length: STRIP_LEN + r * 6 }, () => ids[randomInt(ids.length)]);
      return [current, ...fill, out.reels[r]];
    });
    setAnimate(false);
    setOffsets([0, 0, 0]);
    setStrips(next);
    setSpinning(true);
    vibrate(15);
    // One click per symbol passing each window, following the same easing as the reels.
    sfx.reels(
      next.map((s, r) => stepTimes(s.length - 1, REEL_EASE).map((x) => (x * durations[r]) / 1000)),
      durations.map((d) => d / 1000),
    );
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setAnimate(true);
        setOffsets(next.map((s) => (s.length - 1) * itemH));
      }),
    );
    durations.forEach((d, i) =>
      setTimeout(() => {
        vibrate(25);
        if (i === 2) {
          setOutcome(out);
          setSpinning(false);
          if (out.match > 1) sfx.win();
          const label = out.match === 3 ? t('spin.triple') : out.match === 2 ? t('spin.double') : t('spin.single', { n: out.winnerReels[0] + 1 });
          onResult(byId.get(out.winnerId)!, label);
        }
      }, d + 40),
    );
  };

  return (
    <div className="slots-wrap">
      <div className={`slot-machine ${spinning ? 'spinning' : ''}`} data-testid="slots">
        {/* Reels sit behind the cabinet artwork and show through its three windows. */}
        {[0, 1, 2].map((r) => (
          <div
            key={r}
            ref={r === 0 ? reelRef : undefined}
            className={`reel ${outcome?.winnerReels.includes(r) ? 'win' : ''}`}
            style={SLOT_WINDOWS[r]}
            data-testid={`reel-${r}`}
            data-result={outcome ? outcome.reels[r] : ''}
          >
            <div
              className="reel-strip"
              style={{
                transform: `translateY(-${offsets[r]}px)`,
                transition: animate ? `transform ${durations[r]}ms cubic-bezier(${REEL_EASE.join(', ')})` : 'none',
                filter: spinning && animate ? 'blur(0.6px)' : 'none',
              }}
            >
              {strips[r].map((id, i) => {
                const f = byId.get(id);
                return f ? (
                  <div key={i} className={`reel-item c-${familyColor(f.family) === 'ink' ? 'lilac' : familyColor(f.family)}`} style={{ height: itemH }}>
                    <BottleImage fragrance={f} />
                    <span>{truncate(f.name, 14)}</span>
                  </div>
                ) : (
                  <div key={i} className="reel-item" style={{ height: itemH }} />
                );
              })}
            </div>
          </div>
        ))}
        <Art name="slot-cabinet" className="slot-cabinet" eager />
        <span className="slot-sign display" aria-hidden="true">
          {t('spin.slots')}
        </span>
        {outcome && outcome.match > 1 && (
          <div className="slot-win" aria-hidden="true">
            <Art name="slot-win" className="slot-win-burst" eager />
            <span className="display">{outcome.match === 3 ? t('spin.triple') : t('spin.double')}</span>
          </div>
        )}
        {outcome && (
          <div className="slots-banner display" role="status">
            {outcome.match === 3 ? t('spin.triple') : outcome.match === 2 ? t('spin.double') : t('spin.single', { n: outcome.winnerReels[0] + 1 })}
          </div>
        )}
      </div>
      <Lever pulled={lever} disabled={spinning} onPull={pull} label={t('spin.pull')} />
      <button className="btn btn-lime btn-lg btn-block" onClick={pull} disabled={spinning} style={{ marginTop: 30 }}>
        {spinning ? t('spin.spinning') : t('spin.pull')}
      </button>
      <p className="tiny dim" style={{ textAlign: 'center', marginTop: 8 }}>
        {t('spin.slotsRule')}
      </p>
    </div>
  );
}

// ───────────────────────────── Result ─────────────────────────────

function ResultCard({ f, label, onAdd }: { f: Fragrance; label?: string; onAdd: () => Promise<void> }) {
  const { t, tk } = useI18n();
  const { confetti, toast } = useUi();
  const [added, setAdded] = useState(false);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    confetti({ y: window.innerHeight * 0.45 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const color = familyColor(f.family);
  return (
    <section ref={ref} className={`result card card-xl c-${color === 'ink' ? 'lilac' : color} dots`} data-testid="spin-result" aria-live="polite">
      <Art name="spin-win" className="result-ribbon" eager />
      <div className="result-head">
        <span className="serif" style={{ fontSize: 26, whiteSpace: 'nowrap' }}>
          {t('spin.result')}
        </span>
        {label && <span className="sticker c-ink" style={{ alignSelf: 'flex-start' }}>{label}</span>}
      </div>
      <div className="result-main">
        <div className="result-bottle">
          <BottleImage fragrance={f} />
        </div>
        <div className="stack" style={{ ['--gap' as string]: '6px', minWidth: 0 }}>
          <span className="kicker">{f.brand}</span>
          <h2
            className="display result-name"
            data-testid="result-name"
            // Size to the longest word so names like "Aphrodisiac" stay whole.
            style={{ ['--longest' as string]: Math.max(8, ...f.name.split(/\s+/).map((w) => w.length)) }}
          >
            {f.name}
          </h2>
          {f.family && <span className="small" style={{ fontWeight: 700 }}>{resolveFamily(f.family)?.id ?? f.family}</span>}
          {f.accords.length > 0 && <Accords list={f.accords} max={4} />}
        </div>
      </div>
      {(f.notes.top.length > 0 || f.personality) && (
        <div className="result-notes small">
          {f.personality && <p className="serif" style={{ fontSize: 19 }}>“{f.personality}”</p>}
          {(['top', 'heart', 'base'] as const).map((k) =>
            f.notes[k].length ? (
              <p key={k}>
                <strong>{t(`profile.${k}`)}:</strong> {f.notes[k].join(', ')}
              </p>
            ) : null,
          )}
          {f.usage.seasons.length > 0 && (
            <p>
              <strong>{t('profile.seasons')}:</strong> {f.usage.seasons.map((s) => tk(`season.${s}`)).join(', ')}
            </p>
          )}
        </div>
      )}
      <div className="stack" style={{ ['--gap' as string]: '10px' }}>
        <button
          className="btn btn-ink btn-lg btn-block"
          disabled={added}
          data-testid="add-rotation"
          onClick={async () => {
            await onAdd();
            setAdded(true);
            vibrate([20, 30, 20]);
            toast(t('spin.added'), 'lime');
          }}
        >
          {added ? `✓ ${t('spin.added')}` : t('spin.addRotation')}
        </button>
        <Link to={`/perfume/${f.id}`} className="btn btn-block">
          {t('spin.fullProfile')}
        </Link>
      </div>
    </section>
  );
}
