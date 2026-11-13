import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

type ToastTone = 'ink' | 'lime' | 'pink' | 'error';
interface Toast {
  id: number;
  text: string;
  tone: ToastTone;
}

interface UiCtx {
  toast: (text: string, tone?: ToastTone) => void;
  confetti: (opts?: { x?: number; y?: number }) => void;
  reducedMotion: boolean;
}

const Ctx = createContext<UiCtx>({ toast: () => {}, confetti: () => {}, reducedMotion: false });

export function useUi() {
  return useContext(Ctx);
}

export function UiProvider({ children, reducedMotion }: { children: ReactNode; reducedMotion: boolean }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const raf = useRef(0);

  const toast = useCallback((text: string, tone: ToastTone = 'ink') => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 5200 : 3000);
  }, []);

  const loop = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, c.width, c.height);
    const dpr = window.devicePixelRatio || 1;
    particles.current = particles.current.filter((p) => p.life > 0);
    for (const p of particles.current) {
      p.vy += 0.18;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life--;
      g.save();
      g.translate(p.x * dpr, p.y * dpr);
      g.rotate(p.rot);
      g.globalAlpha = Math.min(1, p.life / 30);
      g.fillStyle = p.color;
      g.strokeStyle = '#202020';
      g.lineWidth = 1.5 * dpr;
      if (p.shape === 0) {
        g.fillRect(-4 * dpr, -7 * dpr, 8 * dpr, 14 * dpr);
        g.strokeRect(-4 * dpr, -7 * dpr, 8 * dpr, 14 * dpr);
      } else if (p.shape === 1) {
        g.beginPath();
        g.arc(0, 0, 5 * dpr, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      } else {
        star(g, 7 * dpr);
      }
      g.restore();
    }
    if (particles.current.length) raf.current = requestAnimationFrame(loop);
    else g.clearRect(0, 0, c.width, c.height);
  }, []);

  const confetti = useCallback(
    (opts: { x?: number; y?: number } = {}) => {
      if (reducedMotion) return;
      const c = canvasRef.current;
      if (!c) return;
      const dpr = window.devicePixelRatio || 1;
      c.width = window.innerWidth * dpr;
      c.height = window.innerHeight * dpr;
      const x = opts.x ?? window.innerWidth / 2;
      const y = opts.y ?? window.innerHeight / 3;
      const colors = ['#3155FF', '#FF65B8', '#D5F34A', '#FF7738', '#B69AFF'];
      for (let i = 0; i < 70; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = 4 + Math.random() * 7;
        particles.current.push({
          x,
          y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v - 5,
          rot: Math.random() * 6,
          vr: (Math.random() - 0.5) * 0.4,
          life: 70 + Math.random() * 40,
          color: colors[i % colors.length],
          shape: i % 3,
        });
      }
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(loop);
    },
    [loop, reducedMotion],
  );

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return (
    <Ctx.Provider value={{ toast, confetti, reducedMotion }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>
            {t.text}
          </div>
        ))}
      </div>
      <canvas ref={canvasRef} className="confetti-canvas" aria-hidden="true" />
    </Ctx.Provider>
  );
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  life: number;
  color: string;
  shape: number;
}

function star(g: CanvasRenderingContext2D, r: number) {
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 ? r * 0.42 : r;
    const a = (i * Math.PI) / 4;
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
  g.stroke();
}
