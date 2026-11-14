import { appUrl } from '../services/base';

/** Hand-made risograph sticker illustrations in /public/art (decorative). */
export type ArtName =
  | 'onb-hero'
  | 'home-surprise'
  | 'home-mix'
  | 'mood-main-character'
  | 'mood-clean-energy'
  | 'mood-dark-mysterious'
  | 'mood-soft-cozy'
  | 'mood-date-night'
  | 'mood-loud-entrance'
  | 'mood-fresh-start'
  | 'mood-after-hours'
  | 'empty-wardrobe'
  | 'empty-combos'
  | 'empty-history'
  | 'spin-win'
  | 'lab-mix'
  | 'badge-frame'
  | 'slot-cabinet'
  | 'slot-win'
  | 'slot-knob'
  | 'slot-arm'
  | 'slot-base';

export function Art({ name, className = '', size, eager = false }: { name: ArtName; className?: string; size?: number; eager?: boolean }) {
  return (
    <img
      src={appUrl(`/art/${name}.webp`)}
      alt=""
      aria-hidden="true"
      className={`art ${className}`}
      style={size ? { width: size, height: size } : undefined}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
    />
  );
}
