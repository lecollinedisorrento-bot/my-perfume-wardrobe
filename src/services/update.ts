// Keeps an installed app (iOS home-screen apps especially) on the latest version.
// The service worker updates on its own most of the time; this is the safety net:
// compare our build id with the one on the server and, if they differ, drop the
// cached app shell and reload. Personal data lives in IndexedDB and is untouched.

const BASE = import.meta.env.BASE_URL;
const GUARD = 'pw.updateTried';

export const BUILD_ID = __BUILD_ID__;

async function serverBuildId(): Promise<string | null> {
  try {
    const r = await fetch(`${BASE}version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const j = (await r.json()) as { id?: string };
    return j.id ?? null;
  } catch {
    return null;
  }
}

/** Unregisters the service worker, clears its caches (not your data) and reloads. */
export async function hardRefresh(): Promise<void> {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations()) ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
    const keys = (await caches?.keys()) ?? [];
    // Keep the bottle photos: they do not change between versions.
    await Promise.all(keys.filter((k) => k !== 'bottle-cutouts').map((k) => caches.delete(k)));
  } catch {
    /* reload anyway */
  }
  location.reload();
}

/** True when the server has a newer build than the one running. */
export async function isOutdated(): Promise<boolean> {
  const id = await serverBuildId();
  return !!id && id !== BUILD_ID;
}

/** Checks for a newer build and refreshes once per new version (guarded against loops). */
export async function autoUpdate(reg?: ServiceWorkerRegistration | null): Promise<void> {
  if (!navigator.onLine) return;
  void reg?.update().catch(() => {});
  const id = await serverBuildId();
  if (!id || id === BUILD_ID) return;
  try {
    if (sessionStorage.getItem(GUARD) === id) return; // already tried for this version
    sessionStorage.setItem(GUARD, id);
  } catch {
    return;
  }
  await hardRefresh();
}
