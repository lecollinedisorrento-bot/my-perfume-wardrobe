import { beforeEach, describe, expect, it } from 'vitest';
import { openDB } from 'idb';
import * as repo from '../../src/db/repo';
import { closeDB, DB_NAME, DB_VERSION } from '../../src/db/db';
import { createBackup, parseBackup, restoreBackup, BackupError } from '../../src/db/backup';
import { blankFragrance } from '../../src/domain/fragrance';
import { en } from '../../src/i18n/en';
import { it as itDict } from '../../src/i18n/it';

beforeEach(async () => {
  await repo.resetEverything();
});

describe('IndexedDB repository', () => {
  it('persists fragrances, preferences and wears', async () => {
    const f = await repo.saveFragrance(blankFragrance({ brand: 'Amouage', name: 'Reflection' }));
    await repo.addWear({ fragranceId: f.id, day: '2026-11-13', source: 'manual' });
    await repo.savePrefs({ ...repo.DEFAULT_PREFS, name: 'Ada', onboarded: true });
    await closeDB(); // simulate a reload
    expect((await repo.listFragrances()).map((x) => x.name)).toEqual(['Reflection']);
    expect((await repo.listWears()).length).toBe(1);
    expect((await repo.getPrefs()).name).toBe('Ada');
  });

  it('deleting a fragrance cascades to its image, wears and combos', async () => {
    const img = await repo.putImage(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }));
    const a = await repo.saveFragrance(blankFragrance({ brand: 'A', name: 'One', image: { kind: 'user_photo', blobKey: img, addedAt: '' } }));
    const b = await repo.saveFragrance(blankFragrance({ brand: 'B', name: 'Two' }));
    await repo.addWear({ fragranceId: a.id, day: '2026-11-13', source: 'manual' });
    await repo.saveCombination({ id: 'c1', createdAt: '', primaryId: a.id, secondaryId: b.id, order: '', sprayDistribution: '', interaction: '', impression: '', occasions: [], conflicts: '', explanation: '', compatibility: 50, engine: 'local', rating: null, notes: '', success: null });
    await repo.deleteFragrance(a.id);
    expect(await repo.getImage(img)).toBeUndefined();
    expect(await repo.listWears()).toEqual([]);
    expect(await repo.listCombinations()).toEqual([]);
    expect((await repo.listFragrances()).map((x) => x.name)).toEqual(['Two']);
  });

  it('migrates a v1 database to the current schema', async () => {
    await closeDB();
    const v1 = await openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore('fragrances', { keyPath: 'id' }).createIndex('byBrand', 'brand');
        for (const s of ['images', 'combinations', 'spins', 'recommendations', 'achievements']) db.createObjectStore(s, { keyPath: s === 'images' ? 'key' : 'id' });
        const w = db.createObjectStore('wears', { keyPath: 'id' });
        w.createIndex('byFragrance', 'fragranceId');
        w.createIndex('byDay', 'day');
        db.createObjectStore('kv', { keyPath: 'key' });
      },
    });
    // an old, partial record
    await v1.put('fragrances', { id: 'old', brand: ' Initio ', name: 'Oud for Greatness', accords: ['oud', 3] });
    v1.close();
    const list = await repo.listFragrances();
    expect(list[0]).toMatchObject({ brand: 'Initio', accords: ['oud'], concentration: 'Unknown', favorite: false, noteSource: 'none' });
    expect(list[0].usage.seasons).toEqual([]);
  });

  it('round-trips a full backup including images', async () => {
    const img = await repo.putImage(new Blob([new Uint8Array([9, 8, 7])], { type: 'image/png' }));
    const f = await repo.saveFragrance(blankFragrance({ brand: 'A', name: 'One', favorite: true, image: { kind: 'user_photo', blobKey: img, addedAt: '' } }));
    await repo.addWear({ fragranceId: f.id, day: '2026-11-13', source: 'spin' });
    const backup = await createBackup();
    expect(backup.schemaVersion).toBe(DB_VERSION);
    const text = JSON.stringify(backup);

    await repo.resetEverything();
    expect(await repo.listFragrances()).toEqual([]);

    await restoreBackup(parseBackup(text), 'replace');
    const restored = await repo.listFragrances();
    expect(restored[0]).toMatchObject({ name: 'One', favorite: true });
    const blob = (await repo.getImage(img))!.blob;
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([9, 8, 7]);
    expect((await repo.listWears()).length).toBe(1);
  });

  it('merge keeps existing data', async () => {
    await repo.saveFragrance(blankFragrance({ brand: 'Keep', name: 'Me' }));
    const backup = await createBackup();
    await repo.resetEverything();
    await repo.saveFragrance(blankFragrance({ brand: 'Local', name: 'Only' }));
    await restoreBackup(backup, 'merge');
    expect((await repo.listFragrances()).map((x) => x.brand).sort()).toEqual(['Keep', 'Local']);
  });

  it('rejects invalid or newer backups', () => {
    expect(() => parseBackup('nope')).toThrow(BackupError);
    expect(() => parseBackup(JSON.stringify({ app: 'other' }))).toThrow(BackupError);
    expect(() => parseBackup(JSON.stringify({ app: 'my-perfume-wardrobe', schemaVersion: 999, exportedAt: '', data: { fragrances: [] } }))).toThrow(/newer_version/);
  });
});

describe('i18n', () => {
  it('Italian keeps every placeholder of the English copy', () => {
    for (const [k, v] of Object.entries(en)) {
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
      expect(ph(itDict[k as keyof typeof en]), k).toBe(ph(v));
    }
  });
});
