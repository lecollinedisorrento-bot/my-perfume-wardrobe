import { useRef, useState } from 'react';
import type { FragranceImage, ImageKind } from '../domain/types';
import type { ImageCandidate } from '../shared/api';
import { putImage, deleteImage } from '../db/repo';
import { fetchRemoteImage, forgetObjectUrl, resizeImage } from '../services/images';
import { useI18n } from '../i18n';
import { useUi } from '../state/ui';
import { IconCamera, IconTrash } from './Icons';
import { Notice } from './ui';
import { nowIso } from '../domain/util';

/**
 * Lets the user upload a photo, choose one of the images found on the pages
 * the research actually retrieved, or paste an image URL. Every image keeps
 * its provenance label (official / retailer / web / your photo).
 */
export function ImagePicker({
  image,
  onChange,
  candidates,
}: {
  image: FragranceImage | null;
  onChange: (img: FragranceImage | null) => void;
  candidates?: ImageCandidate[];
}) {
  const { t, tk } = useI18n();
  const { toast } = useUi();
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const replace = async (blob: Blob, kind: ImageKind, sourceUrl?: string, sourceName?: string) => {
    const key = await putImage(blob);
    if (image?.blobKey) {
      forgetObjectUrl(image.blobKey);
      await deleteImage(image.blobKey).catch(() => {});
    }
    onChange({ kind, blobKey: key, sourceUrl, sourceName, addedAt: nowIso() });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy('file');
    try {
      const blob = await resizeImage(file, 1400, 'image/jpeg', 0.86);
      await replace(blob, 'user_photo');
    } catch {
      toast(t('img.failed'), 'error');
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const fromUrl = async (u: string, kind: ImageKind, sourceName?: string, sourceUrl?: string) => {
    setBusy(u);
    try {
      const blob = await fetchRemoteImage(u);
      let host = '';
      try {
        host = new URL(sourceUrl ?? u).hostname.replace(/^www\./, '');
      } catch {
        /* ignore */
      }
      await replace(blob, kind, sourceUrl ?? u, sourceName ?? host);
      setUrl('');
    } catch {
      toast(t('img.failed'), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="stack" style={{ ['--gap' as string]: '12px' }}>
      <div className="row">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => fileRef.current?.click()} disabled={!!busy}>
          <IconCamera />
          {image ? t('img.replace') : t('img.upload')}
        </button>
        {image && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={async () => {
              forgetObjectUrl(image.blobKey);
              await deleteImage(image.blobKey).catch(() => {});
              onChange(null);
            }}
          >
            <IconTrash />
            {t('img.remove')}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void onFile(e.target.files?.[0])} data-testid="image-file" />
      </div>
      {image && (
        <span className="tag" style={{ alignSelf: 'flex-start' }}>
          {tk(`img.kind.${image.kind}`)}
          {image.sourceName ? ` · ${t('img.from', { source: image.sourceName })}` : ''}
        </span>
      )}

      {candidates && (
        <div className="field">
          <span className="label">{t('img.found')}</span>
          {candidates.length === 0 ? (
            <p className="dim small">{t('img.foundNone')}</p>
          ) : (
            <div className="hscroll" style={{ paddingBottom: 6 }}>
              {candidates.map((c) => (
                <button
                  type="button"
                  key={c.url}
                  className="img-cand"
                  onClick={() => void fromUrl(c.url, c.kind, c.sourceName, c.sourceUrl)}
                  disabled={!!busy}
                  aria-label={`${tk(`img.kind.${c.kind}`)} ${t('img.from', { source: c.sourceName })}`}
                >
                  <img src={`/api/image/proxy?url=${encodeURIComponent(c.url)}`} alt="" loading="lazy" />
                  <span className="tiny">
                    {tk(`img.kind.${c.kind}`)} · {c.sourceName}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="field">
        <label className="label" htmlFor="img-url">
          {t('img.url')}
        </label>
        <div className="row nowrap">
          <input id="img-url" className="input" type="url" inputMode="url" placeholder={t('img.urlPlaceholder')} value={url} onChange={(e) => setUrl(e.target.value)} />
          <button type="button" className="btn btn-sm" disabled={!/^https?:\/\//.test(url) || !!busy} onClick={() => void fromUrl(url, 'web')}>
            {t('img.useUrl')}
          </button>
        </div>
        <Notice>{t('img.urlNote')}</Notice>
      </div>
    </div>
  );
}
