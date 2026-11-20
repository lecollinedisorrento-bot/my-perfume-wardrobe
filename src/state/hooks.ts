import { useMemo } from 'react';
import { useStore } from './store';
import { rankFragrances, lastWornMap, wearCounts } from '../domain/recommend';
import type { RecommendationContext } from '../domain/types';
import { daysBetween, localDay } from '../domain/util';
import { useI18n } from '../i18n';

const PICKS_KEY = 'pw.todayPicks';

/** Perfumes shown as "today's pick" on previous days (last 4 days), from this device. */
function recentPicks(today: string): string[] {
  try {
    const all = JSON.parse(localStorage.getItem(PICKS_KEY) ?? '{}') as Record<string, string>;
    return Object.entries(all)
      .filter(([day]) => day < today && daysBetween(day, today) <= 4)
      .map(([, id]) => id);
  } catch {
    return [];
  }
}

/** Remembers which perfume the "today" card suggested, so tomorrow suggests something else. */
export function rememberTodayPick(id: string) {
  try {
    const today = localDay();
    const all = JSON.parse(localStorage.getItem(PICKS_KEY) ?? '{}') as Record<string, string>;
    if (all[today] === id) return;
    all[today] = id;
    const keep = Object.keys(all).sort().slice(-10);
    localStorage.setItem(PICKS_KEY, JSON.stringify(Object.fromEntries(keep.map((k) => [k, all[k]]))));
  } catch {
    /* storage unavailable: variety still comes from the daily seed */
  }
}

export function useRanking(context: RecommendationContext, opts: { daily?: boolean } = {}) {
  const { fragrances, wears, prefs, learning, weather } = useStore();
  const ctx = useMemo(() => ({ ...context, weather: context.weather === undefined ? weather : context.weather }), [context, weather]);
  const today = localDay();
  return useMemo(
    () =>
      rankFragrances(fragrances, {
        context: ctx,
        prefs,
        wears,
        learning,
        latitude: prefs.weather.city?.lat ?? null,
        variety: opts.daily ? { seed: today, recentPicks: recentPicks(today) } : undefined,
      }),
    [fragrances, wears, prefs, learning, ctx, opts.daily, today],
  );
}

export function useWearInfo() {
  const { wears } = useStore();
  return useMemo(() => ({ last: lastWornMap(wears), counts: wearCounts(wears) }), [wears]);
}

export function useRelativeDay() {
  const { t } = useI18n();
  return (day: string | undefined | null) => {
    if (!day) return t('common.never');
    const d = daysBetween(day, localDay());
    if (d <= 0) return t('common.today');
    if (d === 1) return t('common.yesterday');
    return t('common.daysAgo', { n: d });
  };
}
