// Replaceable weather provider. The default implementation uses Open-Meteo,
// which needs no API key, so it is called directly from the browser. Only
// coordinates are sent. To swap providers, implement WeatherProvider.

import type { CityRef, WeatherSnapshot } from '../domain/types';

export interface WeatherProvider {
  readonly name: string;
  current(lat: number, lon: number, place: string): Promise<WeatherSnapshot>;
  searchCity(query: string, lang: string): Promise<CityRef[]>;
}

export class WeatherError extends Error {
  constructor(
    public code: 'network' | 'http' | 'denied' | 'unsupported' | 'timeout',
    message?: string,
  ) {
    super(message ?? code);
  }
}

async function getJson(url: string, timeoutMs = 9000): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new WeatherError('http', `HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    if (e instanceof WeatherError) throw e;
    if ((e as Error).name === 'AbortError') throw new WeatherError('timeout');
    throw new WeatherError('network');
  } finally {
    clearTimeout(timer);
  }
}

export const openMeteo: WeatherProvider = {
  name: 'open-meteo',
  async current(lat, lon, place) {
    const u = new URL('https://api.open-meteo.com/v1/forecast');
    u.searchParams.set('latitude', lat.toFixed(3));
    u.searchParams.set('longitude', lon.toFixed(3));
    u.searchParams.set(
      'current',
      'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,is_day',
    );
    u.searchParams.set('wind_speed_unit', 'kmh');
    u.searchParams.set('timezone', 'auto');
    const j = (await getJson(u.toString())) as {
      current?: {
        temperature_2m: number;
        apparent_temperature: number;
        relative_humidity_2m: number;
        precipitation: number;
        weather_code: number;
        wind_speed_10m: number;
        is_day: number;
      };
    };
    const c = j.current;
    if (!c || typeof c.temperature_2m !== 'number') throw new WeatherError('http', 'Malformed weather response');
    return {
      tempC: c.temperature_2m,
      feelsLikeC: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      precipitationMm: c.precipitation ?? 0,
      windKph: c.wind_speed_10m,
      code: c.weather_code,
      isDay: c.is_day === 1,
      place,
      provider: 'open-meteo',
      fetchedAt: new Date().toISOString(),
    };
  },
  async searchCity(query, lang) {
    if (query.trim().length < 2) return [];
    const u = new URL('https://geocoding-api.open-meteo.com/v1/search');
    u.searchParams.set('name', query.trim());
    u.searchParams.set('count', '6');
    u.searchParams.set('language', lang);
    u.searchParams.set('format', 'json');
    const j = (await getJson(u.toString())) as {
      results?: { name: string; country?: string; admin1?: string; latitude: number; longitude: number }[];
    };
    return (j.results ?? []).map((r) => ({
      name: r.name,
      country: r.country ?? '',
      admin: r.admin1,
      lat: r.latitude,
      lon: r.longitude,
    }));
  },
};

export const weatherProvider: WeatherProvider = openMeteo;

/** Asks for the device position. Only called after an explicit user action. */
export function getPosition(timeoutMs = 12000): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new WeatherError('unsupported'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (err) => reject(new WeatherError(err.code === err.PERMISSION_DENIED ? 'denied' : 'timeout', err.message)),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 15 * 60_000 },
    );
  });
}
