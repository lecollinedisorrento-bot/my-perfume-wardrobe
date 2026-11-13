import type {
  AchievementUnlock,
  Combination,
  Fragrance,
  Preferences,
  RecommendationRecord,
  SpinRecord,
  WearLog,
  WeatherSnapshot,
} from '../domain/types';
import { normalizeFragrance } from '../domain/fragrance';
import { nowIso, uid } from '../domain/util';
import { closeDB, DB_NAME, getDB } from './db';

export const DEFAULT_PREFS: Preferences = {
  name: '',
  language: (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('it') ? 'it' : 'en'),
  units: 'metric',
  theme: 'system',
  favoriteFamilies: [],
  favoriteAccords: [],
  dislikedNotes: [],
  intensity: 'any',
  projection: 'any',
  longevity: 'any',
  occasions: [],
  customOccasions: [],
  seasons: [],
  runsWarm: 'neutral',
  moods: [],
  weather: { mode: 'off', city: null },
  achievementsEnabled: true,
  soundEnabled: true,
  hapticsEnabled: true,
  reduceMotion: 'system',
  learningEnabled: true,
  learningResetAt: null,
  aiConsent: false,
  onboarded: false,
};

// ── Fragrances ──
export async function listFragrances(): Promise<Fragrance[]> {
  return (await getDB()).getAll('fragrances');
}
export async function getFragrance(id: string) {
  return (await getDB()).get('fragrances', id);
}
export async function saveFragrance(f: Fragrance): Promise<Fragrance> {
  const rec = normalizeFragrance({ ...f, updatedAt: nowIso() });
  await (await getDB()).put('fragrances', rec);
  return rec;
}
export async function deleteFragrance(id: string) {
  const db = await getDB();
  const f = await db.get('fragrances', id);
  const tx = db.transaction(['fragrances', 'images', 'wears', 'combinations'], 'readwrite');
  await tx.objectStore('fragrances').delete(id);
  if (f?.image?.blobKey) await tx.objectStore('images').delete(f.image.blobKey);
  let wc = await tx.objectStore('wears').index('byFragrance').openCursor(id);
  while (wc) {
    await wc.delete();
    wc = await wc.continue();
  }
  let cc = await tx.objectStore('combinations').openCursor();
  while (cc) {
    if (cc.value.primaryId === id || cc.value.secondaryId === id) await cc.delete();
    cc = await cc.continue();
  }
  await tx.done;
}

// ── Images ──
export async function putImage(blob: Blob): Promise<string> {
  const key = uid('img_');
  await (await getDB()).put('images', { key, blob, type: blob.type || 'image/jpeg', createdAt: nowIso() });
  return key;
}
export async function getImage(key: string) {
  return (await getDB()).get('images', key);
}
export async function deleteImage(key: string) {
  await (await getDB()).delete('images', key);
}

// ── Wears ──
export async function listWears(): Promise<WearLog[]> {
  return (await getDB()).getAll('wears');
}
export async function addWear(w: Omit<WearLog, 'id' | 'at'>): Promise<WearLog> {
  const rec: WearLog = { ...w, id: uid('w_'), at: nowIso() };
  await (await getDB()).put('wears', rec);
  return rec;
}
export async function deleteWear(id: string) {
  await (await getDB()).delete('wears', id);
}

// ── Combinations ──
export async function listCombinations(): Promise<Combination[]> {
  return (await getDB()).getAll('combinations');
}
export async function saveCombination(c: Combination) {
  await (await getDB()).put('combinations', c);
  return c;
}
export async function deleteCombination(id: string) {
  await (await getDB()).delete('combinations', id);
}

// ── Spins / recommendations ──
export async function listSpins(): Promise<SpinRecord[]> {
  return (await getDB()).getAll('spins');
}
export async function saveSpin(s: SpinRecord) {
  await (await getDB()).put('spins', s);
  return s;
}
export async function saveRecommendation(r: RecommendationRecord) {
  await (await getDB()).put('recommendations', r);
}
export async function listRecommendations(): Promise<RecommendationRecord[]> {
  return (await getDB()).getAll('recommendations');
}

// ── Key/value ──
export async function getPrefs(): Promise<Preferences> {
  const rec = await (await getDB()).get('kv', 'prefs');
  return { ...DEFAULT_PREFS, ...((rec?.value as Partial<Preferences>) ?? {}) };
}
export async function savePrefs(p: Preferences) {
  await (await getDB()).put('kv', { key: 'prefs', value: p });
}
export async function getCachedWeather(): Promise<WeatherSnapshot | null> {
  const rec = await (await getDB()).get('kv', 'weather');
  return (rec?.value as WeatherSnapshot) ?? null;
}
export async function setCachedWeather(w: WeatherSnapshot) {
  await (await getDB()).put('kv', { key: 'weather', value: w });
}

// ── Achievements ──
export async function listAchievements(): Promise<AchievementUnlock[]> {
  return (await getDB()).getAll('achievements');
}
export async function unlockAchievements(ids: string[]) {
  const db = await getDB();
  const tx = db.transaction('achievements', 'readwrite');
  for (const id of ids) await tx.store.put({ id, unlockedAt: nowIso() });
  await tx.done;
}

/** Full reset: wipes every local store. */
export async function resetEverything() {
  await closeDB();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}
