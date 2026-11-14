// App-wide state: the whole (small) collection lives in memory, mirrored to
// IndexedDB on every mutation.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as repo from '../db/repo';
import type {
  Combination,
  Fragrance,
  Preferences,
  SpinRecord,
  WearLog,
  WearSource,
  WeatherSnapshot,
} from '../domain/types';
import { blankFragrance, fragranceKey, SAMPLE_COLLECTION } from '../domain/fragrance';
import { localDay, nowIso } from '../domain/util';
import { evaluateAchievements } from '../domain/achievements';
import { computeLearning, type Learning } from '../domain/recommend';
import { getHealth } from '../services/api';
import type { HealthResponse } from '../shared/api';
import { getPosition, weatherProvider, WeatherError } from '../services/weather';
import { configureFeedback } from '../services/feedback';
import { applyCatalog, findCatalogMatch, loadCatalog } from '../services/catalog';

export type WeatherStatus = 'off' | 'idle' | 'loading' | 'ok' | 'error' | 'denied';

export interface StoreState {
  ready: boolean;
  prefs: Preferences;
  fragrances: Fragrance[];
  wears: WearLog[];
  combinations: Combination[];
  spins: SpinRecord[];
  unlocked: Map<string, string>;
  health: HealthResponse | null | undefined; // undefined = checking
  online: boolean;
  weather: WeatherSnapshot | null;
  liveWeather: WeatherSnapshot | null;
  weatherStatus: WeatherStatus;
  manualWeather: WeatherSnapshot | null;
  learning: Learning;
  /** Newly unlocked achievement ids, consumed by the UI for celebrations. */
  freshUnlocks: string[];
}

export interface StoreActions {
  updatePrefs(patch: Partial<Preferences>): Promise<void>;
  saveFragrance(f: Fragrance): Promise<Fragrance>;
  deleteFragrance(id: string): Promise<void>;
  toggleFavorite(id: string): Promise<void>;
  setRating(id: string, rating: number | null): Promise<void>;
  wearToday(fragranceId: string, source: WearSource, secondaryId?: string): Promise<WearLog>;
  removeWear(id: string): Promise<void>;
  saveCombination(c: Combination): Promise<void>;
  deleteCombination(id: string): Promise<void>;
  recordSpin(s: SpinRecord): Promise<void>;
  importSample(): Promise<number>;
  reload(): Promise<void>;
  refreshWeather(opts?: { askLocation?: boolean }): Promise<void>;
  setManualWeather(w: WeatherSnapshot | null): void;
  resetLearning(): Promise<void>;
  refreshHealth(): Promise<void>;
  consumeUnlocks(): string[];
}

const Ctx = createContext<(StoreState & StoreActions) | null>(null);

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside provider');
  return v;
}

const WEATHER_TTL = 30 * 60_000;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [prefs, setPrefs] = useState<Preferences>(repo.DEFAULT_PREFS);
  const [fragrances, setFragrances] = useState<Fragrance[]>([]);
  const [wears, setWears] = useState<WearLog[]>([]);
  const [combinations, setCombinations] = useState<Combination[]>([]);
  const [spins, setSpins] = useState<SpinRecord[]>([]);
  const [unlocked, setUnlocked] = useState<Map<string, string>>(new Map());
  const [health, setHealth] = useState<HealthResponse | null | undefined>(undefined);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [liveWeather, setLiveWeather] = useState<WeatherSnapshot | null>(null);
  const [weatherStatus, setWeatherStatus] = useState<WeatherStatus>('idle');
  const [manualWeather, setManualWeather] = useState<WeatherSnapshot | null>(null);
  const [freshUnlocks, setFreshUnlocks] = useState<string[]>([]);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  const reload = useCallback(async () => {
    const [p, f, w, c, s, a, cw] = await Promise.all([
      repo.getPrefs(),
      repo.listFragrances(),
      repo.listWears(),
      repo.listCombinations(),
      repo.listSpins(),
      repo.listAchievements(),
      repo.getCachedWeather(),
    ]);
    setPrefs(p);
    setFragrances(f);
    setWears(w);
    setCombinations(c);
    setSpins(s);
    setUnlocked(new Map(a.map((x) => [x.id, x.unlockedAt])));
    if (cw) setLiveWeather(cw);
    setWeatherStatus(p.weather.mode === 'off' ? 'off' : cw ? 'ok' : 'idle');
  }, []);

  useEffect(() => {
    reload()
      .catch((e) => console.error('[store] load failed', e))
      .finally(() => setReady(true));
  }, [reload]);

  // Online / offline + AI health
  const refreshHealth = useCallback(async () => setHealth(await getHealth()), []);
  useEffect(() => {
    void refreshHealth();
    const on = () => {
      setOnline(true);
      void refreshHealth();
    };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [refreshHealth]);

  useEffect(() => {
    configureFeedback({ sound: prefs.soundEnabled, haptics: prefs.hapticsEnabled });
  }, [prefs.soundEnabled, prefs.hapticsEnabled]);

  // ── Achievements (re-evaluated after data changes) ──
  // Ids already being saved: rapid data changes (e.g. the sample import) re-run this
  // effect before the previous unlock lands, which used to announce a badge twice.
  const unlocking = useRef(new Set<string>());
  useEffect(() => {
    if (!ready) return;
    const known = new Set([...unlocked.keys(), ...unlocking.current]);
    const fresh = evaluateAchievements({ fragrances, wears, combinations, spins }, known);
    if (!fresh.length) return;
    for (const id of fresh) unlocking.current.add(id);
    void repo.unlockAchievements(fresh).then(() => {
      setUnlocked((m) => {
        const n = new Map(m);
        for (const id of fresh) n.set(id, nowIso());
        return n;
      });
      if (prefsRef.current.achievementsEnabled) setFreshUnlocks((f) => [...new Set([...f, ...fresh])]);
    });
  }, [ready, fragrances, wears, combinations, spins, unlocked]);

  const consumeUnlocks = useCallback(() => {
    const out = freshUnlocks;
    if (out.length) setFreshUnlocks([]);
    return out;
  }, [freshUnlocks]);

  // ── Prefs ──
  const updatePrefs = useCallback(async (patch: Partial<Preferences>) => {
    const next = { ...prefsRef.current, ...patch };
    prefsRef.current = next;
    setPrefs(next);
    await repo.savePrefs(next);
  }, []);

  // ── Weather ──
  const refreshWeather = useCallback(
    async (opts: { askLocation?: boolean } = {}) => {
      const p = prefsRef.current;
      if (p.weather.mode === 'off' && !opts.askLocation) {
        setWeatherStatus('off');
        return;
      }
      setWeatherStatus('loading');
      try {
        let lat: number, lon: number, place: string;
        if (opts.askLocation || p.weather.mode === 'auto') {
          const pos = await getPosition();
          lat = pos.lat;
          lon = pos.lon;
          place = '';
          if (opts.askLocation) await updatePrefs({ weather: { mode: 'auto', city: null } });
        } else if (p.weather.city) {
          ({ lat, lon } = p.weather.city);
          place = p.weather.city.name;
        } else {
          setWeatherStatus('idle');
          return;
        }
        const w = await weatherProvider.current(lat, lon, place);
        setLiveWeather(w);
        setWeatherStatus('ok');
        await repo.setCachedWeather(w);
      } catch (e) {
        setWeatherStatus(e instanceof WeatherError && e.code === 'denied' ? 'denied' : 'error');
        if (e instanceof WeatherError && e.code === 'denied' && prefsRef.current.weather.mode === 'auto') {
          await updatePrefs({ weather: { mode: 'off', city: null } });
        }
      }
    },
    [updatePrefs],
  );

  // Auto-refresh stale weather once ready (no permission prompt: mode "auto"
  // is only set after the user granted location before).
  useEffect(() => {
    if (!ready || prefs.weather.mode === 'off' || !online) return;
    const age = liveWeather ? Date.now() - new Date(liveWeather.fetchedAt).getTime() : Infinity;
    if (age > WEATHER_TTL) void refreshWeather();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, prefs.weather.mode, prefs.weather.city?.lat, online]);

  // ── Fragrances ──
  const saveFragrance = useCallback(async (f: Fragrance) => {
    const saved = await repo.saveFragrance(f);
    setFragrances((list) => {
      const i = list.findIndex((x) => x.id === saved.id);
      if (i === -1) return [...list, saved];
      const n = list.slice();
      n[i] = saved;
      return n;
    });
    return saved;
  }, []);

  const deleteFragrance = useCallback(async (id: string) => {
    await repo.deleteFragrance(id);
    setFragrances((l) => l.filter((f) => f.id !== id));
    setWears((l) => l.filter((w) => w.fragranceId !== id));
    setCombinations((l) => l.filter((c) => c.primaryId !== id && c.secondaryId !== id));
  }, []);

  const patchFragrance = useCallback(
    async (id: string, patch: Partial<Fragrance>) => {
      const f = (await repo.getFragrance(id)) ?? null;
      if (!f) return;
      await saveFragrance({ ...f, ...patch });
    },
    [saveFragrance],
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      const f = fragrances.find((x) => x.id === id);
      if (f) await patchFragrance(id, { favorite: !f.favorite });
    },
    [fragrances, patchFragrance],
  );

  const setRating = useCallback((id: string, rating: number | null) => patchFragrance(id, { rating }), [patchFragrance]);

  const weather = manualWeather ?? (prefs.weather.mode !== 'off' ? liveWeather : null);

  const wearToday = useCallback(
    async (fragranceId: string, source: WearSource, secondaryId?: string) => {
      const w = await repo.addWear({ fragranceId, day: localDay(), source, secondaryId, weather });
      setWears((l) => [...l, w]);
      return w;
    },
    [weather],
  );

  const removeWear = useCallback(async (id: string) => {
    await repo.deleteWear(id);
    setWears((l) => l.filter((w) => w.id !== id));
  }, []);

  const saveCombination = useCallback(async (c: Combination) => {
    await repo.saveCombination(c);
    setCombinations((l) => {
      const i = l.findIndex((x) => x.id === c.id);
      if (i === -1) return [...l, c];
      const n = l.slice();
      n[i] = c;
      return n;
    });
  }, []);

  const deleteCombination = useCallback(async (id: string) => {
    await repo.deleteCombination(id);
    setCombinations((l) => l.filter((c) => c.id !== id));
  }, []);

  const recordSpin = useCallback(async (s: SpinRecord) => {
    await repo.saveSpin(s);
    setSpins((l) => {
      const i = l.findIndex((x) => x.id === s.id);
      if (i === -1) return [...l, s];
      const n = l.slice();
      n[i] = s;
      return n;
    });
  }, []);

  const importSample = useCallback(async () => {
    const have = new Set(fragrances.map(fragranceKey));
    const catalog = await loadCatalog();
    let n = 0;
    for (const s of SAMPLE_COLLECTION) {
      if (have.has(fragranceKey(s))) continue;
      const base = blankFragrance({ brand: s.brand, name: s.name, isSample: true });
      // Fill from the researched catalogue when the perfume is in it.
      const match = findCatalogMatch(catalog.items, s.brand, s.name);
      await saveFragrance(match ? applyCatalog(base, match) : base);
      n++;
    }
    return n;
  }, [fragrances, saveFragrance]);

  const resetLearning = useCallback(() => updatePrefs({ learningResetAt: nowIso() }), [updatePrefs]);

  const learning = useMemo(
    () => computeLearning(fragrances, wears, prefs),
    [fragrances, wears, prefs],
  );

  const value: StoreState & StoreActions = {
    ready,
    prefs,
    fragrances,
    wears,
    combinations,
    spins,
    unlocked,
    health,
    online,
    weather,
    liveWeather,
    weatherStatus,
    manualWeather,
    learning,
    freshUnlocks,
    updatePrefs,
    saveFragrance,
    deleteFragrance,
    toggleFavorite,
    setRating,
    wearToday,
    removeWear,
    saveCombination,
    deleteCombination,
    recordSpin,
    importSample,
    reload,
    refreshWeather,
    setManualWeather,
    resetLearning,
    refreshHealth,
    consumeUnlocks,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** AI availability as the UI should present it. */
export function useAiState() {
  const { health, online } = useStore();
  if (!online) return { available: false, reason: 'offline' as const, engine: null };
  if (health === undefined) return { available: false, reason: 'checking' as const, engine: null };
  if (!health || !health.ai.configured) return { available: false, reason: 'not_configured' as const, engine: null };
  return { available: true, reason: null, engine: `${health.ai.provider}:${health.ai.model}`, health };
}
