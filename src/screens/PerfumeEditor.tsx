import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useStore, useAiState } from '../state/store';
import { useI18n } from '../i18n';
import { useUi } from '../state/ui';
import { AiLoader, ChipToggle, Notice, Segmented, Sheet, splitList, VerificationTag, EngineTag } from '../components/ui';
import { IconBack, IconCamera, IconSearch, Burst, Sparkle } from '../components/Icons';
import { BottleImage } from '../components/BottleImage';
import { ImagePicker } from '../components/ImagePicker';
import { allNotes, blankFragrance, fragranceKey } from '../domain/fragrance';
import { CONCENTRATIONS, OCCASIONS, SEASONS, TIMES, type Concentration, type Fragrance, type Level } from '../domain/types';
import { FAMILIES } from '../domain/families';
import { api, aiErrorMessage } from '../services/api';
import { blobToDataUrl, resizeImage } from '../services/images';
import { useAiConsent } from '../components/AiConsent';
import { applyResearch } from './research';
import type { IdentifyCandidate, IdentifyResponse, ImageCandidate } from '../shared/api';
import { vibrate, sfx } from '../services/feedback';
import { applyCatalog, loadCatalog, searchCatalog, type CatalogItem } from '../services/catalog';

type Step = 'start' | 'identifying' | 'candidates' | 'researching' | 'form';
type Mode = 'name' | 'photo' | 'manual';

export function PerfumeEditor() {
  const { id } = useParams();
  const editing = !!id;
  const { fragrances, saveFragrance } = useStore();
  const existing = editing ? fragrances.find((f) => f.id === id) : undefined;
  const { t, tk, lang } = useI18n();
  const { toast, confetti } = useUi();
  const nav = useNavigate();
  const ai = useAiState();
  const consent = useAiConsent();

  const [step, setStep] = useState<Step>(editing ? 'form' : 'start');
  const [mode, setMode] = useState<Mode>('name');
  const [search] = useSearchParams();
  const [query, setQuery] = useState(search.get('q') ?? '');
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [ident, setIdent] = useState<IdentifyResponse | null>(null);
  const [draft, setDraft] = useState<Fragrance>(() => existing ?? blankFragrance());
  const [imgCandidates, setImgCandidates] = useState<ImageCandidate[] | undefined>(undefined);
  const [dupe, setDupe] = useState(false);
  const [celebrate, setCelebrate] = useState<Fragrance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  useEffect(() => {
    void loadCatalog().then((c) => setCatalog(c.items));
  }, []);
  const catMatches = useMemo(() => (query.trim().length >= 2 ? searchCatalog(catalog, query, 6) : []), [catalog, query]);

  if (editing && !existing) {
    return (
      <main className="page">
        <p>{t('profile.notFound')}</p>
      </main>
    );
  }

  const cancelInflight = () => abortRef.current?.abort();

  const identify = async () => {
    setError(null);
    if (!(await consent.ensure())) return;
    setStep('identifying');
    cancelInflight();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const imageDataUrl = mode === 'photo' && photo ? await blobToDataUrl(await resizeImage(photo.blob, 1000, 'image/jpeg', 0.8)) : undefined;
      const res = await api.identify({ query: mode === 'name' ? query : query || undefined, imageDataUrl, lang }, ctrl.signal);
      setIdent(res);
      if (res.status === 'identified' && res.candidates.length === 1 && res.candidates[0].confidence === 'high') {
        await research(res.candidates[0]);
      } else {
        setStep('candidates');
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError(t('ai.error', { msg: aiErrorMessage(e, lang) }));
      setStep('start');
    }
  };

  const research = async (c: IdentifyCandidate) => {
    const conc = (CONCENTRATIONS as readonly string[]).includes(c.concentration) ? (c.concentration as Concentration) : draft.concentration;
    const base = { ...draft, brand: c.brand, name: c.name, concentration: conc };
    setDraft(base);
    setStep('researching');
    cancelInflight();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await api.research({ brand: c.brand, name: c.name, concentration: c.concentration, lang }, ctrl.signal);
      setDraft(applyResearch(base, res));
      setImgCandidates(res.imageCandidates);
      // A photo the user took to identify the bottle is the most accurate image we have.
      if (photo && !base.image) await attachPhoto(base);
      setStep('form');
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      toast(t('ai.error', { msg: aiErrorMessage(e, lang) }), 'error');
      setStep('form');
    }
  };

  const attachPhoto = async (base: Fragrance) => {
    if (!photo) return;
    const { putImage } = await import('../db/repo');
    const blob = await resizeImage(photo.blob, 1400, 'image/jpeg', 0.86);
    const key = await putImage(blob);
    setDraft((d) => ({ ...d, ...{ brand: d.brand || base.brand }, image: { kind: 'user_photo', blobKey: key, addedAt: new Date().toISOString() } }));
  };

  const startManual = async () => {
    cancelInflight();
    if (mode === 'name' && query.trim() && !draft.name) {
      const parts = query.trim().split(/\s+/);
      setDraft((d) => ({ ...d, brand: parts.length > 1 ? parts[0] : '', name: parts.length > 1 ? parts.slice(1).join(' ') : parts[0] }));
    }
    if (photo && !draft.image) await attachPhoto(draft);
    setStep('form');
  };

  const save = async (force = false) => {
    if (!draft.brand.trim() || !draft.name.trim()) {
      setError(t('form.required'));
      return;
    }
    if (!editing && !force && fragrances.some((f) => fragranceKey(f) === fragranceKey(draft))) {
      setDupe(true);
      return;
    }
    let toSave = draft;
    if (editing && existing) {
      const notesChanged = JSON.stringify(existing.notes) !== JSON.stringify(draft.notes);
      if (notesChanged) toSave = { ...toSave, noteSource: 'user' };
    } else if (!draft.research && allNotes(draft).length > 0) {
      toSave = { ...toSave, noteSource: 'user' };
    }
    const saved = await saveFragrance({ ...toSave, isSample: false });
    if (editing) {
      toast(t('set.saved'), 'lime');
      nav(`/perfume/${saved.id}`, { replace: true });
    } else {
      vibrate([20, 40, 20]);
      sfx.win();
      confetti();
      setCelebrate(saved);
    }
  };

  // ── Celebration overlay after adding ──
  if (celebrate) {
    return (
      <main className="page">
        <div className="added-reveal c-pink dots" data-testid="added-reveal">
          <Burst size={120} color="var(--lime)" className="rot-label added-burst">
            <span className="display" style={{ fontSize: 13, color: 'var(--ink)' }}>
              NEW!
            </span>
          </Burst>
          <div className="added-bottle">
            <BottleImage fragrance={celebrate} />
          </div>
          <h1 className="display" style={{ fontSize: 34 }}>
            {t('add.added')}
          </h1>
          <p style={{ fontWeight: 700 }}>{t('add.addedSub', { name: `${celebrate.brand} ${celebrate.name}` })}</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn btn-ink btn-lg" onClick={() => nav(`/perfume/${celebrate.id}`, { replace: true })}>
              {t('spin.fullProfile')}
            </button>
            <button
              className="btn"
              onClick={() => {
                setCelebrate(null);
                setDraft(blankFragrance());
                setQuery('');
                setPhoto(null);
                setIdent(null);
                setImgCandidates(undefined);
                setStep('start');
              }}
            >
              {t('wardrobe.add')}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page editor">
      <div className="topbar">
        <button
          className="btn btn-icon btn-sm"
          onClick={() => {
            cancelInflight();
            if (!editing && step !== 'start') setStep('start');
            else nav(-1);
          }}
          aria-label={t('common.back')}
        >
          <IconBack />
        </button>
        <h1 style={{ fontSize: 'clamp(22px, 7vw, 32px)' }}>{editing ? t('edit.title') : t('add.title')}</h1>
      </div>

      {error && (
        <p className="error-text" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </p>
      )}

      {step === 'start' && (
        <div className="stack">
          {!ai.available && ai.reason !== 'checking' && <Notice tone="warn">{ai.reason === 'offline' ? t('ai.offline') : t('add.aiOff')}</Notice>}
          <Segmented<Mode>
            options={['name', 'photo', 'manual'] as const}
            value={mode}
            onChange={setMode}
            render={(m) => t(m === 'name' ? 'add.byName' : m === 'photo' ? 'add.byPhoto' : 'add.manual')}
            label={t('add.title')}
          />
          {mode === 'name' && (
            <form
              className="card c-blue dots stack"
              onSubmit={(e) => {
                e.preventDefault();
                if (!query.trim()) return;
                if (ai.available) void identify();
                else void startManual();
              }}
            >
              <label className="label" htmlFor="q">
                {t('form.brand')} + {t('form.name')}
              </label>
              <div className="search-wrap">
                <IconSearch />
                <input id="q" className="input input-pill" style={{ color: 'var(--ink)' }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('add.namePlaceholder')} autoComplete="off" autoFocus />
              </div>
              <div className="row">
                <button className="btn btn-lime" type="submit" disabled={!query.trim()}>
                  {ai.available ? (
                    <>
                      <Sparkle size={16} /> {t('add.find')}
                    </>
                  ) : (
                    t('common.next')
                  )}
                </button>
                {ai.available && (
                  <button type="button" className="btn btn-ghost" style={{ color: 'inherit' }} onClick={() => void startManual()} disabled={!query.trim()}>
                    {t('add.withoutAi')}
                  </button>
                )}
              </div>
              {catMatches.length > 0 && (
                <div className="stack cat-matches" style={{ ['--gap' as string]: '8px' }} data-testid="catalog-matches">
                  <span className="label">{t('add.catalogMatches')}</span>
                  {catMatches.map((c) => (
                    <button
                      type="button"
                      key={`${c.b}|${c.n}|${c.c ?? ''}`}
                      className="cat-match"
                      data-testid="catalog-match"
                      onClick={() => {
                        cancelInflight();
                        setDraft((d) => applyCatalog(d, c));
                        setStep('form');
                      }}
                    >
                      <span className="kicker">{c.b}</span>
                      <strong>{c.n}</strong>
                      <span className="tiny">
                        {[c.c, c.col, c.ns !== 'none' ? tk(`src.${c.ns}`) : null].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </form>
          )}
          {mode === 'photo' && (
            <div className="card c-lime dots stack">
              <p style={{ fontWeight: 700 }}>{t('add.photoHint')}</p>
              {photo && <img src={photo.url} alt="" className="photo-preview" />}
              <label className="btn btn-ink" style={{ alignSelf: 'flex-start' }}>
                <IconCamera />
                {t('add.photoPick')}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  data-testid="photo-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (photo) URL.revokeObjectURL(photo.url);
                    setPhoto({ blob: file, url: URL.createObjectURL(file) });
                  }}
                />
              </label>
              <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('add.namePlaceholder')} aria-label={t('add.namePlaceholder')} />
              <div className="row">
                {ai.available && (
                  <button className="btn btn-primary" disabled={!photo} onClick={() => void identify()}>
                    <Sparkle size={16} /> {t('add.find')}
                  </button>
                )}
                <button className="btn" disabled={!photo} onClick={() => void startManual()}>
                  {t('add.withoutAi')}
                </button>
              </div>
            </div>
          )}
          {mode === 'manual' && (
            <div className="card stack">
              <p className="dim">{t('add.reviewSub')}</p>
              <button className="btn btn-primary" onClick={() => void startManual()}>
                {t('common.next')}
              </button>
            </div>
          )}
        </div>
      )}

      {step === 'identifying' && <AiLoader title={t('add.identifying')} />}
      {step === 'researching' && <AiLoader title={t('add.researching')} sub={t('add.researchingSub')} />}
      {(step === 'identifying' || step === 'researching') && (
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => void startManual()}>
            {t('add.skipResearch')}
          </button>
        </div>
      )}

      {step === 'candidates' && ident && (
        <div className="stack">
          <h2 className="display-lc" style={{ fontSize: 22 }}>
            {ident.candidates.length ? t('add.candidates') : t('add.notFound')}
          </h2>
          {ident.question && <p className="serif" style={{ fontSize: 20 }}>{ident.question}</p>}
          <div className="stack" style={{ ['--gap' as string]: '10px' }}>
            {ident.candidates.map((c, i) => (
              <button key={i} className="card card-press cand" onClick={() => void research(c)} data-testid="candidate">
                <span className="kicker dim">{c.brand}</span>
                <strong className="display-lc" style={{ fontSize: 18, display: 'block' }}>
                  {c.name}
                </strong>
                <span className="small dim">
                  {c.concentration} · {t(`conf.${c.confidence}`)}
                  {c.note ? ` · ${c.note}` : ''}
                </span>
              </button>
            ))}
          </div>
          <EngineTag engine={ident.engine} />
          <button className="btn" onClick={() => void startManual()}>
            {t('add.notListed')}
          </button>
        </div>
      )}

      {step === 'form' && (
        <FragranceForm
          draft={draft}
          setDraft={setDraft}
          candidates={imgCandidates}
          onSave={() => void save()}
          editing={editing}
        />
      )}

      <Sheet open={dupe} onClose={() => setDupe(false)} title={t('common.confirm')}>
        <div className="stack">
          <p style={{ fontWeight: 600 }}>{t('add.duplicate', { name: `${draft.brand} ${draft.name}` })}</p>
          <div className="row">
            <button
              className="btn btn-primary"
              onClick={() => {
                setDupe(false);
                void save(true);
              }}
            >
              {t('common.yes')}
            </button>
            <button className="btn btn-ghost" onClick={() => setDupe(false)}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </Sheet>
      {consent.element}
    </main>
  );
}

// ───────────────────────────── Form ─────────────────────────────

function ListInput({ label, value, onChange, hint, id }: { label: string; value: string[]; onChange: (v: string[]) => void; hint?: string; id: string }) {
  const [text, setText] = useState(value.join(', '));
  return (
    <label className="field" htmlFor={id}>
      <span className="label">{label}</span>
      <input
        id={id}
        className="input"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(splitList(e.target.value));
        }}
      />
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

function LevelSelect({ label, value, onChange }: { label: string; value: Level | undefined; onChange: (v: Level | undefined) => void }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <select className="select" value={value ?? ''} onChange={(e) => onChange(e.target.value ? (Number(e.target.value) as Level) : undefined)}>
        <option value="">—</option>
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}

function FragranceForm({
  draft,
  setDraft,
  candidates,
  onSave,
  editing,
}: {
  draft: Fragrance;
  setDraft: (f: Fragrance | ((f: Fragrance) => Fragrance)) => void;
  candidates?: ImageCandidate[];
  onSave: () => void;
  editing: boolean;
}) {
  const { t, tk } = useI18n();
  const set = (patch: Partial<Fragrance>) => setDraft((d) => ({ ...d, ...patch }));
  const setPerf = (k: keyof Fragrance['performance'], v: Level | undefined) =>
    setDraft((d) => ({ ...d, performance: { ...d.performance, [k]: v, basis: 'user' } }));
  const families = useMemo(() => FAMILIES.map((f) => f.id), []);

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      {!editing && (
        <div className="card c-lilac dots review-head">
          <div className="review-bottle">
            <BottleImage fragrance={draft} />
          </div>
          <div className="stack" style={{ ['--gap' as string]: '4px' }}>
            <span className="kicker">{t('add.review')}</span>
            <strong className="display-lc" style={{ fontSize: 20 }}>
              {draft.brand} {draft.name}
            </strong>
            <span className="small">{t('add.reviewSub')}</span>
            {draft.research && (
              <div className="row" style={{ ['--gap' as string]: '6px' }}>
                <VerificationTag status={draft.research.status} />
                <span className="tag">{tk(`src.${draft.noteSource}`)}</span>
                <EngineTag engine={draft.research.engine} />
              </div>
            )}
          </div>
        </div>
      )}

      <fieldset className="card stack fs">
        <legend className="display-lc">{t('form.identity')}</legend>
        <div className="grid-2">
          <label className="field">
            <span className="label">{t('form.brand')} *</span>
            <input className="input" required value={draft.brand} onChange={(e) => set({ brand: e.target.value })} name="brand" />
          </label>
          <label className="field">
            <span className="label">{t('form.name')} *</span>
            <input className="input" required value={draft.name} onChange={(e) => set({ name: e.target.value })} name="name" />
          </label>
        </div>
        <div className="grid-2">
          <label className="field">
            <span className="label">{t('form.concentration')}</span>
            <select className="select" value={draft.concentration} onChange={(e) => set({ concentration: e.target.value as Concentration })}>
              {CONCENTRATIONS.map((c) => (
                <option key={c} value={c}>
                  {c === 'Unknown' ? t('common.unknown') : c}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">{t('form.year')}</span>
            <input className="input" inputMode="numeric" value={draft.releaseYear ?? ''} onChange={(e) => set({ releaseYear: /^\d{4}$/.test(e.target.value) ? Number(e.target.value) : e.target.value ? draft.releaseYear : null })} placeholder="—" />
          </label>
        </div>
        <div className="grid-2">
          <label className="field">
            <span className="label">{t('form.perfumer')}</span>
            <input className="input" value={draft.perfumer ?? ''} onChange={(e) => set({ perfumer: e.target.value || null })} />
          </label>
          <label className="field">
            <span className="label">{t('form.country')}</span>
            <input className="input" value={draft.country ?? ''} onChange={(e) => set({ country: e.target.value || null })} />
          </label>
        </div>
      </fieldset>

      <fieldset className="card stack fs">
        <legend className="display-lc">{t('form.image')}</legend>
        <ImagePicker image={draft.image} onChange={(img) => set({ image: img })} candidates={candidates} />
      </fieldset>

      <fieldset className="card stack fs">
        <legend className="display-lc">{t('form.olfactory')}</legend>
        <label className="field">
          <span className="label">{t('form.family')}</span>
          <input className="input" list="families" value={draft.family} onChange={(e) => set({ family: e.target.value })} />
          <datalist id="families">
            {families.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </label>
        <ListInput id="accords" label={t('form.accords')} hint={t('form.accordsHint')} value={draft.accords} onChange={(v) => set({ accords: v.map((a) => a.toLowerCase()) })} />
        <ListInput id="top" label={t('form.top')} hint={t('form.notesHint')} value={draft.notes.top} onChange={(v) => setDraft((d) => ({ ...d, notes: { ...d.notes, top: v } }))} />
        <ListInput id="heart" label={t('form.heart')} value={draft.notes.heart} onChange={(v) => setDraft((d) => ({ ...d, notes: { ...d.notes, heart: v } }))} />
        <ListInput id="base" label={t('form.base')} value={draft.notes.base} onChange={(v) => setDraft((d) => ({ ...d, notes: { ...d.notes, base: v } }))} />
        <label className="field">
          <span className="label">{t('form.character')}</span>
          <textarea className="textarea" value={draft.character} onChange={(e) => set({ character: e.target.value })} />
        </label>
        <label className="field">
          <span className="label">{t('form.evolution')}</span>
          <textarea className="textarea" value={draft.evolution} onChange={(e) => set({ evolution: e.target.value })} />
        </label>
        <label className="field">
          <span className="label">{t('form.personality')}</span>
          <input className="input" value={draft.personality} onChange={(e) => set({ personality: e.target.value })} />
        </label>
      </fieldset>

      <fieldset className="card stack fs">
        <legend className="display-lc">{t('form.performance')}</legend>
        <div className="grid-2">
          <LevelSelect label={t('profile.longevity')} value={draft.performance.longevity} onChange={(v) => setPerf('longevity', v)} />
          <LevelSelect label={t('profile.projection')} value={draft.performance.projection} onChange={(v) => setPerf('projection', v)} />
          <LevelSelect label={t('profile.sillage')} value={draft.performance.sillage} onChange={(v) => setPerf('sillage', v)} />
          <LevelSelect label={t('profile.intensity')} value={draft.performance.intensity} onChange={(v) => setPerf('intensity', v)} />
        </div>
        <p className="hint">{t('profile.estimateNote')}</p>
      </fieldset>

      <fieldset className="card stack fs">
        <legend className="display-lc">{t('form.usage')}</legend>
        <div className="field">
          <span className="label">{t('profile.seasons')}</span>
          <ChipToggle options={SEASONS} value={draft.usage.seasons} onChange={(v) => setDraft((d) => ({ ...d, usage: { ...d.usage, seasons: v } }))} render={(s) => tk(`season.${s}`)} size="sm" />
        </div>
        <div className="field">
          <span className="label">{t('profile.times')}</span>
          <ChipToggle options={TIMES} value={draft.usage.times} onChange={(v) => setDraft((d) => ({ ...d, usage: { ...d.usage, times: v } }))} render={(s) => tk(`time.${s}`)} size="sm" />
        </div>
        <div className="field">
          <span className="label">{t('profile.occasions')}</span>
          <ChipToggle options={OCCASIONS} value={draft.usage.occasions} onChange={(v) => setDraft((d) => ({ ...d, usage: { ...d.usage, occasions: v } }))} render={(s) => tk(`occ.${s}`)} size="sm" />
        </div>
        <div className="field">
          <span className="label">{t('form.tempRange')}</span>
          <div className="grid-2">
            <input
              className="input"
              type="number"
              aria-label={t('form.min')}
              placeholder={t('form.min')}
              value={draft.usage.tempMinC ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, usage: { ...d.usage, tempMinC: e.target.value === '' ? undefined : Number(e.target.value) } }))}
            />
            <input
              className="input"
              type="number"
              aria-label={t('form.max')}
              placeholder={t('form.max')}
              value={draft.usage.tempMaxC ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, usage: { ...d.usage, tempMaxC: e.target.value === '' ? undefined : Number(e.target.value) } }))}
            />
          </div>
        </div>
      </fieldset>

      <div className="sticky-save">
        <button className="btn btn-primary btn-lg btn-block" type="submit" data-testid="save-perfume">
          {editing ? t('common.save') : t('add.saveToShelf')}
        </button>
      </div>
    </form>
  );
}
