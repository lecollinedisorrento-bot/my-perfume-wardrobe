import type { WeatherSnapshot } from './types';

export type TempBand = 'hot' | 'warm' | 'mild' | 'cool' | 'cold';

export interface WeatherProfile {
  band: TempBand;
  feelsLikeC: number;
  humid: boolean;
  rainy: boolean;
  windy: boolean;
  /** Preferred freshness 0..1 (tendency) */
  idealFreshness: number;
  /** Preferred maximum weight 0..1 (tendency) */
  idealWeight: number;
}

export function tempBand(feelsLikeC: number): TempBand {
  if (feelsLikeC >= 27) return 'hot';
  if (feelsLikeC >= 20) return 'warm';
  if (feelsLikeC >= 13) return 'mild';
  if (feelsLikeC >= 6) return 'cool';
  return 'cold';
}

// WMO codes: 51–67 drizzle/rain, 80–82 showers, 95–99 thunder
export function isRainCode(code: number) {
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
}
export function isSnowCode(code: number) {
  return (code >= 71 && code <= 77) || code === 85 || code === 86;
}

export function weatherProfile(
  w: Pick<WeatherSnapshot, 'feelsLikeC' | 'humidity' | 'precipitationMm' | 'windKph' | 'code'>,
  runsWarm: 'cold' | 'neutral' | 'warm' = 'neutral',
): WeatherProfile {
  // People who "run warm" feel heat sooner; shift the perceived temperature a bit.
  const shift = runsWarm === 'warm' ? 2 : runsWarm === 'cold' ? -2 : 0;
  const t = w.feelsLikeC + shift;
  const band = tempBand(t);
  const humid = w.humidity >= 75;
  const rainy = w.precipitationMm > 0.2 || isRainCode(w.code);
  const windy = w.windKph >= 30;
  const base: Record<TempBand, [number, number]> = {
    hot: [0.9, 0.35],
    warm: [0.75, 0.5],
    mild: [0.55, 0.7],
    cool: [0.35, 0.85],
    cold: [0.2, 1],
  };
  let [idealFreshness, idealWeight] = base[band];
  // Humid heat amplifies dense compositions — lean lighter.
  if (humid && (band === 'hot' || band === 'warm')) {
    idealFreshness += 0.05;
    idealWeight -= 0.1;
  }
  // Rain invites atmospheric, woody, slightly denser picks.
  if (rainy && band !== 'hot') {
    idealFreshness -= 0.1;
    idealWeight += 0.05;
  }
  return {
    band,
    feelsLikeC: w.feelsLikeC,
    humid,
    rainy,
    windy,
    idealFreshness: Math.max(0, Math.min(1, idealFreshness)),
    idealWeight: Math.max(0, Math.min(1, idealWeight)),
  };
}

/** Builds a snapshot from a manual temperature choice (when weather is unavailable). */
export function manualWeather(tempC: number, opts: { rainy?: boolean; humid?: boolean } = {}): WeatherSnapshot {
  return {
    tempC,
    feelsLikeC: tempC,
    humidity: opts.humid ? 85 : 55,
    precipitationMm: opts.rainy ? 1 : 0,
    windKph: 8,
    code: opts.rainy ? 61 : 1,
    isDay: true,
    place: '',
    provider: 'manual',
    fetchedAt: new Date().toISOString(),
    manual: true,
  };
}

export function weatherEmoji(code: number, isDay = true): string {
  // Used only as a tiny glyph inside the weather pill.
  if (code === 0) return isDay ? '☀' : '☾';
  if (code <= 2) return isDay ? '⛅' : '☁';
  if (code === 3) return '☁';
  if (code === 45 || code === 48) return '≋';
  if (isSnowCode(code)) return '❄';
  if (code >= 95) return '⚡';
  if (isRainCode(code)) return '☂';
  return '☁';
}

export function weatherLabelKey(code: number): string {
  if (code === 0) return 'wx.clear';
  if (code <= 2) return 'wx.partly';
  if (code === 3) return 'wx.overcast';
  if (code === 45 || code === 48) return 'wx.fog';
  if (code >= 51 && code <= 57) return 'wx.drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'wx.rain';
  if (isSnowCode(code)) return 'wx.snow';
  if (code >= 95) return 'wx.storm';
  return 'wx.cloudy';
}
