import { useEffect, useState } from 'react';
import type { Fragrance } from '../domain/types';
import { objectUrlFor } from '../services/images';
import { catalogImageFor, type CatalogImage } from '../services/catalog';
import { familyColor, hashIndex, POP_COLORS } from '../domain/families';
import { useI18n } from '../i18n';

/**
 * Shows the stored bottle image. When there is none, it renders an abstract,
 * obviously graphic placeholder (a pop silhouette + monogram) — never a
 * realistic fake bottle.
 */
export function BottleImage({
  fragrance,
  showLabel = false,
  className = '',
}: {
  fragrance: Pick<Fragrance, 'id' | 'brand' | 'name' | 'image' | 'family'>;
  showLabel?: boolean;
  className?: string;
}) {
  const { t, tk } = useI18n();
  const [url, setUrl] = useState<string | null>(null);
  const [cat, setCat] = useState<CatalogImage | null>(null);
  const key = fragrance.image?.blobKey;

  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (key) void objectUrlFor(key).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [key]);

  // No photo of their own: use the catalogue's cut-out official photo, if any.
  useEffect(() => {
    let alive = true;
    setCat(null);
    if (!key) void catalogImageFor(fragrance.brand, fragrance.name).then((c) => alive && setCat(c));
    return () => {
      alive = false;
    };
  }, [key, fragrance.brand, fragrance.name]);

  if (key && url) {
    return (
      <div className={`bottle ${className}`}>
        <img src={url} alt={`${fragrance.brand} ${fragrance.name}`} loading="lazy" decoding="async" />
        {showLabel && fragrance.image && (
          <span className="img-label">
            {tk(`img.kind.${fragrance.image.kind}`)}
            {fragrance.image.sourceName ? ` · ${fragrance.image.sourceName}` : ''}
          </span>
        )}
      </div>
    );
  }

  if (!key && cat) {
    return (
      <div className={`bottle bottle-cutout ${className}`}>
        <img src={cat.url} alt={`${fragrance.brand} ${fragrance.name}`} loading="lazy" decoding="async" />
        {showLabel && (
          <span className="img-label">
            {tk(`img.kind.${cat.t === 'official' ? 'official' : 'retailer'}`)} · {cat.n}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`bottle bottle-fallback ${className}`} role="img" aria-label={`${fragrance.brand} ${fragrance.name} — ${t('card.noImage')}`}>
      <FallbackArt seed={fragrance.brand + fragrance.name} family={fragrance.family} monogram={monogram(fragrance.brand, fragrance.name)} />
    </div>
  );
}

function monogram(brand: string, name: string) {
  const b = brand.trim()[0] ?? '';
  const n = name.trim()[0] ?? '';
  return (b + n).toUpperCase();
}

const SHAPES = [
  // capsule
  'M30 34h40a8 8 0 0 1 8 8v44a10 10 0 0 1-10 10H32a10 10 0 0 1-10-10V42a8 8 0 0 1 8-8Z',
  // round flask
  'M50 30c19 0 30 15 30 33S69 98 50 98 20 81 20 63s11-33 30-33Z',
  // faceted
  'M28 36h44l10 14v36a10 10 0 0 1-10 10H28a10 10 0 0 1-10-10V50Z',
  // tall arch
  'M34 30h32a12 12 0 0 1 12 12v46a8 8 0 0 1-8 8H30a8 8 0 0 1-8-8V42a12 12 0 0 1 12-12Z',
];

function FallbackArt({ seed, family, monogram }: { seed: string; family: string; monogram: string }) {
  const colorName = family ? familyColor(family) : POP_COLORS[hashIndex(seed, POP_COLORS.length)];
  const fill = `var(--${colorName === 'ink' ? 'lilac' : colorName})`;
  const shape = SHAPES[hashIndex(seed + 'shape', SHAPES.length)];
  const capW = 18 + hashIndex(seed + 'cap', 3) * 6;
  return (
    <svg viewBox="0 0 100 104" aria-hidden="true">
      <rect x={50 - capW / 2} y="10" width={capW} height="18" rx="5" fill="var(--ink)" />
      <rect x="44" y="26" width="12" height="8" fill="var(--ink)" />
      <path d={shape} fill={fill} stroke="var(--ink)" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M32 50c0-6 3-9 7-10" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.7" />
      <text
        x="50"
        y="74"
        textAnchor="middle"
        fontFamily="Unbounded Variable, Arial Black, sans-serif"
        fontWeight="800"
        fontSize="20"
        fill="var(--ink)"
      >
        {monogram}
      </text>
    </svg>
  );
}
