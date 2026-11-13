// Core domain model. Everything here is stored locally in IndexedDB.

export const CONCENTRATIONS = [
  'Eau de Cologne',
  'Eau de Toilette',
  'Eau de Parfum',
  'Parfum',
  'Extrait de Parfum',
  'Elixir',
  'Attar / Oil',
  'Other',
  'Unknown',
] as const;
export type Concentration = (typeof CONCENTRATIONS)[number];

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

export const TIMES = ['morning', 'afternoon', 'evening', 'night'] as const;
export type TimeOfDay = (typeof TIMES)[number];

export const OCCASIONS = [
  'work',
  'university',
  'casual',
  'formal',
  'date',
  'romantic',
  'nightlife',
  'special',
] as const;
export type Occasion = (typeof OCCASIONS)[number];

/** Subjective 1–5 scale. Never a measured number. */
export type Level = 1 | 2 | 3 | 4 | 5;

/** Where the notes pyramid came from. */
export type NoteSource = 'official' | 'reported' | 'ai_interpretation' | 'user' | 'none';

export type Verification = 'verified' | 'partially_verified' | 'unverified' | 'user_entered';

export type SourceType = 'official' | 'retailer' | 'database' | 'publication' | 'community';

export interface SourceRef {
  name: string;
  url: string;
  type: SourceType;
  retrievedAt: string; // ISO date
  /** Which facts this source backs up, e.g. ["notes", "perfumer"]. */
  supports: string[];
}

export type ImageKind = 'official' | 'retailer' | 'web' | 'user_photo' | 'illustration';

export interface FragranceImage {
  kind: ImageKind;
  /** Key in the `images` object store. */
  blobKey: string;
  sourceUrl?: string;
  sourceName?: string;
  addedAt: string;
}

export interface Performance {
  longevity?: Level;
  projection?: Level;
  sillage?: Level;
  intensity?: Level;
  /** "estimate" = AI or community estimate, "user" = the user's own experience. */
  basis: 'estimate' | 'user' | 'none';
}

export interface Usage {
  seasons: Season[];
  times: TimeOfDay[];
  occasions: Occasion[];
  /** Comfortable feels-like range in °C (a tendency, not a rule). */
  tempMinC?: number;
  tempMaxC?: number;
}

export interface ResearchInfo {
  status: Verification;
  confidence: 'high' | 'medium' | 'low';
  sources: SourceRef[];
  researchedAt: string;
  engine: string; // e.g. "anthropic:claude-opus-5-5"
  /** Fields the server removed because no retrieved source supported them. */
  droppedUnsupported: string[];
}

export interface Fragrance {
  id: string;
  createdAt: string;
  updatedAt: string;

  // identity
  brand: string;
  name: string;
  concentration: Concentration;
  releaseYear: number | null;
  perfumer: string | null;
  country: string | null;

  // olfactory
  family: string;
  accords: string[];
  notes: { top: string[]; heart: string[]; base: string[] };
  noteSource: NoteSource;
  character: string;
  evolution: string;
  personality: string;

  performance: Performance;
  usage: Usage;
  research: ResearchInfo | null;
  image: FragranceImage | null;

  // personal
  favorite: boolean;
  rating: number | null; // 0.5 – 5
  personalNotes: string;
  experience: string;
  isSample: boolean;
}

export interface WeatherSnapshot {
  tempC: number;
  feelsLikeC: number;
  humidity: number; // %
  precipitationMm: number;
  windKph: number;
  code: number; // WMO weather code
  isDay: boolean;
  place: string;
  provider: string;
  fetchedAt: string;
  manual?: boolean;
}

export type WearSource = 'manual' | 'spin' | 'recommendation' | 'layer';

export interface WearLog {
  id: string;
  fragranceId: string;
  /** Local calendar day, YYYY-MM-DD */
  day: string;
  at: string;
  source: WearSource;
  secondaryId?: string;
  weather?: WeatherSnapshot | null;
}

export interface Combination {
  id: string;
  createdAt: string;
  primaryId: string;
  secondaryId: string;
  order: string;
  sprayDistribution: string;
  interaction: string;
  impression: string;
  occasions: string[];
  conflicts: string;
  explanation: string;
  /** Subjective vibe score 0–100. Not a measurement. */
  compatibility: number;
  engine: 'ai' | 'local' | 'manual';
  rating: number | null;
  notes: string;
  success: boolean | null;
}

export interface SpinRecord {
  id: string;
  at: string;
  mode: 'wheel' | 'slots';
  fragranceId: string;
  eligibleCount: number;
  addedToRotation: boolean;
}

export interface RecommendationRecord {
  id: string;
  at: string;
  engine: 'ai' | 'local';
  context: RecommendationContext;
  picks: { fragranceId?: string; external?: { brand: string; name: string }; reason: string }[];
  summary: string;
}

export const MOODS = [
  'main_character',
  'clean_energy',
  'dark_mysterious',
  'soft_cozy',
  'date_night',
  'loud_entrance',
  'fresh_start',
  'after_hours',
] as const;
export type Mood = (typeof MOODS)[number];

export interface RecommendationContext {
  mood?: Mood | null;
  occasion?: Occasion | string | null;
  timeOfDay?: TimeOfDay | null;
  intensity?: 'soft' | 'moderate' | 'loud' | null;
  impression?: string | null;
  family?: string | null;
  weather?: WeatherSnapshot | null;
  /** Manual temperature override when weather is unavailable. */
  manualTempC?: number | null;
  query?: string | null;
  external?: boolean;
}

export interface CityRef {
  name: string;
  country: string;
  admin?: string;
  lat: number;
  lon: number;
}

export type Lang = 'en' | 'it';

export interface Preferences {
  name: string;
  language: Lang;
  units: 'metric' | 'imperial';
  theme: 'system' | 'light' | 'dark';
  favoriteFamilies: string[];
  favoriteAccords: string[];
  dislikedNotes: string[];
  intensity: 'soft' | 'moderate' | 'loud' | 'any';
  projection: 'close' | 'moderate' | 'big' | 'any';
  longevity: 'short' | 'moderate' | 'long' | 'any';
  occasions: Occasion[];
  customOccasions: string[];
  seasons: Season[];
  runsWarm: 'cold' | 'neutral' | 'warm';
  moods: Mood[];
  weather: { mode: 'auto' | 'city' | 'off'; city: CityRef | null };
  achievementsEnabled: boolean;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  reduceMotion: 'system' | 'on' | 'off';
  learningEnabled: boolean;
  learningResetAt: string | null;
  aiConsent: boolean;
  onboarded: boolean;
}

export interface AchievementUnlock {
  id: string;
  unlockedAt: string;
}
