// Claude implementation of the AIProvider interface.
// Credentials are read from the server environment only.

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { AIProvider, RawResearch } from './provider';
import { AIUpstreamError } from './provider';

const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

const LANG_NAME = { en: 'English', it: 'Italian' } as const;

const SYSTEM = `You are the fragrance consultant inside "My Perfume Wardrobe", a playful personal fragrance app.
Voice: warm, witty, contemporary, concise. No emojis. No childish language.
Honesty rules (non-negotiable):
- Never invent facts, sources, release years, perfumers or notes. If unsure, say so or leave the field empty/null.
- Clearly separate documented facts from your own interpretation.
- Performance (longevity, projection, sillage, intensity) is always a subjective estimate on a 1–5 scale, never a measurement.
- Weather/season guidance is a tendency, never a universal rule.
- Layering compatibility is a subjective suggestion, never a guarantee.`;

// ── Schemas for structured outputs ──
// Kept simple (no numeric bounds) so they compile to the supported JSON-schema subset.

const Level = z.number().int().nullable().describe('1 (very soft/short) to 5 (very strong/long), or null if unknown');
const Season = z.enum(['spring', 'summer', 'autumn', 'winter']);
const Time = z.enum(['morning', 'afternoon', 'evening', 'night']);
const Occ = z.enum(['work', 'university', 'casual', 'formal', 'date', 'romantic', 'nightlife', 'special']);
const Fact = z.enum(['notes', 'accords', 'family', 'year', 'perfumer', 'country', 'concentration', 'performance', 'description']);

const IdentifySchema = z.object({
  status: z.enum(['identified', 'ambiguous', 'not_found']),
  candidates: z.array(
    z.object({
      brand: z.string(),
      name: z.string(),
      concentration: z.string().describe('e.g. "Eau de Parfum", or "Unknown"'),
      confidence: z.enum(['high', 'medium', 'low']),
      note: z.string().describe('one short line: why this candidate / how to tell versions apart'),
    }),
  ),
  question: z.string().nullable().describe('a clarification question when ambiguous, else null'),
});

const ResearchSchema = z.object({
  identityMatch: z.boolean().describe('true only if the research clearly found this exact fragrance'),
  confidence: z.enum(['high', 'medium', 'low']),
  concentration: z.string(),
  releaseYear: z.number().int().nullable(),
  perfumer: z.string().nullable(),
  country: z.string().nullable(),
  family: z.string().describe('olfactive family, e.g. "Amber Woody", "Citrus Aromatic"'),
  accords: z.array(z.string()).describe('main accords, most dominant first, max 8, lowercase'),
  notes: z.object({ top: z.array(z.string()), heart: z.array(z.string()), base: z.array(z.string()) }),
  noteSource: z.enum(['official', 'reported', 'ai_interpretation']),
  character: z.string().describe('2–3 sentences on the olfactory character'),
  evolution: z.string().describe('how it evolves from opening to dry-down'),
  personality: z.string().describe('one punchy line on its overall personality'),
  performance: z.object({ longevity: Level, projection: Level, sillage: Level, intensity: Level }),
  usage: z.object({
    seasons: z.array(Season),
    times: z.array(Time),
    occasions: z.array(Occ),
    tempMinC: z.number().nullable().describe('lower bound of comfortable feels-like temperature °C, tendency'),
    tempMaxC: z.number().nullable(),
  }),
  sources: z.array(
    z.object({
      index: z.number().int().describe('index into the numbered source list you were given'),
      name: z.string(),
      type: z.enum(['official', 'retailer', 'database', 'publication', 'community']),
      supports: z.array(Fact).describe('facts this specific source actually states'),
    }),
  ),
});

const RecommendSchema = z.object({
  picks: z.array(
    z.object({
      id: z.string().nullable().describe('id from the collection, or null for an external suggestion'),
      external: z.object({ brand: z.string(), name: z.string() }).nullable(),
      reason: z.string(),
      weatherNote: z.string().describe('how the weather context influenced this pick; empty if none'),
    }),
  ),
  summary: z.string(),
});

const LayerSchema = z.object({
  suggestions: z.array(
    z.object({
      secondaryId: z.string(),
      order: z.string().describe('which to apply first and why, short'),
      sprayDistribution: z.string(),
      interaction: z.string().describe('how the two olfactively interact'),
      impression: z.string(),
      occasions: z.array(z.string()),
      conflicts: z.string().describe('potential clashes; empty string if none'),
      explanation: z.string(),
      compatibility: z.number().int().describe('subjective 0-100 suggestion score'),
    }),
  ),
});

const AskSchema = z.object({
  answer: z.string().describe('the answer, 1–3 short paragraphs, plain text'),
  mentionedIds: z.array(z.string()).describe('collection ids referenced in the answer'),
});

type Lang = 'en' | 'it';

export class AnthropicProvider implements AIProvider {
  readonly id = 'anthropic';
  readonly webResearch = true;
  private client: Anthropic;

  constructor(
    readonly model: string,
    apiKey: string,
    opts: { fetch?: typeof fetch; baseURL?: string } = {},
  ) {
    // Explicit key from server env; never shipped to the browser.
    this.client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000, fetch: opts.fetch, baseURL: opts.baseURL ?? 'https://api.anthropic.com' });
  }

  private langLine(lang: Lang) {
    return `Write every human-readable string in ${LANG_NAME[lang]}. Keep perfume names, brands and note names in their usual form.`;
  }

  /** Structured call with server-side refusal fallback enabled. */
  private async structured<T extends z.ZodType>(
    schema: T,
    content: Anthropic.Beta.BetaContentBlockParam[] | string,
    opts: { effort: 'low' | 'medium' | 'high'; maxTokens?: number },
  ): Promise<z.infer<T>> {
    let res: Anthropic.Beta.BetaMessage;
    try {
      res = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: opts.maxTokens ?? 8000,
        betas: [FALLBACK_BETA],
        fallbacks: 'default',
        system: SYSTEM,
        output_config: { effort: opts.effort, format: betaZodOutputFormat(schema) },
        messages: [{ role: 'user', content }],
      });
    } catch (e) {
      throw mapError(e);
    }
    // Check the stop reason before reading content.
    if (res.stop_reason === 'refusal') throw new AIUpstreamError('The AI declined this request.', 422, 'ai_refused');
    if (res.stop_reason === 'max_tokens') throw new AIUpstreamError('The AI answer was cut off. Try again.', 502, 'ai_truncated');
    const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new AIUpstreamError('The AI returned an unreadable answer.', 502, 'ai_bad_output');
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) throw new AIUpstreamError('The AI answer did not match the expected format.', 502, 'ai_bad_output');
    return parsed.data as z.infer<T>;
  }

  async identify(req: { query?: string; imageDataUrl?: string; lang: Lang }) {
    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    if (req.imageDataUrl) {
      const m = /^data:(image\/(?:png|jpeg|webp|gif));base64,(.*)$/s.exec(req.imageDataUrl);
      if (m) {
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: m[1] as 'image/png', data: m[2] },
        });
      }
    }
    content.push({
      type: 'text',
      text: `Identify the exact fragrance (brand, name, concentration/flanker) ${req.imageDataUrl ? 'shown on this bottle photo' : ''}${
        req.query ? ` described as: "${req.query}"` : ''
      }.
- "identified": you are confident about one fragrance (1 candidate, maybe a second if concentration is unclear).
- "ambiguous": several plausible fragrances/flankers/concentrations: list up to 5 and ask ONE short clarification question.
- "not_found": you cannot tell; ask for a clearer photo or the name on the label.
Only list fragrances you believe really exist. Do not invent flankers. ${this.langLine(req.lang)}`,
    });
    return this.structured(IdentifySchema, content, { effort: 'low', maxTokens: 4000 });
  }

  async research(req: { brand: string; name: string; concentration?: string; lang: Lang }): Promise<RawResearch> {
    const target = `${req.brand} ${req.name}${req.concentration && req.concentration !== 'Unknown' ? ` (${req.concentration})` : ''}`;

    // Phase A — live web research with Anthropic's server-side web search.
    const retrieved: { url: string; title: string }[] = [];
    let notesText = '';
    let searchAvailable = true;
    try {
      const messages: Anthropic.Beta.BetaMessageParam[] = [
        {
          role: 'user',
          content: `Research the fragrance "${target}" on the web.
Priority of sources: 1) the official brand website/product page, 2) official product descriptions, 3) reputable fragrance databases, 4) specialist fragrance publications, 5) reliable community sources.
Find: exact concentration, official notes pyramid (top/heart/base), main accords, olfactive family, release year, perfumer, country of origin of the brand, and the general consensus on longevity/projection.
Write compact research notes. For every fact, name the source it came from. Say explicitly when something could not be found or when sources disagree. Do not fill gaps from memory without saying so.`,
        },
      ];
      for (let i = 0; i < 4; i++) {
        const res = await this.client.beta.messages.create({
          model: this.model,
          max_tokens: 12000,
          betas: [FALLBACK_BETA],
          fallbacks: 'default',
          system: SYSTEM,
          output_config: { effort: 'medium' },
          tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6 }],
          messages,
        });
        for (const block of res.content) {
          if (block.type === 'web_search_tool_result') {
            if (Array.isArray(block.content)) {
              for (const r of block.content) if (r.type === 'web_search_result') retrieved.push({ url: r.url, title: r.title });
            } else {
              searchAvailable = false;
            }
          } else if (block.type === 'text') {
            notesText += block.text;
          }
        }
        if (res.stop_reason === 'pause_turn') {
          messages.push({ role: 'assistant', content: res.content });
          continue;
        }
        if (res.stop_reason === 'refusal') throw new AIUpstreamError('The AI declined this request.', 422, 'ai_refused');
        break;
      }
    } catch (e) {
      const mapped = mapError(e);
      // Web search may be disabled for the organisation: continue without sources.
      if (mapped.code === 'ai_bad_request') searchAvailable = false;
      else throw mapped;
    }

    const uniq = dedupeByUrl(retrieved).slice(0, 25);
    if (!uniq.length) searchAvailable = searchAvailable && retrieved.length > 0;
    const sourceList = uniq.length
      ? uniq.map((s, i) => `[${i}] ${s.title} — ${s.url}`).join('\n')
      : '(no sources were retrieved)';

    // Phase B — turn the notes into the app's structured profile, citing sources by index only.
    const draft = await this.structured(
      ResearchSchema,
      `Build the structured profile for "${target}".

Research notes:
"""
${notesText.slice(0, 20000) || '(no live research was possible)'}
"""

Numbered list of sources that were actually retrieved:
${sourceList}

Rules:
- In "sources", reference ONLY indices from the list above, and only for facts that source actually states. If the list is empty, return an empty array.
- noteSource: "official" only when the notes come from the brand's own site/description; "reported" when from databases/retailers/publications; "ai_interpretation" when they are your own inference.
- releaseYear, perfumer, country: null unless a listed source states them.
- If the research did not clearly find this exact fragrance, set identityMatch=false and confidence="low".
- usage/performance are your subjective guidance (tendencies, not rules).
${this.langLine(req.lang)}`,
      { effort: 'medium', maxTokens: 8000 },
    );

    return { retrieved: uniq, searchAvailable, draft };
  }

  async recommend(req: {
    collection: unknown[];
    context: Record<string, unknown>;
    prefs: unknown;
    external: boolean;
    lang: Lang;
  }) {
    return this.structured(
      RecommendSchema,
      `User's perfume collection (JSON, ids are opaque):
${JSON.stringify(req.collection)}

Context: ${JSON.stringify(req.context)}
Preferences: ${JSON.stringify(req.prefs)}

Task: recommend up to 3 fragrances for this context.
${
  req.external
    ? 'The user explicitly asked for external discovery: suggest real fragrances they do NOT own (id=null, fill "external"). Only suggest fragrances you are confident exist.'
    : 'ONLY pick fragrances from the collection (use their exact id, external=null). Never suggest anything outside it.'
}
Explain in one or two sentences why each works. If weather is given, mention how it shaped the choice in weatherNote (as a tendency). Consider ratings, favourites and how recently each was worn.
${this.langLine(req.lang)}`,
      { effort: 'low', maxTokens: 4000 },
    );
  }

  async layer(req: { primary: unknown; candidates: unknown[]; prefs: unknown; lang: Lang }) {
    return this.structured(
      LayerSchema,
      `Primary fragrance: ${JSON.stringify(req.primary)}
Candidates from the user's own collection: ${JSON.stringify(req.candidates)}
Preferences: ${JSON.stringify(req.prefs)}

Suggest up to 4 candidates that could layer well with the primary. Use exact candidate ids in secondaryId.
For each: application order, spray distribution (e.g. "2 chest, 1 neck"), olfactory interaction, overall impression, suitable occasions, potential conflicts, and an explanation.
compatibility is a subjective 0-100 suggestion. Layering is never guaranteed to work — keep the tone experimental.
${this.langLine(req.lang)}`,
      { effort: 'low', maxTokens: 5000 },
    );
  }

  async ask(req: { question: string; collection: unknown[]; context: unknown; prefs: unknown; lang: Lang }) {
    return this.structured(
      AskSchema,
      `User's perfume collection (JSON): ${JSON.stringify(req.collection)}
Context: ${JSON.stringify(req.context)}
Preferences: ${JSON.stringify(req.prefs)}

Question: ${req.question}

Answer using the user's actual collection. Refer to perfumes by brand and name and list their ids in mentionedIds. If the collection lacks data to answer well, say so. Only discuss perfumes outside the collection if the question asks for that.
${this.langLine(req.lang)}`,
      { effort: 'low', maxTokens: 4000 },
    );
  }
}

function dedupeByUrl<T extends { url: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  return arr.filter((x) => {
    const k = x.url.replace(/#.*$/, '').replace(/\/$/, '');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function mapError(e: unknown): AIUpstreamError {
  if (e instanceof AIUpstreamError) return e;
  if (e instanceof Anthropic.AuthenticationError) return new AIUpstreamError('AI credentials were rejected.', 503, 'ai_auth');
  if (e instanceof Anthropic.RateLimitError) return new AIUpstreamError('AI is busy, try again shortly.', 429, 'ai_rate_limited');
  if (e instanceof Anthropic.BadRequestError) return new AIUpstreamError(e.message, 400, 'ai_bad_request');
  if (e instanceof Anthropic.APIConnectionError) return new AIUpstreamError('Could not reach the AI service.', 503, 'ai_unreachable');
  if (e instanceof Anthropic.APIError) return new AIUpstreamError(`AI error (${e.status ?? '?'})`, 502);
  return new AIUpstreamError(e instanceof Error ? e.message : 'Unknown AI error', 500, 'ai_error');
}
