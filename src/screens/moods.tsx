import type { Mood } from '../domain/types';

export const MOOD_COLORS: Record<Mood, 'blue' | 'pink' | 'lime' | 'tangerine' | 'lilac' | 'ink'> = {
  main_character: 'tangerine',
  clean_energy: 'lime',
  dark_mysterious: 'ink',
  soft_cozy: 'lilac',
  date_night: 'pink',
  loud_entrance: 'blue',
  fresh_start: 'lime',
  after_hours: 'ink',
};

/** One graphic glyph per mood — part of the app's sticker vocabulary. */
export function MoodArt({ mood, size = 56 }: { mood: Mood; size?: number }) {
  const s = { width: size, height: size };
  const stroke = { stroke: 'var(--ink)', strokeWidth: 4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  switch (mood) {
    case 'main_character':
      return (
        <svg viewBox="0 0 64 64" style={s} aria-hidden="true">
          <path d="m32 5 7 17 18 1-14 11 5 18-16-10-16 10 5-18L7 23l18-1 7-17Z" fill="var(--lime)" {...stroke} />
        </svg>
      );
    case 'clean_energy':
      return (
        <svg viewBox="0 0 64 64" style={s} aria-hidden="true">
          <circle cx="32" cy="32" r="13" fill="var(--white)" {...stroke} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((r) => (
            <path key={r} d="M32 5v9" {...stroke} transform={`rotate(${r} 32 32)`} />
          ))}
        </svg>
      );
    case 'dark_mysterious':
      return (
        <svg viewBox="0 0 64 64" style={s} aria-hidden="true">
          <path d="M40 8a24 24 0 1 0 16 38A20 20 0 0 1 40 8Z" fill="var(--lilac)" {...stroke} stroke="var(--cloud)" />
          <circle cx="46" cy="18" r="3" fill="var(--cloud)" />
        </svg>
      );
    case 'soft_cozy':
      return (
        <svg viewBox="0 0 64 64" style={s} aria-hidden="true">
          <path d="M14 44a12 12 0 0 1 2-23 16 16 0 0 1 31 3 10 10 0 0 1 3 20Z" fill="var(--white)" {...stroke} />
        </svg>
      );
    case 'date_night':
      return (
        <svg viewBox="0 0 64 64" style={s} aria-hidden="true">
          <path d="M32 54S8 40 8 24a12 12 0 0 1 24-4 12 12 0 0 1 24 4c0 16-24 30-24 30Z" fill="var(--tangerine)" {...stroke} />
        </svg>
      );
    case 'loud_entrance':
      return (
        <svg viewBox="0 0 64 64" style={s} aria-hidden="true">
          <path d="M8 26v12h10l18 14V12L18 26H8Z" fill="var(--lime)" {...stroke} />
          <path d="M44 22a14 14 0 0 1 0 20M50 15a24 24 0 0 1 0 34" fill="none" {...stroke} stroke="var(--white)" />
        </svg>
      );
    case 'fresh_start':
      return (
        <svg viewBox="0 0 64 64" style={s} aria-hidden="true">
          <path d="M32 56V30" {...stroke} />
          <path d="M32 34C18 34 12 24 12 12c14 0 20 10 20 22Z" fill="var(--blue)" {...stroke} />
          <path d="M32 40c12 0 18-8 18-18-12 0-18 8-18 18Z" fill="var(--white)" {...stroke} />
        </svg>
      );
    case 'after_hours':
      return (
        <svg viewBox="0 0 64 64" style={s} aria-hidden="true">
          <path d="M14 10h36L32 34 14 10Z" fill="var(--pink)" {...stroke} stroke="var(--cloud)" />
          <path d="M32 34v18M22 54h20" fill="none" {...stroke} stroke="var(--cloud)" />
          <circle cx="40" cy="14" r="3" fill="var(--lime)" />
        </svg>
      );
  }
}
