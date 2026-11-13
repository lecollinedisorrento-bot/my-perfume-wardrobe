// Fragrance families and accord vocabulary with *tendencies* used by the local
// recommendation engine. These are rough heuristics, not rules: they are only
// used when no better information exists, and the UI labels them as such.

export interface FamilyTrait {
  id: string;
  /** 0 = dense/warm, 1 = airy/fresh */
  freshness: number;
  /** 0 = whisper, 1 = heavy */
  weight: number;
  sweetness: number;
  color: string; // css var name
}

export const FAMILIES: FamilyTrait[] = [
  { id: 'Citrus', freshness: 1, weight: 0.15, sweetness: 0.2, color: 'lime' },
  { id: 'Aromatic', freshness: 0.8, weight: 0.35, sweetness: 0.15, color: 'lime' },
  { id: 'Fresh', freshness: 0.95, weight: 0.2, sweetness: 0.15, color: 'blue' },
  { id: 'Aquatic', freshness: 0.95, weight: 0.25, sweetness: 0.1, color: 'blue' },
  { id: 'Green', freshness: 0.85, weight: 0.25, sweetness: 0.05, color: 'lime' },
  { id: 'Fougère', freshness: 0.7, weight: 0.45, sweetness: 0.25, color: 'blue' },
  { id: 'Floral', freshness: 0.6, weight: 0.4, sweetness: 0.45, color: 'pink' },
  { id: 'Musk', freshness: 0.6, weight: 0.35, sweetness: 0.3, color: 'lilac' },
  { id: 'Powdery', freshness: 0.45, weight: 0.45, sweetness: 0.45, color: 'lilac' },
  { id: 'Chypre', freshness: 0.5, weight: 0.55, sweetness: 0.2, color: 'tangerine' },
  { id: 'Woody', freshness: 0.4, weight: 0.6, sweetness: 0.2, color: 'tangerine' },
  { id: 'Spicy', freshness: 0.3, weight: 0.65, sweetness: 0.35, color: 'tangerine' },
  { id: 'Leather', freshness: 0.25, weight: 0.75, sweetness: 0.15, color: 'ink' },
  { id: 'Amber', freshness: 0.15, weight: 0.8, sweetness: 0.6, color: 'tangerine' },
  { id: 'Gourmand', freshness: 0.15, weight: 0.75, sweetness: 0.95, color: 'pink' },
  { id: 'Oud', freshness: 0.1, weight: 0.95, sweetness: 0.3, color: 'ink' },
  { id: 'Smoky', freshness: 0.15, weight: 0.85, sweetness: 0.1, color: 'ink' },
];

const FAMILY_ALIASES: Record<string, string> = {
  oriental: 'Amber',
  'amber oriental': 'Amber',
  'oriental woody': 'Amber',
  'woody oriental': 'Amber',
  'floral oriental': 'Amber',
  'amber woody': 'Amber',
  'amber floral': 'Floral',
  'woody aromatic': 'Aromatic',
  'aromatic fougere': 'Fougère',
  fougere: 'Fougère',
  'citrus aromatic': 'Citrus',
  'floral fruity': 'Floral',
  'fruity floral': 'Floral',
  'woody spicy': 'Spicy',
  'woody floral musk': 'Musk',
  'floral woody musk': 'Musk',
  musky: 'Musk',
  'leather woody': 'Leather',
  'woody leather': 'Leather',
  'oud woody': 'Oud',
  'agarwood': 'Oud',
  'woody chypre': 'Chypre',
  'fruity chypre': 'Chypre',
  'gourmand amber': 'Gourmand',
  'amber gourmand': 'Gourmand',
  fresh: 'Fresh',
  'fresh spicy': 'Spicy',
  incense: 'Smoky',
  'aquatic aromatic': 'Aquatic',
  marine: 'Aquatic',
};

/** Map any free-text family to one of our families (best effort). */
export function resolveFamily(raw: string | null | undefined): FamilyTrait | null {
  if (!raw) return null;
  const k = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  const direct = FAMILIES.find((f) => f.id.toLowerCase() === k);
  if (direct) return direct;
  const alias = FAMILY_ALIASES[k];
  if (alias) return FAMILIES.find((f) => f.id === alias) ?? null;
  // first family word that appears in the string
  const hit = FAMILIES.find((f) => k.includes(f.id.toLowerCase().replace('è', 'e')));
  if (hit) return hit;
  if (k.includes('orient')) return FAMILIES.find((f) => f.id === 'Amber')!;
  return null;
}

/** Accord → tendencies. Used to refine the family-based traits. */
const ACCORD_TRAITS: Record<string, Partial<Omit<FamilyTrait, 'id' | 'color'>>> = {
  citrus: { freshness: 1, weight: 0.1 },
  bergamot: { freshness: 1, weight: 0.1 },
  fresh: { freshness: 0.95, weight: 0.15 },
  aquatic: { freshness: 0.95, weight: 0.2 },
  marine: { freshness: 0.95, weight: 0.2 },
  ozonic: { freshness: 0.95, weight: 0.15 },
  green: { freshness: 0.85, weight: 0.2 },
  aromatic: { freshness: 0.8, weight: 0.3 },
  herbal: { freshness: 0.8, weight: 0.3 },
  lavender: { freshness: 0.7, weight: 0.35 },
  'fresh spicy': { freshness: 0.7, weight: 0.4 },
  fruity: { freshness: 0.7, weight: 0.35, sweetness: 0.6 },
  floral: { freshness: 0.6, weight: 0.4, sweetness: 0.4 },
  'white floral': { freshness: 0.5, weight: 0.55, sweetness: 0.5 },
  rose: { freshness: 0.55, weight: 0.45, sweetness: 0.4 },
  iris: { freshness: 0.5, weight: 0.4, sweetness: 0.3 },
  powdery: { freshness: 0.45, weight: 0.4, sweetness: 0.45 },
  musky: { freshness: 0.55, weight: 0.35, sweetness: 0.3 },
  musk: { freshness: 0.55, weight: 0.35, sweetness: 0.3 },
  mineral: { freshness: 0.8, weight: 0.25 },
  salty: { freshness: 0.75, weight: 0.3 },
  woody: { freshness: 0.4, weight: 0.6 },
  cedar: { freshness: 0.5, weight: 0.5 },
  sandalwood: { freshness: 0.3, weight: 0.6, sweetness: 0.35 },
  'warm spicy': { freshness: 0.2, weight: 0.75, sweetness: 0.4 },
  spicy: { freshness: 0.3, weight: 0.65 },
  cinnamon: { freshness: 0.2, weight: 0.7, sweetness: 0.5 },
  leather: { freshness: 0.2, weight: 0.8 },
  smoky: { freshness: 0.15, weight: 0.85 },
  incense: { freshness: 0.2, weight: 0.8 },
  balsamic: { freshness: 0.15, weight: 0.8, sweetness: 0.5 },
  amber: { freshness: 0.15, weight: 0.8, sweetness: 0.6 },
  vanilla: { freshness: 0.15, weight: 0.75, sweetness: 0.9 },
  sweet: { freshness: 0.25, weight: 0.6, sweetness: 0.9 },
  gourmand: { freshness: 0.1, weight: 0.8, sweetness: 1 },
  honey: { freshness: 0.15, weight: 0.75, sweetness: 0.95 },
  tobacco: { freshness: 0.15, weight: 0.8, sweetness: 0.5 },
  boozy: { freshness: 0.2, weight: 0.75, sweetness: 0.6 },
  rum: { freshness: 0.2, weight: 0.75, sweetness: 0.7 },
  oud: { freshness: 0.1, weight: 0.95, sweetness: 0.2 },
  animalic: { freshness: 0.1, weight: 0.9 },
  earthy: { freshness: 0.35, weight: 0.65 },
  patchouli: { freshness: 0.25, weight: 0.7, sweetness: 0.2 },
  'soft spicy': { freshness: 0.4, weight: 0.5, sweetness: 0.3 },
  'cherry': { freshness: 0.35, weight: 0.6, sweetness: 0.85 },
  coffee: { freshness: 0.15, weight: 0.75, sweetness: 0.6 },
  cacao: { freshness: 0.15, weight: 0.8, sweetness: 0.7 },
  almond: { freshness: 0.3, weight: 0.6, sweetness: 0.8 },
  coconut: { freshness: 0.5, weight: 0.5, sweetness: 0.7 },
  tropical: { freshness: 0.6, weight: 0.45, sweetness: 0.7 },
  'aldehydic': { freshness: 0.7, weight: 0.4, sweetness: 0.3 },
};

export interface ScentTraits {
  freshness: number;
  weight: number;
  sweetness: number;
  known: boolean; // false when we have nothing to go on
}

export function traitsFor(family: string | null | undefined, accords: string[]): ScentTraits {
  const fam = resolveFamily(family);
  const samples: { freshness: number; weight: number; sweetness: number; w: number }[] = [];
  if (fam) samples.push({ ...fam, w: 2 });
  accords.slice(0, 6).forEach((a, i) => {
    const t = ACCORD_TRAITS[a.trim().toLowerCase()];
    if (t) {
      samples.push({
        freshness: t.freshness ?? 0.5,
        weight: t.weight ?? 0.5,
        sweetness: t.sweetness ?? 0.3,
        w: Math.max(0.6, 1.6 - i * 0.2), // dominant accords weigh more
      });
    }
  });
  if (!samples.length) return { freshness: 0.5, weight: 0.5, sweetness: 0.3, known: false };
  const tw = samples.reduce((s, x) => s + x.w, 0);
  return {
    freshness: samples.reduce((s, x) => s + x.freshness * x.w, 0) / tw,
    weight: samples.reduce((s, x) => s + x.weight * x.w, 0) / tw,
    sweetness: samples.reduce((s, x) => s + x.sweetness * x.w, 0) / tw,
    known: true,
  };
}

const ACCORD_COLORS: [RegExp, string][] = [
  [/citrus|bergamot|lemon|mandarin|orange|grapefruit|yuzu|lime/i, 'lime'],
  [/green|herbal|aromatic|lavender|mint|tea|basil/i, 'lime'],
  [/aquatic|marine|ozonic|fresh|mineral|salt|metallic/i, 'blue'],
  [/rose|floral|jasmine|tuberose|iris|violet|white floral|peony/i, 'pink'],
  [/fruity|cherry|berry|peach|apple|pear|tropical|coconut/i, 'pink'],
  [/musk|powder|aldehyd|soft/i, 'lilac'],
  [/vanilla|sweet|gourmand|honey|caramel|cacao|coffee|almond|tonka/i, 'pink'],
  [/amber|spic|cinnamon|saffron|warm|balsam|tobacco|rum|boozy/i, 'tangerine'],
  [/wood|cedar|sandal|vetiver|patchouli|earthy|moss/i, 'tangerine'],
  [/oud|leather|smok|incense|animal/i, 'ink'],
];

export function accordColor(accord: string): string {
  for (const [re, c] of ACCORD_COLORS) if (re.test(accord)) return c;
  return 'lilac';
}

export function familyColor(family: string | null | undefined): string {
  return resolveFamily(family)?.color ?? 'lilac';
}

/** Stable hash → index, used to give unknown perfumes a consistent colour. */
export function hashIndex(s: string, mod: number): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % mod;
}

export const POP_COLORS = ['blue', 'pink', 'lime', 'tangerine', 'lilac'] as const;
