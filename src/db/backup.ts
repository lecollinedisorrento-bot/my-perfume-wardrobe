// Export / import / backup / restore. A backup is a single JSON file that
// includes images as data URLs, so it restores fully offline.

import { z } from 'zod';
import { normalizeFragrance } from '../domain/fragrance';
import type { Fragrance } from '../domain/types';
import { DB_VERSION, getDB } from './db';
import { DEFAULT_PREFS } from './repo';

export const BACKUP_APP_ID = 'my-perfume-wardrobe';

const BackupSchema = z.object({
  app: z.literal(BACKUP_APP_ID),
  schemaVersion: z.number().int().min(1),
  exportedAt: z.string(),
  data: z.object({
    fragrances: z.array(z.record(z.string(), z.unknown())),
    wears: z.array(z.record(z.string(), z.unknown())).default([]),
    combinations: z.array(z.record(z.string(), z.unknown())).default([]),
    spins: z.array(z.record(z.string(), z.unknown())).default([]),
    recommendations: z.array(z.record(z.string(), z.unknown())).default([]),
    achievements: z.array(z.record(z.string(), z.unknown())).default([]),
    prefs: z.record(z.string(), z.unknown()).nullable().default(null),
    images: z
      .array(z.object({ key: z.string(), type: z.string(), dataUrl: z.string() }))
      .default([]),
  }),
});

export type Backup = z.infer<typeof BackupSchema>;

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(bin)}`;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',', 2);
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'application/octet-stream';
  const bin = atob(body ?? '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function createBackup(opts: { includeImages?: boolean } = {}): Promise<Backup> {
  const db = await getDB();
  const [fragrances, wears, combinations, spins, recommendations, achievements, prefsRec, images] = await Promise.all([
    db.getAll('fragrances'),
    db.getAll('wears'),
    db.getAll('combinations'),
    db.getAll('spins'),
    db.getAll('recommendations'),
    db.getAll('achievements'),
    db.get('kv', 'prefs'),
    opts.includeImages === false ? Promise.resolve([]) : db.getAll('images'),
  ]);
  const imgs = await Promise.all(
    images.map(async (i) => ({ key: i.key, type: i.type, dataUrl: await blobToDataUrl(i.blob) })),
  );
  return {
    app: BACKUP_APP_ID,
    schemaVersion: DB_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      fragrances: fragrances as unknown as Record<string, unknown>[],
      wears: wears as unknown as Record<string, unknown>[],
      combinations: combinations as unknown as Record<string, unknown>[],
      spins: spins as unknown as Record<string, unknown>[],
      recommendations: recommendations as unknown as Record<string, unknown>[],
      achievements: achievements as unknown as Record<string, unknown>[],
      prefs: (prefsRec?.value as Record<string, unknown>) ?? null,
      images: imgs,
    },
  };
}

export function parseBackup(text: string): Backup {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new BackupError('invalid_json');
  }
  const res = BackupSchema.safeParse(json);
  if (!res.success) throw new BackupError('invalid_format');
  if (res.data.schemaVersion > DB_VERSION) throw new BackupError('newer_version');
  return res.data;
}

export class BackupError extends Error {
  constructor(public code: 'invalid_json' | 'invalid_format' | 'newer_version') {
    super(code);
  }
}

/** Restore a backup. "replace" wipes current data; "merge" keeps both (backup wins on id clashes). */
export async function restoreBackup(b: Backup, mode: 'replace' | 'merge'): Promise<{ fragrances: number }> {
  const db = await getDB();
  const stores = ['fragrances', 'images', 'wears', 'combinations', 'spins', 'recommendations', 'achievements', 'kv'] as const;
  const tx = db.transaction(stores as unknown as (typeof stores)[number][], 'readwrite');
  if (mode === 'replace') for (const s of stores) await tx.objectStore(s).clear();

  // Older schema versions are upgraded through the same normaliser used by migrations.
  for (const raw of b.data.fragrances) {
    if (typeof raw.id !== 'string') continue;
    await tx.objectStore('fragrances').put(normalizeFragrance(raw as unknown as Fragrance));
  }
  for (const img of b.data.images) {
    await tx.objectStore('images').put({ key: img.key, type: img.type, blob: dataUrlToBlob(img.dataUrl), createdAt: new Date().toISOString() });
  }
  const putAll = async (store: 'wears' | 'combinations' | 'spins' | 'recommendations' | 'achievements', rows: Record<string, unknown>[]) => {
    for (const r of rows) if (typeof r.id === 'string') await tx.objectStore(store).put(r as never);
  };
  await putAll('wears', b.data.wears);
  await putAll('combinations', b.data.combinations);
  await putAll('spins', b.data.spins);
  await putAll('recommendations', b.data.recommendations);
  await putAll('achievements', b.data.achievements);
  if (b.data.prefs && (mode === 'replace' || !(await tx.objectStore('kv').get('prefs')))) {
    await tx.objectStore('kv').put({ key: 'prefs', value: { ...DEFAULT_PREFS, ...b.data.prefs } });
  }
  await tx.done;
  return { fragrances: b.data.fragrances.length };
}

export function downloadJson(obj: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
