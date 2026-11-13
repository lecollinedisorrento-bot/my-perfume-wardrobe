// HTTP API. All AI credentials live here, server-side.

import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { ZodType } from 'zod';
import {
  AskRequestSchema,
  IdentifyRequestSchema,
  LayerRequestSchema,
  RecommendRequestSchema,
  ResearchRequestSchema,
  type HealthResponse,
  type ImageCandidate,
  type ResearchResponse,
} from '../src/shared/api';
import type { AIProvider } from './ai/provider';
import { AIUpstreamError } from './ai/provider';
import { verifyResearch } from './ai/verify';
import { extractOgImage, FetchBlockedError, safeFetch } from './net';

export interface AppDeps {
  ai: AIProvider | null;
  fetchImpl?: typeof fetch;
  rateLimit?: number; // AI requests per IP per window
  rateWindowMs?: number;
  /** Disable outbound page fetches for image candidates (tests). */
  imageLookup?: boolean;
}

const VERSION = '1.0.0';

export function createApp(deps: AppDeps) {
  const app = new Hono();
  const hits = new Map<string, { count: number; reset: number }>();
  const limit = deps.rateLimit ?? 40;
  const windowMs = deps.rateWindowMs ?? 10 * 60_000;

  const clientIp = (c: { req: { header: (n: string) => string | undefined } }) =>
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'local';

  app.onError((err, c) => {
    if (err instanceof AIUpstreamError) return c.json({ error: err.code, message: err.message }, err.status as 400);
    console.error('[api]', err);
    return c.json({ error: 'internal_error' }, 500);
  });

  app.get('/api/health', (c) => {
    const body: HealthResponse = {
      ok: true,
      ai: {
        configured: !!deps.ai,
        provider: deps.ai?.id ?? 'none',
        model: deps.ai?.model ?? null,
        webResearch: deps.ai?.webResearch ?? false,
      },
      weather: { provider: 'open-meteo (client)' },
      version: VERSION,
    };
    c.header('cache-control', 'no-store');
    return c.json(body);
  });

  // ── AI guard: configured + rate limit + body size ──
  app.use('/api/ai/*', bodyLimit({ maxSize: 8 * 1024 * 1024, onError: (c) => c.json({ error: 'payload_too_large' }, 413) }));
  app.use('/api/ai/*', async (c, next) => {
    if (!deps.ai) return c.json({ error: 'ai_not_configured', message: 'No AI provider is configured on the server.' }, 503);
    const ip = clientIp(c);
    const now = Date.now();
    const h = hits.get(ip);
    if (!h || h.reset < now) hits.set(ip, { count: 1, reset: now + windowMs });
    else if (++h.count > limit) return c.json({ error: 'rate_limited', message: 'Too many AI requests, slow down a little.' }, 429);
    c.header('cache-control', 'no-store');
    await next();
  });

  async function parse<T>(c: { req: { json: () => Promise<unknown> } }, schema: ZodType<T>): Promise<T> {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new AIUpstreamError('Invalid JSON body', 400, 'bad_request');
    }
    const r = schema.safeParse(body);
    if (!r.success) throw new AIUpstreamError(r.error.issues[0]?.message ?? 'Invalid request', 400, 'bad_request');
    return r.data;
  }

  const engine = () => `${deps.ai!.id}:${deps.ai!.model}`;

  app.post('/api/ai/identify', async (c) => {
    const req = await parse(c, IdentifyRequestSchema);
    const out = await deps.ai!.identify(req);
    return c.json({ ...out, candidates: out.candidates.slice(0, 5), engine: engine() });
  });

  app.post('/api/ai/research', async (c) => {
    const req = await parse(c, ResearchRequestSchema);
    const raw = await deps.ai!.research(req);
    const verified = verifyResearch(raw, req, engine());
    let imageCandidates: ImageCandidate[] = [];
    if (deps.imageLookup !== false) {
      imageCandidates = await findImageCandidates(verified.research.sources, deps.fetchImpl);
    }
    const body: ResearchResponse = { ...verified, imageCandidates };
    return c.json(body);
  });

  app.post('/api/ai/recommend', async (c) => {
    const req = await parse(c, RecommendRequestSchema);
    const out = await deps.ai!.recommend(req);
    const ids = new Set(req.collection.map((x) => x.id));
    // Enforce: never recommend outside the collection unless asked.
    const picks = out.picks
      .filter((p) => (req.external ? !!p.external?.name : !!p.id && ids.has(p.id)))
      .map((p) => (req.external ? { ...p, id: p.id && ids.has(p.id) ? p.id : null } : { ...p, external: null }))
      .slice(0, 5);
    return c.json({ picks, summary: out.summary, engine: engine() });
  });

  app.post('/api/ai/layer', async (c) => {
    const req = await parse(c, LayerRequestSchema);
    const out = await deps.ai!.layer(req);
    const ids = new Set(req.candidates.map((x) => x.id));
    const suggestions = out.suggestions
      .filter((s) => ids.has(s.secondaryId) && s.secondaryId !== req.primary.id)
      .map((s) => ({ ...s, compatibility: Math.max(0, Math.min(100, Math.round(s.compatibility))) }))
      .slice(0, 5);
    return c.json({ suggestions, engine: engine() });
  });

  app.post('/api/ai/ask', async (c) => {
    const req = await parse(c, AskRequestSchema);
    const out = await deps.ai!.ask(req);
    const ids = new Set(req.collection.map((x) => x.id));
    return c.json({ answer: out.answer, mentionedIds: out.mentionedIds.filter((i) => ids.has(i)), engine: engine() });
  });

  // ── Images ──
  // Proxies a remote bottle image so the browser can cache it locally (no CORS issues).
  app.get('/api/image/proxy', async (c) => {
    const url = c.req.query('url');
    if (!url) return c.json({ error: 'bad_request' }, 400);
    try {
      const r = await safeFetch(url, { maxBytes: 8 * 1024 * 1024, accept: 'image/*', fetchImpl: deps.fetchImpl });
      const type = r.contentType.split(';')[0].trim().toLowerCase();
      if (!/^image\/(png|jpeg|webp|gif|avif)$/.test(type)) return c.json({ error: 'not_an_image' }, 415);
      return new Response(r.body as unknown as BodyInit, {
        headers: { 'content-type': type, 'cache-control': 'private, max-age=86400', 'x-source-url': r.url },
      });
    } catch (e) {
      if (e instanceof FetchBlockedError) return c.json({ error: 'fetch_blocked', message: e.message }, 400);
      return c.json({ error: 'fetch_failed' }, 502);
    }
  });

  app.notFound((c) => (c.req.path.startsWith('/api/') ? c.json({ error: 'not_found' }, 404) : c.text('Not found', 404)));
  return app;
}

/** Looks for og:image on official / retailer pages that the research actually retrieved. */
async function findImageCandidates(
  sources: ResearchResponse['research']['sources'],
  fetchImpl?: typeof fetch,
): Promise<ImageCandidate[]> {
  const pages = sources
    .filter((s) => s.type === 'official' || s.type === 'retailer')
    .sort((a, b) => (a.type === 'official' ? -1 : 0) - (b.type === 'official' ? -1 : 0))
    .slice(0, 4);
  const results = await Promise.allSettled(
    pages.map(async (s) => {
      const page = await safeFetch(s.url, { maxBytes: 1_500_000, accept: 'text/html', timeoutMs: 8000, fetchImpl });
      const html = new TextDecoder().decode(page.body);
      const img = extractOgImage(html, page.url);
      return img ? ({ url: img, sourceUrl: s.url, sourceName: s.name, kind: s.type as 'official' | 'retailer' } satisfies ImageCandidate) : null;
    }),
  );
  const out: ImageCandidate[] = [];
  for (const r of results) if (r.status === 'fulfilled' && r.value && !out.some((x) => x.url === r.value!.url)) out.push(r.value);
  return out;
}
