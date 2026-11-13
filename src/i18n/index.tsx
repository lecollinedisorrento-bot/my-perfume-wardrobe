import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { en, type MessageKey } from './en';
import { it } from './it';
import type { Lang } from '../domain/types';

const DICTS: Record<Lang, Record<MessageKey, string>> = { en, it };

export type TFn = (key: MessageKey, params?: Record<string, string | number>) => string;

export function translate(lang: Lang, key: MessageKey | string, params?: Record<string, string | number>): string {
  const s = (DICTS[lang] as Record<string, string>)[key] ?? (en as Record<string, string>)[key] ?? key;
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (params[k] != null ? String(params[k]) : `{${k}}`));
}

interface I18nCtx {
  lang: Lang;
  t: TFn;
  /** For dynamic keys built at runtime (falls back to the key). */
  tk: (key: string, params?: Record<string, string | number>) => string;
  locale: string;
}

const Ctx = createContext<I18nCtx>({
  lang: 'en',
  t: (k, p) => translate('en', k, p),
  tk: (k, p) => translate('en', k, p),
  locale: 'en-GB',
});

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const value = useMemo<I18nCtx>(
    () => ({
      lang,
      t: (k, p) => translate(lang, k, p),
      tk: (k, p) => translate(lang, k, p),
      locale: lang === 'it' ? 'it-IT' : 'en-GB',
    }),
    [lang],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}

export type { MessageKey };
