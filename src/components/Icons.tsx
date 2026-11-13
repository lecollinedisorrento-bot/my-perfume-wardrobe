// Custom chunky icon set: rounded caps, 2.2px strokes, playful geometry.
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = {
  viewBox: '0 0 32 32',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const IconHome = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5 15 16 5.5 27 15" />
    <path d="M8 13v12.5h16V13" />
    <path d="M16 25.5v-5" />
    <circle cx="16" cy="16" r="2" fill="currentColor" stroke="none" />
  </svg>
);

export const IconHanger = (p: P) => (
  <svg {...base} {...p}>
    <path d="M13 9a3 3 0 1 1 4.4 2.6c-.9.5-1.4 1.2-1.4 2.2V15" />
    <path d="M16 15 4.5 22.4c-1 .7-.5 2.1.7 2.1h21.6c1.2 0 1.7-1.4.7-2.1L16 15Z" />
  </svg>
);

export const IconWheel = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="16" cy="16" r="11.5" />
    <path d="M16 4.5v23M4.5 16h23M7.9 7.9l16.2 16.2M24.1 7.9 7.9 24.1" strokeWidth={1.8} />
    <circle cx="16" cy="16" r="3.4" fill="currentColor" />
  </svg>
);

export const IconFlask = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12.5 4.5h7M13.5 4.5v7.2L6.4 23.4A2.7 2.7 0 0 0 8.7 27.5h14.6a2.7 2.7 0 0 0 2.3-4.1L18.5 11.7V4.5" />
    <path d="M9.5 19h13" />
    <circle cx="14" cy="22.6" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="18.6" cy="21.6" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const IconSparkle = (p: P) => (
  <svg {...base} {...p}>
    <path d="M14 4c.7 5.4 2.6 7.3 8 8-5.4.7-7.3 2.6-8 8-.7-5.4-2.6-7.3-8-8 5.4-.7 7.3-2.6 8-8Z" fill="currentColor" fillOpacity={0.12} />
    <path d="M24 18.5c.4 2.7 1.3 3.6 4 4-2.7.4-3.6 1.3-4 4-.4-2.7-1.3-3.6-4-4 2.7-.4 3.6-1.3 4-4Z" />
  </svg>
);

export const IconPlus = (p: P) => (
  <svg {...base} {...p}>
    <path d="M16 6v20M6 16h20" strokeWidth={3} />
  </svg>
);

export const IconHeart = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg {...base} {...p}>
    <path
      d="M16 26.5S4.5 19.8 4.5 11.8A5.8 5.8 0 0 1 16 9.6a5.8 5.8 0 0 1 11.5 2.2c0 8-11.5 14.7-11.5 14.7Z"
      fill={filled ? 'currentColor' : 'none'}
    />
  </svg>
);

export const IconStar = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg {...base} {...p}>
    <path
      d="m16 4 3.6 7.6 8.2 1-6 5.7 1.5 8.2L16 22.6l-7.3 3.9 1.5-8.2-6-5.7 8.2-1L16 4Z"
      fill={filled ? 'currentColor' : 'none'}
    />
  </svg>
);

export const IconSearch = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="14" cy="14" r="8.5" />
    <path d="m20.5 20.5 6.5 6.5" />
  </svg>
);

export const IconGear = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="16" cy="16" r="4" />
    <path d="M16 3.5v3.2M16 25.3v3.2M28.5 16h-3.2M6.7 16H3.5M24.8 7.2l-2.3 2.3M9.5 22.5l-2.3 2.3M24.8 24.8l-2.3-2.3M9.5 9.5 7.2 7.2" />
  </svg>
);

export const IconBack = (p: P) => (
  <svg {...base} {...p}>
    <path d="M19 6 9 16l10 10" strokeWidth={3} />
  </svg>
);

export const IconClose = (p: P) => (
  <svg {...base} {...p}>
    <path d="m8 8 16 16M24 8 8 24" strokeWidth={3} />
  </svg>
);

export const IconCamera = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4.5 11.5a3 3 0 0 1 3-3h3l2-3h7l2 3h3a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-17a3 3 0 0 1-3-3v-12Z" />
    <circle cx="16" cy="17" r="5" />
  </svg>
);

export const IconGrid = (p: P) => (
  <svg {...base} {...p}>
    <rect x="5" y="5" width="9" height="9" rx="2.5" />
    <rect x="18" y="5" width="9" height="9" rx="2.5" />
    <rect x="5" y="18" width="9" height="9" rx="2.5" />
    <rect x="18" y="18" width="9" height="9" rx="2.5" />
  </svg>
);

export const IconList = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 8h15M12 16h15M12 24h15" />
    <circle cx="6" cy="8" r="1.6" fill="currentColor" />
    <circle cx="6" cy="16" r="1.6" fill="currentColor" />
    <circle cx="6" cy="24" r="1.6" fill="currentColor" />
  </svg>
);

export const IconFilter = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5 8h22M9 16h14M13 24h6" />
  </svg>
);

export const IconChart = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5 27h22" />
    <rect x="7" y="15" width="4.5" height="9" rx="1.5" />
    <rect x="13.8" y="8" width="4.5" height="16" rx="1.5" />
    <rect x="20.5" y="12" width="4.5" height="12" rx="1.5" />
  </svg>
);

export const IconTrash = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 9h20M13 9V6h6v3M8.5 9l1.3 16.5a2 2 0 0 0 2 1.8h8.4a2 2 0 0 0 2-1.8L23.5 9" />
  </svg>
);

export const IconPencil = (p: P) => (
  <svg {...base} {...p}>
    <path d="M20.5 6.5 25.5 11.5 12 25H7v-5L20.5 6.5Z" />
    <path d="m17.5 9.5 5 5" />
  </svg>
);

export const IconRefresh = (p: P) => (
  <svg {...base} {...p}>
    <path d="M25.5 13A10 10 0 0 0 7.2 9.5M6.5 19a10 10 0 0 0 18.3 3.5" />
    <path d="M7 4.5v5h5M25 27.5v-5h-5" />
  </svg>
);

export const IconPin = (p: P) => (
  <svg {...base} {...p}>
    <path d="M16 28s9-8.2 9-15a9 9 0 0 0-18 0c0 6.8 9 15 9 15Z" />
    <circle cx="16" cy="13" r="3.2" />
  </svg>
);

export const IconInfo = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="16" cy="16" r="12" />
    <path d="M16 15v7" />
    <circle cx="16" cy="10.2" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

export const IconCheck = (p: P) => (
  <svg {...base} {...p}>
    <path d="m6.5 16.5 6 6 13-13" strokeWidth={3} />
  </svg>
);

export const IconShare = (p: P) => (
  <svg {...base} {...p}>
    <path d="M16 4v16M10 10l6-6 6 6" />
    <path d="M8 15H6.5v12.5h19V15H24" />
  </svg>
);

export const IconSound = ({ off, ...p }: P & { off?: boolean }) => (
  <svg {...base} {...p}>
    <path d="M5 12.5v7h5l7 6v-19l-7 6H5Z" />
    {off ? <path d="m22 12 7 8M29 12l-7 8" /> : <path d="M22 11.5a6 6 0 0 1 0 9M25.5 8a11 11 0 0 1 0 16" />}
  </svg>
);

export const IconDrop = (p: P) => (
  <svg {...base} {...p}>
    <path d="M16 4.5S7.5 13.4 7.5 19a8.5 8.5 0 0 0 17 0C24.5 13.4 16 4.5 16 4.5Z" />
  </svg>
);

export const IconBadge = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="16" cy="12.5" r="7.5" />
    <path d="m11.5 18.5-2.5 9 7-3.5 7 3.5-2.5-9" />
  </svg>
);

/** Decorative starburst used as a sticker background. */
export function Burst({ points = 14, color = 'var(--lime)', className, children, size = 64 }: { points?: number; color?: string; className?: string; children?: React.ReactNode; size?: number }) {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? 36 : 50;
    const a = (i * Math.PI) / points - Math.PI / 2;
    pts.push(`${50 + Math.cos(a) * r},${50 + Math.sin(a) * r}`);
  }
  return (
    <span className={className} style={{ position: 'relative', display: 'inline-grid', placeItems: 'center', width: size, height: size }}>
      <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden="true">
        <polygon points={pts.join(' ')} fill={color} stroke="var(--ink)" strokeWidth="3.5" strokeLinejoin="round" />
      </svg>
      <span style={{ position: 'relative', textAlign: 'center' }}>{children}</span>
    </span>
  );
}

/** Abstract pop flower. */
export function Flower({ color = 'var(--pink)', size = 48, className }: { color?: string; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true">
      {[0, 60, 120, 180, 240, 300].map((r) => (
        <ellipse key={r} cx="50" cy="26" rx="15" ry="22" fill={color} stroke="var(--ink)" strokeWidth="3.5" transform={`rotate(${r} 50 50)`} />
      ))}
      <circle cx="50" cy="50" r="14" fill="var(--lime)" stroke="var(--ink)" strokeWidth="3.5" />
    </svg>
  );
}

export function Sparkle({ size = 22, color = 'currentColor', className }: { size?: number; color?: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      <path d="M12 1.5c.6 5.3 2.5 7.6 9 9-6.5 1.4-8.4 3.7-9 9-.6-5.3-2.5-7.6-9-9 6.5-1.4 8.4-3.7 9-9Z" fill={color} stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
