import { Art, type ArtName } from '../components/Art';
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

/** One hand-made sticker per mood — part of the app's illustration set. */
export function MoodArt({ mood, size = 56 }: { mood: Mood; size?: number }) {
  return <Art name={`mood-${mood.replace('_', '-')}` as ArtName} size={size} className="mood-art" />;
}
