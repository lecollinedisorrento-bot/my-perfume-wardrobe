import { useMemo } from 'react';
import { useStore } from './store';
import { rankFragrances, lastWornMap, wearCounts } from '../domain/recommend';
import type { RecommendationContext } from '../domain/types';
import { daysBetween, localDay } from '../domain/util';
import { useI18n } from '../i18n';

export function useRanking(context: RecommendationContext) {
  const { fragrances, wears, prefs, learning, weather } = useStore();
  const ctx = useMemo(() => ({ ...context, weather: context.weather === undefined ? weather : context.weather }), [context, weather]);
  return useMemo(
    () =>
      rankFragrances(fragrances, {
        context: ctx,
        prefs,
        wears,
        learning,
        latitude: prefs.weather.city?.lat ?? null,
      }),
    [fragrances, wears, prefs, learning, ctx],
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
