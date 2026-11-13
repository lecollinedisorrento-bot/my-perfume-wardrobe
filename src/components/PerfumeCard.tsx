import { Link } from 'react-router-dom';
import type { Fragrance } from '../domain/types';
import { BottleImage } from './BottleImage';
import { Accord, FavButton } from './ui';
import { familyColor, resolveFamily } from '../domain/families';
import { useStore } from '../state/store';
import { useI18n } from '../i18n';
import { hasProfile } from '../domain/fragrance';

export function PerfumeCard({
  f,
  index,
  mini = false,
  i = 0,
}: {
  f: Fragrance;
  index?: number;
  mini?: boolean;
  i?: number;
}) {
  const { toggleFavorite } = useStore();
  const { t } = useI18n();
  const color = familyColor(f.family);
  return (
    <Link
      to={`/perfume/${f.id}`}
      className={`pcard ${mini ? 'mini' : ''}`}
      style={{ ['--i' as string]: i }}
      aria-label={`${f.brand} ${f.name}`}
    >
      <div className={`pcard-stage c-${color === 'ink' ? 'lilac' : color} dots`}>
        {index != null && <span className="pcard-num">#{String(index).padStart(2, '0')}</span>}
        {!mini && (
          <span className="pcard-fav">
            <FavButton on={f.favorite} onToggle={() => void toggleFavorite(f.id)} />
          </span>
        )}
        <BottleImage fragrance={f} />
      </div>
      <div className="pcard-body">
        <span className="pcard-brand">{f.brand}</span>
        <span className="pcard-name">{f.name}</span>
        {!mini && (
          <>
            {f.family && <span className="pcard-family">{resolveFamily(f.family)?.id ?? f.family}</span>}
            <div className="pcard-accords">
              {f.accords.slice(0, 2).map((a) => (
                <Accord key={a} name={a} />
              ))}
              {!hasProfile(f) && <span className="tiny dim">{t('wardrobe.unresearched')}</span>}
            </div>
          </>
        )}
      </div>
    </Link>
  );
}

export function PerfumeRow({ f, i = 0, meta }: { f: Fragrance; i?: number; meta?: string }) {
  const { toggleFavorite } = useStore();
  const color = familyColor(f.family);
  return (
    <Link to={`/perfume/${f.id}`} className="prow" style={{ ['--i' as string]: i }}>
      <div className={`prow-thumb c-${color === 'ink' ? 'lilac' : color}`}>
        <BottleImage fragrance={f} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="pcard-brand">{f.brand}</div>
        <div className="pcard-name" style={{ fontSize: 16 }}>
          {f.name}
        </div>
        <div className="tiny dim" style={{ marginTop: 2 }}>
          {[resolveFamily(f.family)?.id ?? f.family, f.accords.slice(0, 3).join(' · '), meta].filter(Boolean).join(' — ')}
        </div>
      </div>
      <FavButton on={f.favorite} onToggle={() => void toggleFavorite(f.id)} />
    </Link>
  );
}
