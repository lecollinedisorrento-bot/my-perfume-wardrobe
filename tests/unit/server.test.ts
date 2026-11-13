import { describe, expect, it } from 'vitest';
import { createApp } from '../../server/app';
import { MockProvider } from '../../server/ai/mock';
import { verifyResearch, plausiblyOfficial } from '../../server/ai/verify';
import { assertPublicUrl, extractOgImage, FetchBlockedError, isPrivateAddress } from '../../server/net';
import type { RawResearch } from '../../server/ai/provider';
import { providerFromEnv } from '../../server/ai';

const app = (opts: Partial<Parameters<typeof createApp>[0]> = {}) => createApp({ ai: new MockProvider(), imageLookup: false, ...opts });
const post = (a: ReturnType<typeof createApp>, path: string, body: unknown, headers: Record<string, string> = {}) =>
  a.request(path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

const item = (id: string, name = id) => ({ id, brand: 'B', name, accords: [], seasons: [], times: [], occasions: [] });

describe('API', () => {
  it('reports AI configuration in health', async () => {
    const r = await (await app().request('/api/health')).json();
    expect(r.ai).toMatchObject({ configured: true, provider: 'mock' });
    const off = await (await createApp({ ai: null }).request('/api/health')).json();
    expect(off.ai.configured).toBe(false);
  });

  it('returns 503 ai_not_configured without a provider', async () => {
    const r = await post(createApp({ ai: null }), '/api/ai/ask', { question: 'x', collection: [], context: {}, prefs: {} });
    expect(r.status).toBe(503);
    expect((await r.json()).error).toBe('ai_not_configured');
  });

  it('validates request bodies', async () => {
    const r = await post(app(), '/api/ai/identify', {});
    expect(r.status).toBe(400);
    const bad = await post(app(), '/api/ai/identify', { imageDataUrl: 'data:text/html;base64,AAA' });
    expect(bad.status).toBe(400);
  });

  it('never recommends outside the collection unless asked', async () => {
    const r = await (await post(app(), '/api/ai/recommend', { collection: [item('a'), item('b')], context: {}, prefs: {} })).json();
    expect(r.picks.map((p: { id: string }) => p.id)).toEqual(['a', 'b']);
    expect(r.engine).toBe('mock:test-fixture');
    const ext = await (await post(app(), '/api/ai/recommend', { collection: [item('a')], context: {}, prefs: {}, external: true })).json();
    expect(ext.picks[0].external.name).toBe('External Pick');
  });

  it('filters layer suggestions to real candidates and clamps scores', async () => {
    const r = await (await post(app(), '/api/ai/layer', { primary: item('p'), candidates: [item('x'), item('y')], prefs: {} })).json();
    expect(r.suggestions.map((s: { secondaryId: string }) => s.secondaryId)).toEqual(['x', 'y']);
  });

  it('research drops unsupported facts and invented sources', async () => {
    const r = await (await post(app(), '/api/ai/research', { brand: 'Test', name: 'Fresh One' })).json();
    expect(r.research.status).toBe('unverified');
    expect(r.research.sources).toEqual([]);
    expect(r.profile.releaseYear).toBeNull();
    expect(r.profile.perfumer).toBeNull();
    expect(r.profile.noteSource).toBe('ai_interpretation');
    expect(r.research.droppedUnsupported).toEqual(expect.arrayContaining(['releaseYear', 'perfumer']));
  });

  it('rate-limits AI requests per client', async () => {
    const a = app({ rateLimit: 2 });
    const body = { question: 'q', collection: [], context: {}, prefs: {} };
    expect((await post(a, '/api/ai/ask', body)).status).toBe(200);
    expect((await post(a, '/api/ai/ask', body)).status).toBe(200);
    expect((await post(a, '/api/ai/ask', body)).status).toBe(429);
  });

  it('blocks image proxying to private hosts', async () => {
    const r = await app().request('/api/image/proxy?url=' + encodeURIComponent('http://127.0.0.1/secret.png'));
    expect(r.status).toBe(400);
  });

  it('builds no provider without an API key', () => {
    expect(providerFromEnv({ AI_PROVIDER: 'anthropic' } as NodeJS.ProcessEnv)).toBeNull();
    expect(providerFromEnv({ AI_PROVIDER: 'none', ANTHROPIC_API_KEY: 'x' } as NodeJS.ProcessEnv)).toBeNull();
    expect(providerFromEnv({ ANTHROPIC_API_KEY: 'sk-test' } as NodeJS.ProcessEnv)?.model).toBe('claude-opus-5-5');
  });
});

describe('research verification', () => {
  const draft: RawResearch['draft'] = {
    identityMatch: true,
    confidence: 'high',
    concentration: 'Eau de Parfum',
    releaseYear: 2010,
    perfumer: 'Someone',
    country: 'France',
    family: 'Floral',
    accords: ['Rose', 'rose', 'musky'],
    notes: { top: ['bergamot'], heart: ['rose'], base: ['musk'] },
    noteSource: 'official',
    character: '',
    evolution: '',
    personality: '',
    performance: { longevity: 9, projection: 0, sillage: null, intensity: 3 },
    usage: { seasons: ['spring', 'monsoon'], times: ['morning'], occasions: ['date', 'party'], tempMinC: 25, tempMaxC: 10 },
    sources: [],
  };

  it('verifies with an official source that states the notes', () => {
    const out = verifyResearch(
      {
        retrieved: [{ url: 'https://www.amouage.com/products/reflection', title: 'Reflection' }],
        searchAvailable: true,
        draft: { ...draft, sources: [{ index: 0, name: 'Amouage', type: 'official', supports: ['notes', 'year'] }] },
      },
      { brand: 'Amouage', name: 'Reflection' },
      'test',
    );
    expect(out.research.status).toBe('verified');
    expect(out.profile.noteSource).toBe('official');
    expect(out.profile.releaseYear).toBe(2010);
    expect(out.profile.perfumer).toBeNull(); // not supported by the source
    expect(out.profile.country).toBeNull();
    expect(out.profile.accords).toEqual(['rose', 'musky']);
    expect(out.profile.performance).toEqual({ longevity: 5, projection: 1, sillage: null, intensity: 3 });
    expect(out.profile.usage.seasons).toEqual(['spring']);
    expect(out.profile.usage.occasions).toEqual(['date']);
    expect(out.profile.usage.tempMinC).toBeNull(); // inverted range rejected
  });

  it('downgrades a fake "official" source on an unrelated domain', () => {
    const out = verifyResearch(
      {
        retrieved: [{ url: 'https://randomshop.example/reflection', title: 'x' }],
        searchAvailable: true,
        draft: { ...draft, sources: [{ index: 0, name: 'Shop', type: 'official', supports: ['notes'] }, { index: 7, name: 'Ghost', type: 'official', supports: ['notes'] }] },
      },
      { brand: 'Amouage', name: 'Reflection' },
      'test',
    );
    expect(out.research.sources).toHaveLength(1);
    expect(out.research.sources[0].type).toBe('database');
    expect(out.profile.noteSource).toBe('reported');
    expect(out.research.status).toBe('partially_verified');
    expect(out.research.confidence).toBe('medium');
    expect(out.research.droppedUnsupported).toContain('invalid_source_refs:1');
  });

  it('matches brand domains', () => {
    expect(plausiblyOfficial('https://www.parfums-de-marly.com/x', 'Parfums de Marly')).toBe(true);
    expect(plausiblyOfficial('https://initioparfums.com/', 'Initio Parfums Privés')).toBe(true);
    expect(plausiblyOfficial('https://fragrance-db.example/initio', 'Electimuss')).toBe(false);
  });
});

describe('network safety', () => {
  it('detects private addresses', () => {
    for (const ip of ['10.0.0.1', '127.0.0.1', '169.254.169.254', '172.20.1.1', '192.168.1.1', '::1', 'fd00::1', '::ffff:10.0.0.1']) expect(isPrivateAddress(ip)).toBe(true);
    for (const ip of ['8.8.8.8', '151.101.1.1', '2a00:1450::1']) expect(isPrivateAddress(ip)).toBe(false);
  });
  it('rejects non-http, credentials and private DNS answers', async () => {
    await expect(assertPublicUrl('file:///etc/passwd')).rejects.toBeInstanceOf(FetchBlockedError);
    await expect(assertPublicUrl('https://user:pw@example.com/')).rejects.toBeInstanceOf(FetchBlockedError);
    const fakeResolve = (async () => [{ address: '10.1.2.3', family: 4 }]) as never;
    await expect(assertPublicUrl('https://evil.example/', fakeResolve)).rejects.toBeInstanceOf(FetchBlockedError);
    const okResolve = (async () => [{ address: '93.184.216.34', family: 4 }]) as never;
    await expect(assertPublicUrl('https://shop.example/a.png', okResolve)).resolves.toBeInstanceOf(URL);
  });
  it('extracts og:image', () => {
    const html = '<html><head><meta content="/img/bottle.png?a=1&amp;b=2" property="og:image"></head></html>';
    expect(extractOgImage(html, 'https://brand.example/p/1')).toBe('https://brand.example/img/bottle.png?a=1&b=2');
    expect(extractOgImage('<meta property="og:image" content="javascript:alert(1)">', 'https://x.example')).toBeNull();
    expect(extractOgImage('<p>none</p>', 'https://x.example')).toBeNull();
  });
});
