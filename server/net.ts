// Outbound fetch helpers with SSRF protection, used for bottle images.

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export class FetchBlockedError extends Error {}

export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return isPrivateAddress(v.slice(7));
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
}

export async function assertPublicUrl(raw: string, resolve = lookup): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FetchBlockedError('invalid url');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new FetchBlockedError('protocol not allowed');
  if (url.username || url.password) throw new FetchBlockedError('credentials in url');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new FetchBlockedError('host not allowed');
  const addrs = isIP(host) ? [{ address: host }] : await resolve(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new FetchBlockedError('private address');
  return url;
}

/** fetch() that re-validates every redirect hop and enforces a size cap. */
export async function safeFetch(
  raw: string,
  opts: { maxBytes: number; accept: string; timeoutMs?: number; fetchImpl?: typeof fetch },
): Promise<{ url: string; contentType: string; body: Uint8Array }> {
  const f = opts.fetchImpl ?? fetch;
  let current = raw;
  for (let hop = 0; hop < 4; hop++) {
    const url = await assertPublicUrl(current);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 10_000);
    try {
      const res = await f(url, {
        redirect: 'manual',
        signal: ctrl.signal,
        headers: { accept: opts.accept, 'user-agent': 'MyPerfumeWardrobe/1.0 (+image-fetch)' },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        current = new URL(res.headers.get('location')!, url).toString();
        continue;
      }
      if (!res.ok) throw new FetchBlockedError(`upstream ${res.status}`);
      const len = Number(res.headers.get('content-length') ?? 0);
      if (len > opts.maxBytes) throw new FetchBlockedError('too large');
      const reader = res.body?.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > opts.maxBytes) {
            await reader.cancel();
            throw new FetchBlockedError('too large');
          }
          chunks.push(value);
        }
      }
      const body = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) {
        body.set(c, off);
        off += c.byteLength;
      }
      return { url: url.toString(), contentType: res.headers.get('content-type') ?? '', body };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new FetchBlockedError('too many redirects');
}

/** Extracts og:image / twitter:image / image_src from an HTML page. */
export function extractOgImage(html: string, baseUrl: string): string | null {
  const metas = html.match(/<meta\b[^>]*>/gi) ?? [];
  const pick = (names: string[]) => {
    for (const m of metas) {
      const prop = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(m)?.[1]?.toLowerCase();
      const content = /content\s*=\s*["']([^"']+)["']/i.exec(m)?.[1];
      if (prop && content && names.includes(prop)) return content;
    }
    return null;
  };
  const found =
    pick(['og:image:secure_url', 'og:image', 'og:image:url']) ??
    pick(['twitter:image', 'twitter:image:src']) ??
    /<link\b[^>]*rel\s*=\s*["']image_src["'][^>]*href\s*=\s*["']([^"']+)["']/i.exec(html)?.[1] ??
    null;
  if (!found) return null;
  try {
    const u = new URL(found.replace(/&amp;/g, '&'), baseUrl);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}
