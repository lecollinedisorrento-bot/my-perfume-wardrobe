import { useCallback, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { useI18n } from '../i18n';
import { Sheet } from './ui';

/**
 * Explains, once, exactly what is sent to the AI provider. Returns a function
 * that resolves true when the user has agreed (immediately if already agreed).
 */
export function useAiConsent() {
  const { prefs, updatePrefs } = useStore();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const ensure = useCallback((): Promise<boolean> => {
    if (prefs.aiConsent) return Promise.resolve(true);
    setOpen(true);
    return new Promise((r) => (resolver.current = r));
  }, [prefs.aiConsent]);

  const finish = (ok: boolean) => {
    setOpen(false);
    if (ok) void updatePrefs({ aiConsent: true });
    resolver.current?.(ok);
    resolver.current = null;
  };

  const element = (
    <Sheet open={open} onClose={() => finish(false)} title={t('ai.consentTitle')}>
      <div className="stack">
        <p style={{ fontWeight: 600 }}>{t('ai.consentBody')}</p>
        <div className="row">
          <button className="btn btn-primary" data-autofocus onClick={() => finish(true)}>
            {t('ai.consentOk')}
          </button>
          <button className="btn btn-ghost" onClick={() => finish(false)}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </Sheet>
  );

  return { ensure, element };
}
