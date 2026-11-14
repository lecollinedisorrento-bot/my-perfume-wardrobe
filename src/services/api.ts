// Browser client for the app's own server API. No credentials live here.

import type {
  AskRequest,
  AskResponse,
  CollectionItem,
  HealthResponse,
  IdentifyRequest,
  IdentifyResponse,
  LayerRequest,
  LayerResponse,
  RecommendRequest,
  RecommendResponse,
  ResearchRequest,
  ResearchResponse,
  WeatherCtx,
} from '../shared/api';
import type { Fragrance, Preferences, WearLog, WeatherSnapshot } from '../domain/types';
import { lastWornMap, wearCounts } from '../domain/recommend';
import { daysBetween, localDay, seasonFor } from '../domain/util';
import { translate } from '../i18n';
import { weatherLabelKey } from '../domain/weather';
import { appUrl } from './base';
import { allNotes } from '../domain/fragrance';

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(appUrl(path), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError('network', 'Network error', 0);
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  if (!res.ok) throw new ApiError(data.error ?? 'http_error', data.message ?? `HTTP ${res.status}`, res.status);
  return data as T;
}

export async function getHealth(): Promise<HealthResponse | null> {
  try {
    const res = await fetch(appUrl('/api/health'), { cache: 'no-store' });
    if (!(res.headers.get('content-type') ?? '').includes('json')) return null; // static hosting: no API
    if (!res.ok) return null;
    return (await res.json()) as HealthResponse;
  } catch {
    return null;
  }
}

export const api = {
  identify: (b: IdentifyRequest, s?: AbortSignal) => post<IdentifyResponse>('/api/ai/identify', b, s),
  research: (b: ResearchRequest, s?: AbortSignal) => post<ResearchResponse>('/api/ai/research', b, s),
  recommend: (b: RecommendRequest, s?: AbortSignal) => post<RecommendResponse>('/api/ai/recommend', b, s),
  layer: (b: LayerRequest, s?: AbortSignal) => post<LayerResponse>('/api/ai/layer', b, s),
  ask: (b: AskRequest, s?: AbortSignal) => post<AskResponse>('/api/ai/ask', b, s),
};

// ── Minimal-data builders: exactly what is sent to the AI, nothing more. ──

export function toCollectionItem(f: Fragrance, wears: WearLog[], withNotes = false): CollectionItem {
  const last = lastWornMap(wears).get(f.id);
  const item: CollectionItem = {
    id: f.id,
    brand: f.brand,
    name: f.name,
    concentration: f.concentration !== 'Unknown' ? f.concentration : undefined,
    family: f.family || undefined,
    accords: f.accords.slice(0, 8),
    seasons: f.usage.seasons,
    times: f.usage.times,
    occasions: f.usage.occasions,
    favorite: f.favorite || undefined,
    rating: f.rating,
    lastWornDaysAgo: last ? daysBetween(last, localDay()) : null,
    wearCount: wearCounts(wears).get(f.id) ?? 0,
  };
  if (withNotes) item.notes = allNotes(f).slice(0, 24);
  return item;
}

export function toWeatherCtx(w: WeatherSnapshot | null | undefined): WeatherCtx {
  if (!w) return null;
  return {
    tempC: Math.round(w.tempC),
    feelsLikeC: Math.round(w.feelsLikeC),
    humidity: Math.round(w.humidity),
    precipitationMm: Math.round(w.precipitationMm * 10) / 10,
    windKph: Math.round(w.windKph),
    condition: translate('en', weatherLabelKey(w.code)),
    manual: w.manual || undefined,
  };
}

export function toPrefsCtx(p: Preferences) {
  return {
    favoriteFamilies: p.favoriteFamilies,
    favoriteAccords: p.favoriteAccords,
    dislikedNotes: p.dislikedNotes,
    intensity: p.intensity,
    runsWarm: p.runsWarm,
  };
}

export function contextBase(weather: WeatherSnapshot | null) {
  const now = new Date();
  return {
    weather: toWeatherCtx(weather),
    date: now.toISOString().slice(0, 16),
    season: seasonFor(now),
  };
}

export function aiErrorMessage(e: unknown, lang: 'en' | 'it'): string {
  if (e instanceof ApiError) {
    if (e.code === 'rate_limited' || e.code === 'ai_rate_limited') return translate(lang, 'err.rateLimited');
    if (e.code === 'network') return translate(lang, 'err.network');
    if (e.code === 'ai_not_configured') return translate(lang, 'ai.notConfigured');
    return e.message;
  }
  return translate(lang, 'err.generic');
}
