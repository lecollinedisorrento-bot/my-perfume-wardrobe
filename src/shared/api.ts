// API contract shared by the browser client and the server.
// Request bodies are validated on the server with these zod schemas.

import { z } from 'zod';

export const LangSchema = z.enum(['en', 'it']);

const str = (max: number) => z.string().max(max);

/** Minimal per-perfume summary sent to the AI. Never includes personal notes or images. */
export const CollectionItemSchema = z.object({
  id: str(64),
  brand: str(120),
  name: str(160),
  concentration: str(40).optional(),
  family: str(60).optional(),
  accords: z.array(str(40)).max(10).default([]),
  notes: z.array(str(40)).max(24).optional(),
  seasons: z.array(str(12)).max(4).default([]),
  times: z.array(str(12)).max(4).default([]),
  occasions: z.array(str(20)).max(10).default([]),
  favorite: z.boolean().optional(),
  rating: z.number().min(0).max(5).nullable().optional(),
  lastWornDaysAgo: z.number().int().nullable().optional(),
  wearCount: z.number().int().optional(),
});
export type CollectionItem = z.infer<typeof CollectionItemSchema>;

export const WeatherCtxSchema = z
  .object({
    tempC: z.number(),
    feelsLikeC: z.number(),
    humidity: z.number(),
    precipitationMm: z.number(),
    windKph: z.number(),
    condition: str(40),
    place: str(80).optional(),
    manual: z.boolean().optional(),
  })
  .nullable();
export type WeatherCtx = z.infer<typeof WeatherCtxSchema>;

export const PrefsCtxSchema = z.object({
  favoriteFamilies: z.array(str(40)).max(20).default([]),
  favoriteAccords: z.array(str(40)).max(20).default([]),
  dislikedNotes: z.array(str(40)).max(20).default([]),
  intensity: str(20).optional(),
  runsWarm: str(10).optional(),
});

// ── Identify ──
export const IdentifyRequestSchema = z
  .object({
    query: str(200).optional(),
    imageDataUrl: z
      .string()
      .max(7_000_000)
      .regex(/^data:image\/(png|jpeg|webp|gif);base64,/)
      .optional(),
    lang: LangSchema.default('en'),
  })
  .refine((v) => !!v.query?.trim() || !!v.imageDataUrl, { message: 'query or image required' });
export type IdentifyRequest = z.input<typeof IdentifyRequestSchema>;

export interface IdentifyCandidate {
  brand: string;
  name: string;
  concentration: string;
  confidence: 'high' | 'medium' | 'low';
  note: string;
}
export interface IdentifyResponse {
  status: 'identified' | 'ambiguous' | 'not_found';
  candidates: IdentifyCandidate[];
  question: string | null;
  engine: string;
}

// ── Research ──
export const ResearchRequestSchema = z.object({
  brand: str(120).min(1),
  name: str(160).min(1),
  concentration: str(40).optional(),
  lang: LangSchema.default('en'),
});
export type ResearchRequest = z.input<typeof ResearchRequestSchema>;

export interface ResearchedProfile {
  brand: string;
  name: string;
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
  usage: {
    seasons: string[];
    times: string[];
    occasions: string[];
    tempMinC: number | null;
    tempMaxC: number | null;
  };
}

export interface ResearchSource {
  name: string;
  url: string;
  type: 'official' | 'retailer' | 'database' | 'publication' | 'community';
  retrievedAt: string;
  supports: string[];
}

export interface ImageCandidate {
  url: string;
  sourceUrl: string;
  sourceName: string;
  kind: 'official' | 'retailer';
}

export interface ResearchResponse {
  profile: ResearchedProfile;
  research: {
    status: 'verified' | 'partially_verified' | 'unverified';
    confidence: 'high' | 'medium' | 'low';
    sources: ResearchSource[];
    researchedAt: string;
    engine: string;
    droppedUnsupported: string[];
  };
  identityMatch: boolean;
  searchAvailable: boolean;
  imageCandidates: ImageCandidate[];
}

// ── Recommend ──
export const RecommendRequestSchema = z.object({
  collection: z.array(CollectionItemSchema).max(400),
  context: z.object({
    mood: str(40).nullable().optional(),
    occasion: str(40).nullable().optional(),
    timeOfDay: str(20).nullable().optional(),
    intensity: str(20).nullable().optional(),
    impression: str(200).nullable().optional(),
    family: str(40).nullable().optional(),
    query: str(600).nullable().optional(),
    weather: WeatherCtxSchema.optional(),
    season: str(12).optional(),
    date: str(40).optional(),
  }),
  prefs: PrefsCtxSchema,
  external: z.boolean().default(false),
  lang: LangSchema.default('en'),
});
export type RecommendRequest = z.input<typeof RecommendRequestSchema>;

export interface RecommendPick {
  id: string | null;
  external: { brand: string; name: string } | null;
  reason: string;
  weatherNote: string;
}
export interface RecommendResponse {
  picks: RecommendPick[];
  summary: string;
  engine: string;
}

// ── Layer ──
export const LayerRequestSchema = z.object({
  primary: CollectionItemSchema,
  candidates: z.array(CollectionItemSchema).max(200),
  prefs: PrefsCtxSchema,
  lang: LangSchema.default('en'),
});
export type LayerRequest = z.input<typeof LayerRequestSchema>;

export interface LayerSuggestionDTO {
  secondaryId: string;
  order: string;
  sprayDistribution: string;
  interaction: string;
  impression: string;
  occasions: string[];
  conflicts: string;
  explanation: string;
  compatibility: number;
}
export interface LayerResponse {
  suggestions: LayerSuggestionDTO[];
  engine: string;
}

// ── Ask ──
export const AskRequestSchema = z.object({
  question: str(600).min(1),
  collection: z.array(CollectionItemSchema).max(400),
  context: z.object({ weather: WeatherCtxSchema.optional(), date: str(40).optional(), season: str(12).optional() }),
  prefs: PrefsCtxSchema,
  lang: LangSchema.default('en'),
});
export type AskRequest = z.input<typeof AskRequestSchema>;
export interface AskResponse {
  answer: string;
  mentionedIds: string[];
  engine: string;
}

export interface HealthResponse {
  ok: true;
  ai: { configured: boolean; provider: string; model: string | null; webResearch: boolean };
  weather: { provider: string };
  version: string;
}

export interface ApiError {
  error: string;
  message?: string;
}
