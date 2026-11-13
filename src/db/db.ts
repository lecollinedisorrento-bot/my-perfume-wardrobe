// IndexedDB persistence with versioned schema + step-by-step migrations.

import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction, type StoreNames } from 'idb';
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

export const DB_NAME = 'my-perfume-wardrobe';
export const DB_VERSION = 2;

export interface ImageRecord {
  key: string;
  blob: Blob;
  type: string;
  createdAt: string;
}

export type KvValue =
  | { key: 'prefs'; value: Preferences }
  | { key: 'weather'; value: WeatherSnapshot }
  | { key: string; value: unknown };

export interface WardrobeDB extends DBSchema {
  fragrances: { key: string; value: Fragrance; indexes: { byBrand: string; byUpdated: string } };
  images: { key: string; value: ImageRecord };
  wears: { key: string; value: WearLog; indexes: { byFragrance: string; byDay: string } };
  combinations: { key: string; value: Combination };
  spins: { key: string; value: SpinRecord };
  recommendations: { key: string; value: RecommendationRecord };
  kv: { key: string; value: { key: string; value: unknown } };
  achievements: { key: string; value: AchievementUnlock };
}

type UpgradeTx = IDBPTransaction<WardrobeDB, StoreNames<WardrobeDB>[], 'versionchange'>;

/** Migration N upgrades a database from version N-1 to N. */
export const MIGRATIONS: Record<number, (db: IDBPDatabase<WardrobeDB>, tx: UpgradeTx) => Promise<void> | void> = {
  1: (db) => {
    const f = db.createObjectStore('fragrances', { keyPath: 'id' });
    f.createIndex('byBrand', 'brand');
    db.createObjectStore('images', { keyPath: 'key' });
    const w = db.createObjectStore('wears', { keyPath: 'id' });
    w.createIndex('byFragrance', 'fragranceId');
    w.createIndex('byDay', 'day');
    db.createObjectStore('combinations', { keyPath: 'id' });
    db.createObjectStore('spins', { keyPath: 'id' });
    db.createObjectStore('recommendations', { keyPath: 'id' });
    db.createObjectStore('kv', { keyPath: 'key' });
    db.createObjectStore('achievements', { keyPath: 'id' });
  },
  2: async (_db, tx) => {
    // v2: index by update time + backfill new fields on existing fragrances.
    const store = tx.objectStore('fragrances');
    store.createIndex('byUpdated', 'updatedAt');
    let cursor = await store.openCursor();
    while (cursor) {
      await cursor.update(normalizeFragrance(cursor.value));
      cursor = await cursor.continue();
    }
  },
};

let dbPromise: Promise<IDBPDatabase<WardrobeDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<WardrobeDB>> {
  if (!dbPromise) {
    dbPromise = openDB<WardrobeDB>(DB_NAME, DB_VERSION, {
      async upgrade(db, oldVersion, newVersion, tx) {
        for (let v = oldVersion + 1; v <= (newVersion ?? DB_VERSION); v++) {
          await MIGRATIONS[v]?.(db, tx);
        }
      },
      blocking() {
        // Another tab wants a newer version: close so it can upgrade.
        dbPromise?.then((d) => d.close());
        dbPromise = null;
      },
    });
  }
  return dbPromise;
}

/** Test helper / full reset. */
export async function closeDB() {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
}
