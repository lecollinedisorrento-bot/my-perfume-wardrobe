// Contract test for the Claude adapter: real SDK, fake HTTP transport.
import { describe, expect, it } from 'vitest';
import { AnthropicProvider } from '../../server/ai/anthropic';
import { createApp } from '../../server/app';

type Body = Record<string, unknown> & { messages: { role: string; content: unknown }[]; tools?: { type: string }[] };

function fakeFetch(responder: (body: Body, n: number) => unknown) {
  const calls: { url: string; headers: Headers; body: Body }[] = [];
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Body;
    calls.push({ url: String(input), headers: new Headers(init?.headers as HeadersInit), body });
    return new Response(JSON.stringify(responder(body, calls.length)), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { f, calls };
}

const message = (content: unknown[], stop = 'end_turn') => ({
  id: 'msg_1',
  type: 'message',
  role: 'assistant',
  model: 'claude-opus-5-5',
  content,
  stop_reason: stop,
  stop_sequence: null,
  usage: { input_tokens: 1, output_tokens: 1 },
});

describe('AnthropicProvider', () => {
  it('sends a structured recommend request and the server keeps only collection ids', async () => {
    const { f, calls } = fakeFetch(() =>
      message([{ type: 'text', text: JSON.stringify({ picks: [{ id: 'a', external: null, reason: 'Bright.', weatherNote: 'Hot day.' }, { id: 'zzz', external: null, reason: 'x', weatherNote: '' }], summary: 'Go fresh.' }) }]),
    );
    const app = createApp({ ai: new AnthropicProvider('claude-opus-5-5', 'sk-test', { fetch: f }), imageLookup: false });
    const res = await app.request('/api/ai/recommend', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ collection: [{ id: 'a', brand: 'B', name: 'N', accords: ['citrus'], seasons: [], times: [], occasions: [] }], context: {}, prefs: {} }),
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.picks).toEqual([{ id: 'a', external: null, reason: 'Bright.', weatherNote: 'Hot day.' }]);
    expect(json.engine).toBe('anthropic:claude-opus-5-5');

    const req = calls[0];
    expect(req.url).toContain('/v1/messages');
    expect(req.headers.get('x-api-key') ?? req.headers.get('authorization')).toMatch(/sk-test/);
    expect(req.body.model).toBe('claude-opus-5-5');
    expect(req.body.fallbacks).toBe('default');
    expect((req.body.output_config as { format: { type: string } }).format.type).toBe('json_schema');
    // personal notes are never part of the payload
    expect(JSON.stringify(req.body)).not.toContain('personalNotes');
  });

  it('research: cites only retrieved sources (two-phase)', async () => {
    const { f, calls } = fakeFetch((body, n) => {
      if (n === 1) {
        expect(body.tools?.[0].type).toBe('web_search_20260209');
        return message([
          { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'amouage reflection notes' } },
          {
            type: 'web_search_tool_result',
            tool_use_id: 'srvtoolu_1',
            content: [{ type: 'web_search_result', url: 'https://www.amouage.com/reflection-man', title: 'Reflection Man', encrypted_content: 'x', page_age: null }],
          },
          { type: 'text', text: 'Official site lists rosemary, jasmine, sandalwood.' },
        ]);
      }
      expect(JSON.stringify(body.messages)).toContain('[0] Reflection Man');
      return message([
        {
          type: 'text',
          text: JSON.stringify({
            identityMatch: true, confidence: 'high', concentration: 'Eau de Parfum', releaseYear: 2007, perfumer: 'Lucas Sieuzac', country: null,
            family: 'Woody Floral Musk', accords: ['powdery', 'floral', 'woody'],
            notes: { top: ['rosemary'], heart: ['jasmine'], base: ['sandalwood'] }, noteSource: 'official',
            character: 'c', evolution: 'e', personality: 'p',
            performance: { longevity: 4, projection: 3, sillage: 3, intensity: 3 },
            usage: { seasons: ['spring'], times: ['morning'], occasions: ['work'], tempMinC: 10, tempMaxC: 26 },
            sources: [{ index: 0, name: 'Amouage', type: 'official', supports: ['notes', 'year'] }, { index: 4, name: 'Made up', type: 'database', supports: ['perfumer'] }],
          }),
        },
      ]);
    });
    const app = createApp({ ai: new AnthropicProvider('claude-opus-5-5', 'sk-test', { fetch: f }), imageLookup: false });
    const res = await app.request('/api/ai/research', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ brand: 'Amouage', name: 'Reflection Man' }) });
    const json = await res.json();
    expect(calls.length).toBe(2);
    expect(json.research.status).toBe('verified');
    expect(json.research.sources.map((s: { url: string }) => s.url)).toEqual(['https://www.amouage.com/reflection-man']);
    expect(json.profile.releaseYear).toBe(2007);
    expect(json.profile.perfumer).toBeNull(); // only the invented source claimed it
    expect(json.searchAvailable).toBe(true);
  });

  it('maps refusals to a clear error', async () => {
    const { f } = fakeFetch(() => message([{ type: 'text', text: '' }], 'refusal'));
    const app = createApp({ ai: new AnthropicProvider('claude-opus-5-5', 'sk-test', { fetch: f }) });
    const res = await app.request('/api/ai/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: 'q', collection: [], context: {}, prefs: {} }) });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('ai_refused');
  });
});
