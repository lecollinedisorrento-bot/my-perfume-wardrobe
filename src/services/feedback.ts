// Tiny synthesized sound effects (WebAudio, no asset files) + haptics.

let ctx: AudioContext | null = null;
let enabled = true;
let haptics = true;

export function configureFeedback(opts: { sound: boolean; haptics: boolean }) {
  enabled = opts.sound;
  haptics = opts.haptics;
}

function ac(): AudioContext | null {
  if (!enabled) return null;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function blip(freq: number, dur = 0.05, type: OscillatorType = 'square', gain = 0.05) {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + dur + 0.02);
}

export const sfx = {
  tick: () => blip(1200 + Math.random() * 200, 0.025, 'square', 0.03),
  reelStop: () => blip(320, 0.09, 'triangle', 0.08),
  pop: () => blip(660, 0.08, 'sine', 0.08),
  win() {
    const a = ac();
    if (!a) return;
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.14, 'triangle', 0.07), i * 90));
  },
};

export function vibrate(pattern: number | number[]) {
  if (!haptics) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}
