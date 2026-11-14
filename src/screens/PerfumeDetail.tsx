import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStore, useAiState } from '../state/store';
import { useI18n } from '../i18n';
import { useUi } from '../state/ui';
import { useRelativeDay } from '../state/hooks';
import { BottleImage } from '../components/BottleImage';
import { Accords, AiLoader, EngineTag, FavButton, Meter, Sheet, Stars, VerificationTag } from '../components/ui';
import { IconBack, IconFlask, IconPencil, IconRefresh, IconTrash, Burst } from '../components/Icons';
import { accordColor, familyColor, resolveFamily } from '../domain/families';
import { OCCASIONS, SEASONS, TIMES, type Fragrance } from '../domain/types';
import { localDay } from '../domain/util';
import { api, aiErrorMessage } from '../services/api';
import { useAiConsent } from '../components/AiConsent';
import { applyResearch } from './research';
import { ImagePicker } from '../components/ImagePicker';
import type { ImageCandidate } from '../shared/api';
import { useTemp } from '../components/Weather';
import { vibrate } from '../services/feedback';
import { allNotes, hasProfile } from '../domain/fragrance';
import { applyCatalog, catalogHasNews, findCatalogMatch, loadCatalog, type CatalogItem } from '../services/catalog';

export function PerfumeDetail() {
  const { id } = useParams();
  const { fragrances, wears, saveFragrance, deleteFragrance, toggleFavorite, setRating, wearToday, removeWear, prefs } = useStore();
  const { t, tk, lang, locale } = useI18n();
  const { toast, confetti } = useUi();
  const nav = useNavigate();
  const ai = useAiState();
  const consent = useAiConsent();
  const rel = useRelativeDay();
  const fmt = useTemp();
  const f = fragrances.find((x) => x.id === id);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [tier, setTier] = useState<'top' | 'heart' | 'base' | null>(null);
  const [notes, setNotes] = useState(f?.personalNotes ?? '');
  const [exp, setExp] = useState(f?.experience ?? '');
  const [candidates, setCandidates] = useState<ImageCandidate[] | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [catMatch, setCatMatch] = useState<CatalogItem | null>(null);
  useEffect(() => {
    setCatMatch(null);
    if (!f || f.research) return;
    let alive = true;
    void loadCatalog().then((c) => alive && setCatMatch(findCatalogMatch(c.items, f.brand, f.name)));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f?.id, f?.research]);

  useEffect(() => {
    setNotes(f?.personalNotes ?? '');
    setExp(f?.experience ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f?.id]);

  const history = useMemo(() => wears.filter((w) => w.fragranceId === id || w.secondaryId === id).sort((a, b) => b.at.localeCompare(a.at)), [wears, id]);

  if (!f) {
    return (
      <main className="page">
        <div className="empty">
          <h2>{t('profile.notFound')}</h2>
          <Link className="btn btn-primary" to="/wardrobe">
            {t('nav.wardrobe')}
          </Link>
        </div>
      </main>
    );
  }

  const color = familyColor(f.family);
  const surface = color === 'ink' ? 'ink' : color;
  const wornToday = history.some((w) => w.day === localDay() && w.fragranceId === f.id);
  const status = f.research?.status ?? (hasProfile(f) ? 'user_entered' : 'unverified');

  const research = async () => {
    if (!(await consent.ensure())) return;
    if (f.noteSource === 'user' && !window.confirm(t('common.confirm'))) return;
    setBusy(true);
    try {
      const res = await api.research({ brand: f.brand, name: f.name, concentration: f.concentration, lang });
      const next = applyResearch(f, res);
      await saveFragrance({ ...next, isSample: false });
      toast(t('profile.updated'), 'lime');
      if (!f.image) setCandidates(res.imageCandidates);
    } catch (e) {
      toast(t('ai.error', { msg: aiErrorMessage(e, lang) }), 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveText = (patch: Partial<Fragrance>) => void saveFragrance({ ...f, ...patch });

  return (
    <main className="page detail">
      <div className="topbar">
        <button className="btn btn-icon btn-sm" onClick={() => (window.history.length > 1 ? nav(-1) : nav('/wardrobe'))} aria-label={t('common.back')}>
          <IconBack />
        </button>
        <span className="spacer" />
        <Link to={`/perfume/${f.id}/edit`} className="btn btn-icon btn-sm" aria-label={t('common.edit')}>
          <IconPencil />
        </Link>
        <button className="btn btn-icon btn-sm" onClick={() => setConfirmDel(true)} aria-label={t('common.delete')}>
          <IconTrash />
        </button>
      </div>

      <section className={`detail-hero c-${surface} dots`}>
        <div className="detail-bottle">
          <BottleImage fragrance={f} showLabel />
        </div>
        <span className="detail-fav">
          <FavButton on={f.favorite} onToggle={() => void toggleFavorite(f.id)} />
        </span>
        {f.concentration !== 'Unknown' && (
          <Burst size={86} color="var(--lime)" className="detail-burst">
            <span className="display" style={{ fontSize: 9, color: 'var(--ink)', display: 'block', maxWidth: 60, lineHeight: 1.1 }}>
              {f.concentration}
            </span>
          </Burst>
        )}
      </section>

      <header className="detail-title">
        <span className="kicker">{f.brand}</span>
        <h1 className="display">{f.name}</h1>
        {f.personality && <p className="serif" style={{ fontSize: 22, lineHeight: 1.15 }}>“{f.personality}”</p>}
        <div className="row" style={{ marginTop: 6 }}>
          <VerificationTag status={status} />
          {f.noteSource !== 'none' && <span className="tag">{tk(`src.${f.noteSource}`)}</span>}
          {f.research && <span className="tag">{tk(`conf.${f.research.confidence}`)}</span>}
        </div>
      </header>

      <div className="row detail-actions">
        <button
          className="btn btn-lime"
          disabled={wornToday}
          onClick={async (e) => {
            await wearToday(f.id, 'manual');
            vibrate(20);
            confetti({ x: e.clientX, y: e.clientY });
          }}
        >
          {wornToday ? t('profile.wornToday') : t('profile.wearToday')}
        </button>
        <Link to={`/lab?primary=${f.id}`} className="btn">
          <IconFlask />
          {t('profile.layerWith')}
        </Link>
        {ai.available && (
          <button className="btn btn-pink" onClick={() => void research()} disabled={busy}>
            <IconRefresh />
            {f.research ? t('profile.refresh') : t('profile.research')}
          </button>
        )}
      </div>

      {catMatch && catalogHasNews(f, catMatch) && (
        <section className="card c-lime dots section stack" style={{ ['--gap' as string]: '10px' }} data-testid="catalog-fill">
          <p style={{ fontWeight: 700 }}>{t('profile.catalogFound')}</p>
          <button
            className="btn btn-ink"
            style={{ alignSelf: 'flex-start' }}
            onClick={async () => {
              await saveFragrance({ ...applyCatalog(f, catMatch), isSample: false });
              toast(t('profile.updated'), 'lime');
            }}
          >
            {f.research ? t('profile.catalogUpdate') : t('profile.catalogFill')}
          </button>
        </section>
      )}

      {busy && <AiLoader title={t('add.researching')} sub={t('add.researchingSub')} />}

      {candidates && (
        <section className="card section">
          <ImagePicker
            image={f.image}
            candidates={candidates}
            onChange={async (img) => {
              await saveFragrance({ ...f, image: img });
              if (img) setCandidates(null);
            }}
          />
        </section>
      )}

      {/* Provenance */}
      <section className="card section provenance" data-testid="provenance">
        <div className="row">
          <strong className="display-lc" style={{ fontSize: 15 }}>
            {tk(`ver.${status}`)}
          </strong>
          {f.research && <EngineTag engine={f.research.engine} />}
        </div>
        <p className="small dim">{tk(`ver.${status}.sub`)}</p>
        {f.research && f.research.droppedUnsupported.filter((d) => !d.startsWith('invalid_source_refs')).length > 0 && (
          <p className="tiny dim">{t('profile.dropped', { fields: f.research.droppedUnsupported.filter((d) => !d.startsWith('invalid')).join(', ') })}</p>
        )}
        {f.research && (
          <>
            <button className="link-btn small" onClick={() => setShowSources((v) => !v)} aria-expanded={showSources}>
              {t('profile.sources')} ({f.research.sources.length})
            </button>
            {showSources && (
              <ul className="sources">
                {f.research.sources.length === 0 && <li className="dim small">{t('profile.noSources')}</li>}
                {f.research.sources.map((s) => (
                  <li key={s.url}>
                    <span className="tag">{tk(`srcType.${s.type}`)}</span>{' '}
                    <a href={s.url} target="_blank" rel="noopener noreferrer">
                      {s.name}
                    </a>
                    <span className="tiny dim">
                      {' '}
                      · {t('profile.retrieved', { date: s.retrievedAt })}
                      {s.supports.length ? ` · ${t('profile.supports', { facts: s.supports.join(', ') })}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {/* Identity */}
      <section className="section">
        <h2 className="h-sec">{t('profile.identity')}</h2>
        <dl className="facts">
          <div>
            <dt>{t('form.concentration')}</dt>
            <dd>{f.concentration === 'Unknown' ? t('common.unknown') : f.concentration}</dd>
          </div>
          <div>
            <dt>{t('form.family')}</dt>
            <dd>{f.family ? resolveFamily(f.family)?.id ?? f.family : '—'}</dd>
          </div>
          <div>
            <dt>{t('form.year')}</dt>
            <dd>{f.releaseYear ?? '—'}</dd>
          </div>
          <div>
            <dt>{t('form.perfumer')}</dt>
            <dd>{f.perfumer ?? '—'}</dd>
          </div>
          <div>
            <dt>{t('form.country')}</dt>
            <dd>{f.country ?? '—'}</dd>
          </div>
        </dl>
      </section>

      {/* Notes pyramid */}
      <section className="section">
        <div className="row">
          <h2 className="h-sec">{t('profile.notes')}</h2>
          {f.noteSource !== 'none' && <span className="tag">{tk(`src.${f.noteSource}`)}</span>}
        </div>
        {allNotes(f).length === 0 ? (
          <p className="dim small">{t('profile.noNotes')}</p>
        ) : (
          <div className="pyramid" role="list">
            {(f.notes.top.length + f.notes.heart.length + f.notes.base.length > 0 ? (['top', 'heart', 'base'] as const) : []).map((k, i) => (
              <button
                key={k}
                role="listitem"
                className={`tier tier-${k} ${tier === k ? 'on' : ''} ${tier && tier !== k ? 'off' : ''}`}
                style={{ ['--w' as string]: `${62 + i * 19}%` }}
                onClick={() => setTier((v) => (v === k ? null : k))}
                aria-pressed={tier === k}
              >
                <span className="tier-label">{t(`profile.${k}`)}</span>
                <span className="tier-notes">{f.notes[k].length ? f.notes[k].join(' · ') : '—'}</span>
              </button>
            ))}
            {f.notes.flat.length > 0 && (
              <div role="listitem" className="tier tier-flat" style={{ ['--w' as string]: '100%' }}>
                <span className="tier-label">{t('profile.notesFlat')}</span>
                <span className="tier-notes">{f.notes.flat.join(' · ')}</span>
              </div>
            )}
          </div>
        )}
      </section>

      {f.accords.length > 0 && (
        <section className="section">
          <h2 className="h-sec">{t('profile.accords')}</h2>
          <div className="accord-bars">
            {f.accords.slice(0, 8).map((a, i) => (
              <div key={a} className="accord-bar" style={{ ['--w' as string]: `${100 - i * 10}%`, ['--i' as string]: i }}>
                <span className={`accord-fill c-${accordColor(a)}`} />
                <Accords list={[a]} />
              </div>
            ))}
          </div>
        </section>
      )}

      {(f.character || f.evolution) && (
        <section className="section stack">
          {f.character && (
            <div>
              <h2 className="h-sec">{t('profile.character')}</h2>
              <p className="editorial">{f.character}</p>
            </div>
          )}
          {f.evolution && (
            <div>
              <h2 className="h-sec">{t('profile.evolution')}</h2>
              <p className="editorial">{f.evolution}</p>
            </div>
          )}
        </section>
      )}

      <section className="section card">
        <div className="row" style={{ marginBottom: 10 }}>
          <h2 className="h-sec" style={{ margin: 0 }}>
            {t('profile.performance')}
          </h2>
          <span className="sticker flat c-lilac">{f.performance.basis === 'user' ? t('profile.yours') : t('profile.estimate')}</span>
        </div>
        <div className="stack" style={{ ['--gap' as string]: '10px' }}>
          <Meter label={t('profile.longevity')} value={f.performance.longevity} color="blue" />
          <Meter label={t('profile.projection')} value={f.performance.projection} color="pink" />
          <Meter label={t('profile.sillage')} value={f.performance.sillage} color="tangerine" />
          <Meter label={t('profile.intensity')} value={f.performance.intensity} color="lime" />
        </div>
        <p className="tiny dim" style={{ marginTop: 10 }}>
          {t('profile.estimateNote')}
        </p>
      </section>

      <section className="section">
        <h2 className="h-sec">{t('profile.usage')}</h2>
        <div className="usage-grid">
          <div>
            <span className="label">{t('profile.seasons')}</span>
            <div className="chips">
              {SEASONS.map((s) => (
                <span key={s} className={`chip chip-sm ${f.usage.seasons.includes(s) ? 'on' : 'muted'}`}>
                  {tk(`season.${s}`)}
                </span>
              ))}
            </div>
          </div>
          <div>
            <span className="label">{t('profile.times')}</span>
            <div className="chips">
              {TIMES.map((s) => (
                <span key={s} className={`chip chip-sm ${f.usage.times.includes(s) ? 'on' : 'muted'}`}>
                  {tk(`time.${s}`)}
                </span>
              ))}
            </div>
          </div>
          <div>
            <span className="label">{t('profile.occasions')}</span>
            <div className="chips">
              {OCCASIONS.map((s) => (
                <span key={s} className={`chip chip-sm ${(f.usage.occasions as string[]).includes(s) ? 'on' : 'muted'}`}>
                  {tk(`occ.${s}`)}
                </span>
              ))}
            </div>
          </div>
          {f.usage.tempMinC != null && f.usage.tempMaxC != null && (
            <div>
              <span className="label">{t('profile.temp')}</span>
              <p style={{ fontWeight: 700 }}>{t('profile.tempVal', { min: fmt(f.usage.tempMinC).replace('°', ''), max: fmt(f.usage.tempMaxC).replace('°', '') })}</p>
            </div>
          )}
        </div>
        <p className="tiny dim" style={{ marginTop: 8 }}>
          {t('profile.tendency')}
        </p>
      </section>

      <section className="section card c-surface stack" aria-labelledby="yours-h">
        <h2 id="yours-h" className="h-sec" style={{ margin: 0 }}>
          {t('profile.personal')}
        </h2>
        <div className="field">
          <span className="label">{t('profile.rating')}</span>
          <Stars value={f.rating} onChange={(v) => void setRating(f.id, v)} label={t('profile.rating')} />
        </div>
        <label className="field">
          <span className="label">{t('profile.notesPersonal')}</span>
          <textarea className="textarea" value={notes} placeholder={t('profile.notesPlaceholder')} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== f.personalNotes && saveText({ personalNotes: notes })} />
        </label>
        <label className="field">
          <span className="label">{t('profile.experience')}</span>
          <textarea className="textarea" value={exp} placeholder={t('profile.experiencePlaceholder')} onChange={(e) => setExp(e.target.value)} onBlur={() => exp !== f.experience && saveText({ experience: exp })} />
        </label>
        <dl className="facts">
          <div>
            <dt>{t('profile.lastWorn')}</dt>
            <dd>{rel(history[0]?.day)}</dd>
          </div>
          <div>
            <dt>{t('profile.wearCount')}</dt>
            <dd>{history.filter((w) => w.fragranceId === f.id).length}</dd>
          </div>
        </dl>
        {history.length > 0 && (
          <details>
            <summary className="link-btn small">{t('profile.history')}</summary>
            <ul className="history">
              {history.slice(0, 40).map((w) => {
                const other = w.secondaryId ? fragrances.find((x) => x.id === (w.fragranceId === f.id ? w.secondaryId : w.fragranceId)) : null;
                return (
                  <li key={w.id} className="row nowrap">
                    <span>
                      {new Date(w.day + 'T12:00').toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
                      {other ? ` · + ${other.name}` : ''}
                      {w.weather ? ` · ${Math.round(prefs.units === 'imperial' ? w.weather.tempC * 1.8 + 32 : w.weather.tempC)}°` : ''}
                    </span>
                    <span className="spacer" />
                    <button className="btn btn-ghost btn-sm" onClick={() => void removeWear(w.id)} aria-label={t('common.delete')}>
                      <IconTrash />
                    </button>
                  </li>
                );
              })}
            </ul>
          </details>
        )}
      </section>

      <Sheet open={confirmDel} onClose={() => setConfirmDel(false)} title={t('common.delete')}>
        <div className="stack">
          <p style={{ fontWeight: 600 }}>{t('profile.deleteConfirm', { name: `${f.brand} ${f.name}` })}</p>
          <div className="row">
            <button
              className="btn btn-danger"
              data-autofocus
              onClick={async () => {
                await deleteFragrance(f.id);
                toast(t('profile.deleted'));
                nav('/wardrobe', { replace: true });
              }}
            >
              {t('common.delete')}
            </button>
            <button className="btn btn-ghost" onClick={() => setConfirmDel(false)}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </Sheet>
      {consent.element}
    </main>
  );
}
