// Provider-agnostic AI adapter. Swap Anthropic for another vendor by
// implementing this interface and registering it in ./index.ts.

import type {
  AskRequest,
  AskResponse,
  IdentifyRequest,
  IdentifyResponse,
  LayerRequest,
  LayerResponse,
  RecommendRequest,
  RecommendResponse,
  ResearchRequest,
} from '../../src/shared/api';

/** What a provider returns from research before server-side verification. */
export interface RawResearch {
  /** Sources actually retrieved by a search/fetch tool during this request. */
  retrieved: { url: string; title: string }[];
  searchAvailable: boolean;
  draft: {
    identityMatch: boolean;
    confidence: 'high' | 'medium' | 'low';
    concentration: string;
    releaseYear: number | null;
    perfumer: string | null;
    country: string | null;
    family: string;
    accords: string[];
    notes: { top: string[]; heart: string[]; base: string[] };
    noteSource: 'official' | 'reported' | 'ai_interpretation';
    character: string;
    evolution: string;
    personality: string;
    performance: { longevity: number | null; projection: number | null; sillage: number | null; intensity: number | null };
    usage: { seasons: string[]; times: string[]; occasions: string[]; tempMinC: number | null; tempMaxC: number | null };
    /** References into `retrieved` by index. */
    sources: { index: number; name: string; type: 'official' | 'retailer' | 'database' | 'publication' | 'community'; supports: string[] }[];
  };
}

type Req<T> = Omit<T, 'lang'> & { lang: 'en' | 'it' };

export interface AIProvider {
  readonly id: string;
  readonly model: string;
  readonly webResearch: boolean;
  identify(req: Req<IdentifyRequest>): Promise<Omit<IdentifyResponse, 'engine'>>;
  research(req: Req<ResearchRequest>): Promise<RawResearch>;
  recommend(req: Req<RecommendRequest> & { external: boolean }): Promise<Omit<RecommendResponse, 'engine'>>;
  layer(req: Req<LayerRequest>): Promise<Omit<LayerResponse, 'engine'>>;
  ask(req: Req<AskRequest>): Promise<Omit<AskResponse, 'engine'>>;
}

export class AIUnavailableError extends Error {
  constructor(message = 'AI provider is not configured') {
    super(message);
  }
}

export class AIUpstreamError extends Error {
  constructor(
    message: string,
    public status = 502,
    public code = 'ai_upstream_error',
  ) {
    super(message);
  }
}
