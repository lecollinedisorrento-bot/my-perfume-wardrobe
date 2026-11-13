import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStore, useAiState } from '../state/store';
import { useI18n } from '../i18n';
import { useUi } from '../state/ui';
import { BottleImage } from '../components/BottleImage';
import { AiLoader, EngineTag, Notice, Segmented, Sheet, Stars } from '../components/ui';
import { IconShare, IconTrash, IconSparkle, Sparkle } from '../components/Icons';
import { rankLocalPartners, localLayerSuggestion, type LayerSuggestion } from '../domain/layering';
import type { Combination, Fragrance } from '../domain/types';
import { familyColor } from '../domain/families';
import { api, aiErrorMessage, toCollectionItem, toPrefsCtx } from '../services/api';
import { useAiConsent } from '../components/AiConsent';
import { nowIso, uid } from '../domain/util';
import { shareComboCard } from '../services/shareCard';
import { vibrate } from '../services/feedback';

type Suggestion = Omit<LayerSuggestion, 'reasonsKeys'> & { reasonsKeys?: string[]; engineLabel: string };

export default function LayerLab() {
  const { fragrances, wears, prefs, combinations, saveCombination } = useStore();
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<'new' | 'notebook'>(params.get('combo') ? 'notebook' : 'new');
  const [primaryId, setPrimaryId] = useState<string | null>(params.get('primary'));
  const primary = fragrances.find((f) => f.id === primaryId) ?? null;

  if (fragrances.length < 2) {
    return (
      <main className="page">
        <div className="topbar">
          <h1>{t('lab.title')}</h1>
        </div>
        <div className="empty card c-lime dots">
          <Sparkle size={56} color="var(--pink)" className="float" />
          <h2>{t('lab.needTwo')}</h2>
          <Link className="btn btn-ink" to="/wardrobe/new">
            {t('wardrobe.add')}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page lab">
      <div className="topbar">
        <h1>{t('lab.title')}</h1>
      </div>
      <Segmented<'new' | 'notebook'>
        options={['new', 'notebook'] as const}
        value={tab}
        onChange={(v) => {
          setTab(v);
          if (v === 'new') setParams({}, { replace: true });
        }}
        render={(v) => (v === 'new' ? t('lab.tabNew') : `${t('lab.tabNotebook')} · ${combinations.length}`)}
        label={t('lab.title')}
      />
      <div style={{ height: 16 }} />
      {tab === 'new' ? (
        <NewExperiment
          primary={primary}
          setPrimary={(id) => {
            setPrimaryId(id);
            setParams(id ? { primary: id } : {}, { replace: true });
          }}
          fragrances={fragrances}
          onSaved={() => setTab('notebook')}
          saveCombination={saveCombination}
          wears={wears}
          prefs={prefs}
        />
      ) : (
        <Notebook focusId={params.get('combo')} />
      )}
    </main>
  );
}

function NewExperiment({
  primary,
  setPrimary,
  fragrances,
  onSaved,
  saveCombination,
  wears,
  prefs,
}: {
  primary: Fragrance | null;
  setPrimary: (id: string | null) => void;
  fragrances: Fragrance[];
  onSaved: () => void;
  saveCombination: (c: Combination) => Promise<void>;
  wears: ReturnType<typeof useStore>['wears'];
  prefs: ReturnType<typeof useStore>['prefs'];
}) {
  const { t, lang } = useI18n();
  const { toast, confetti } = useUi();
  const ai = useAiState();
  const consent = useAiConsent();
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    setSuggestions(null);
    setSelected(null);
    setNotice(null);
  }, [primary?.id]);

  const find = async () => {
    if (!primary) return;
    setNotice(null);
    const others = fragrances.filter((f) => f.id !== primary.id);
    const local = (): Suggestion[] => rankLocalPartners(primary, fragrances).slice(0, 5).map((s) => ({ ...s, engineLabel: 'local' }));
    if (!ai.available) {
      setNotice(ai.reason === 'offline' ? t('ai.offline') : t('ai.notConfigured'));
      setSuggestions(local());
      return;
    }
    if (!(await consent.ensure())) {
      setSuggestions(local());
      return;
    }
    setBusy(true);
    try {
      const res = await api.layer({
        primary: toCollectionItem(primary, wears, true),
        candidates: others.map((f) => toCollectionItem(f, wears, true)),
        prefs: toPrefsCtx(prefs),
        lang,
      });
      setSuggestions(
        res.suggestions.map((s) => ({
          ...s,
          primaryId: primary.id,
          engine: 'ai' as const,
          engineLabel: res.engine,
        })),
      );
    } catch (e) {
      setNotice(t('ai.error', { msg: aiErrorMessage(e, lang) }));
      setSuggestions(local());
    } finally {
      setBusy(false);
    }
  };

  const save = async (s: Suggestion) => {
    const c: Combination = {
      id: uid('c_'),
      createdAt: nowIso(),
      primaryId: s.primaryId,
      secondaryId: s.secondaryId,
      order: s.order,
      sprayDistribution: s.sprayDistribution,
      interaction: s.interaction,
      impression: s.impression,
      occasions: s.occasions,
      conflicts: s.conflicts,
      explanation: s.explanation || (s.reasonsKeys ?? []).map((k) => t(k as never)).join(' '),
      compatibility: s.compatibility,
      engine: s.engine,
      rating: null,
      notes: '',
      success: null,
    };
    await saveCombination(c);
    vibrate([20, 30, 20]);
    confetti();
    toast(t('lab.saved'), 'lime');
    onSaved();
  };

  return (
    <div className="stack">
      <p className="dim" style={{ fontWeight: 600 }}>
        {t('lab.sub')}
      </p>
      <div className="field">
        <span className="label">{t('lab.choose')}</span>
        <div className="hscroll picker">
          {fragrances.map((f) => (
            <button key={f.id} className={`pick-bottle ${primary?.id === f.id ? 'on' : ''}`} onClick={() => setPrimary(f.id)} aria-pressed={primary?.id === f.id}>
              <span className={`pick-thumb c-${familyColor(f.family) === 'ink' ? 'lilac' : familyColor(f.family)}`}>
                <BottleImage fragrance={f} />
              </span>
              <span className="tiny" style={{ fontWeight: 800 }}>
                {f.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {primary && (
        <div className="row">
          <button className="btn btn-primary" onClick={() => void find()} disabled={busy} data-testid="find-partners">
            <IconSparkle />
            {t('lab.find')}
          </button>
          <button className="link-btn small" onClick={() => setManualOpen(true)}>
            {t('lab.manualPick')}
          </button>
        </div>
      )}
      {notice && <Notice tone="warn">{notice}</Notice>}
      {busy && <AiLoader title={t('ai.thinking')} />}

      {suggestions && primary && !busy && (
        <section>
          <h2 className="h-sec">{t('lab.suggestions')}</h2>
          <div className="stack" style={{ ['--gap' as string]: '10px' }}>
            {suggestions.map((s) => {
              const b = fragrances.find((f) => f.id === s.secondaryId);
              if (!b) return null;
              return (
                <button key={s.secondaryId} className="card card-press sugg" onClick={() => setSelected(s)} data-testid="layer-suggestion">
                  <span className="sugg-bottles">
                    <BottleImage fragrance={primary} />
                    <span className="plus display">+</span>
                    <BottleImage fragrance={b} />
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <strong className="display-lc" style={{ fontSize: 16, display: 'block' }}>
                      {b.name}
                    </strong>
                    <span className="tiny dim">{b.brand}</span>
                    <span className="small" style={{ display: 'block', marginTop: 4 }}>
                      {s.interaction}
                    </span>
                  </span>
                  <ScoreDial value={s.compatibility} />
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 10 }}>
            <EngineTag engine={suggestions[0]?.engineLabel} />
          </div>
          <p className="tiny dim" style={{ marginTop: 6 }}>
            {t('lab.scoreNote')}
          </p>
        </section>
      )}

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={t('lab.title')}>
        {selected && primary && (
          <ComboDetail
            a={primary}
            b={fragrances.find((f) => f.id === selected.secondaryId)!}
            s={selected}
            engine={selected.engineLabel}
            footer={
              <button className="btn btn-primary btn-lg btn-block" onClick={() => void save(selected)} data-testid="save-combo">
                {t('lab.save')}
              </button>
            }
          />
        )}
      </Sheet>

      <Sheet open={manualOpen} onClose={() => setManualOpen(false)} title={t('lab.manualPick')}>
        <div className="stack" style={{ ['--gap' as string]: '8px' }}>
          {primary &&
            fragrances
              .filter((f) => f.id !== primary.id)
              .map((f) => (
                <button
                  key={f.id}
                  className="chip"
                  style={{ justifyContent: 'flex-start' }}
                  onClick={() => {
                    setManualOpen(false);
                    setSelected({ ...localLayerSuggestion(primary, f), engine: 'manual', engineLabel: 'local' });
                  }}
                >
                  {f.brand} — {f.name}
                </button>
              ))}
        </div>
      </Sheet>
      {consent.element}
    </div>
  );
}

export function ScoreDial({ value }: { value: number }) {
  const { t } = useI18n();
  const deg = Math.round((value / 100) * 360);
  return (
    <span className="score-dial" style={{ ['--deg' as string]: `${deg}deg` }} aria-label={`${t('lab.score')} ${value}/100`}>
      <span className="display">{value}</span>
    </span>
  );
}

function ComboDetail({
  a,
  b,
  s,
  engine,
  footer,
}: {
  a: Fragrance;
  b: Fragrance;
  s: Pick<Combination, 'order' | 'sprayDistribution' | 'interaction' | 'impression' | 'occasions' | 'conflicts' | 'explanation' | 'compatibility'> & { reasonsKeys?: string[] };
  engine: string;
  footer?: React.ReactNode;
}) {
  const { t, tk } = useI18n();
  const conflicts = s.conflicts.startsWith('lab.c.') ? tk(s.conflicts) : s.conflicts;
  const explanation = s.explanation || (s.reasonsKeys ?? []).map((k) => tk(k)).join(' ');
  return (
    <div className="stack">
      <div className="mixer c-lilac dots" aria-hidden="true">
        <div className="mix-bottle left">
          <BottleImage fragrance={a} />
        </div>
        <div className="mix-swirl">
          <span className="display">{t('lab.mix')}</span>
        </div>
        <div className="mix-bottle right">
          <BottleImage fragrance={b} />
        </div>
      </div>
      <div className="row nowrap">
        <div style={{ minWidth: 0 }}>
          <strong className="display-lc" style={{ fontSize: 18 }}>
            {a.name} + {b.name}
          </strong>
          <div className="tiny dim">
            {a.brand} · {b.brand}
          </div>
        </div>
        <span className="spacer" />
        <ScoreDial value={s.compatibility} />
      </div>
      <dl className="combo-facts">
        <dt>{t('lab.order')}</dt>
        <dd>{s.order}</dd>
        <dt>{t('lab.spray')}</dt>
        <dd>{s.sprayDistribution}</dd>
        <dt>{t('lab.interaction')}</dt>
        <dd>{s.interaction}</dd>
        {s.impression && (
          <>
            <dt>{t('lab.impression')}</dt>
            <dd>{s.impression}</dd>
          </>
        )}
        {s.occasions.length > 0 && (
          <>
            <dt>{t('lab.occasions')}</dt>
            <dd>{s.occasions.map((o) => (tk(`occ.${o}`) === `occ.${o}` ? o : tk(`occ.${o}`))).join(', ')}</dd>
          </>
        )}
        <dt>{t('lab.conflicts')}</dt>
        <dd>{conflicts || t('lab.noConflicts')}</dd>
        {explanation && (
          <>
            <dt>{t('lab.explanation')}</dt>
            <dd>{explanation}</dd>
          </>
        )}
      </dl>
      <EngineTag engine={engine} />
      <p className="tiny dim">{t('lab.scoreNote')}</p>
      {footer}
    </div>
  );
}

function Notebook({ focusId }: { focusId: string | null }) {
  const { combinations, fragrances, saveCombination, deleteCombination, wearToday } = useStore();
  const { t } = useI18n();
  const { toast } = useUi();
  const [openId, setOpenId] = useState<string | null>(focusId);
  const list = useMemo(() => [...combinations].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [combinations]);
  const open = list.find((c) => c.id === openId) ?? null;
  const [notes, setNotes] = useState('');
  useEffect(() => {
    setNotes(open?.notes ?? '');
  }, [open?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!list.length) return <p className="dim">{t('lab.notebookEmpty')}</p>;
  const a = open ? fragrances.find((f) => f.id === open.primaryId) : null;
  const b = open ? fragrances.find((f) => f.id === open.secondaryId) : null;

  return (
    <>
      <div className="stack" style={{ ['--gap' as string]: '10px' }}>
        {list.map((c) => {
          const fa = fragrances.find((f) => f.id === c.primaryId);
          const fb = fragrances.find((f) => f.id === c.secondaryId);
          if (!fa || !fb) return null;
          return (
            <button key={c.id} className="card card-press sugg" onClick={() => setOpenId(c.id)} data-testid="notebook-entry">
              <span className="sugg-bottles">
                <BottleImage fragrance={fa} />
                <span className="plus display">+</span>
                <BottleImage fragrance={fb} />
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <strong className="display-lc" style={{ fontSize: 15, display: 'block' }}>
                  {fa.name} + {fb.name}
                </strong>
                <span className="tiny dim">
                  {new Date(c.createdAt).toLocaleDateString()}
                  {c.success === true ? ` · ✓ ${t('lab.success')}` : c.success === false ? ` · ✗ ${t('lab.fail')}` : ''}
                </span>
                {c.rating != null && <Stars value={c.rating} readonly label={t('profile.rating')} />}
              </span>
              <ScoreDial value={c.compatibility} />
            </button>
          );
        })}
      </div>
      <Sheet open={!!open} onClose={() => setOpenId(null)} title={t('lab.notebook')}>
        {open && a && b && (
          <ComboDetail
            a={a}
            b={b}
            s={open}
            engine={open.engine === 'ai' ? 'ai:saved' : 'local'}
            footer={
              <div className="stack">
                <div className="field">
                  <span className="label">{t('profile.rating')}</span>
                  <Stars value={open.rating} onChange={(v) => void saveCombination({ ...open, rating: v })} label={t('profile.rating')} />
                </div>
                <div className="row">
                  <button className="chip" aria-pressed={open.success === true} onClick={() => void saveCombination({ ...open, success: open.success === true ? null : true })}>
                    ✓ {t('lab.success')}
                  </button>
                  <button className="chip" aria-pressed={open.success === false} onClick={() => void saveCombination({ ...open, success: open.success === false ? null : false })}>
                    ✗ {t('lab.fail')}
                  </button>
                </div>
                <label className="field">
                  <span className="label">{t('lab.notes')}</span>
                  <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== open.notes && void saveCombination({ ...open, notes })} />
                </label>
                <div className="row">
                  <button
                    className="btn btn-lime"
                    onClick={async () => {
                      await wearToday(a.id, 'layer', b.id);
                      toast(t('spin.added'), 'lime');
                    }}
                  >
                    {t('lab.wearCombo')}
                  </button>
                  <button
                    className="btn"
                    onClick={async () => {
                      const r = await shareComboCard(a, b, open, t);
                      if (r === 'downloaded') toast(t('share.done'));
                    }}
                  >
                    <IconShare />
                    {t('lab.share')}
                  </button>
                  <button
                    className="btn btn-ghost"
                    aria-label={t('common.delete')}
                    onClick={async () => {
                      if (!window.confirm(t('lab.deleteConfirm'))) return;
                      await deleteCombination(open.id);
                      setOpenId(null);
                    }}
                  >
                    <IconTrash />
                  </button>
                </div>
              </div>
            }
          />
        )}
      </Sheet>
    </>
  );
}
