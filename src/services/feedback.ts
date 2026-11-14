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

let noise: AudioBuffer | null = null;
function noiseBuf(a: AudioContext) {
  if (!noise) {
    noise = a.createBuffer(1, a.sampleRate * 1, a.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noise;
}

/** A short mechanical click (filtered noise) at an exact audio-clock time. */
function click(a: AudioContext, at: number, freq: number, gain: number, len = 0.018) {
  const src = a.createBufferSource();
  src.buffer = noiseBuf(a);
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = 6;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  src.connect(bp).connect(g).connect(a.destination);
  src.start(at, Math.random() * 0.5, len + 0.01);
}

/** Heavy reel stop: a low knock plus a short latch click. */
function thunk(a: AudioContext, at: number, pitch = 1) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(150 * pitch, at);
  o.frequency.exponentialRampToValueAtTime(60 * pitch, at + 0.12);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.22, at + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
  o.connect(g).connect(a.destination);
  o.start(at);
  o.stop(at + 0.2);
  click(a, at, 2600 * pitch, 0.12, 0.03);
}

export const sfx = {
  tick: () => blip(1200 + Math.random() * 200, 0.025, 'square', 0.03),
  reelStop: () => {
    const a = ac();
    if (a) thunk(a, a.currentTime);
  },
  /**
   * Three reels spinning together: each reel clicks (its own pitch) every time a
   * symbol passes the window, so the clicks slow down exactly as the reel brakes;
   * a soft motor hum sits underneath; each reel lands with a knock.
   * `clicks[r]` are offsets in seconds from now, `stops[r]` the stop time.
   */
  reels(clicks: number[][], stops: number[]) {
    const a = ac();
    if (!a) return;
    const now = a.currentTime + 0.02;
    const pitch = [1, 0.84, 0.7];
    clicks.forEach((times, r) => times.forEach((s) => click(a, now + s, 2100 * pitch[r], 0.05 + 0.015 * r)));
    stops.forEach((s, r) => thunk(a, now + s, pitch[r] + 0.15));
    // Motor hum: low-passed noise that fades out with the last reel.
    const end = Math.max(...stops);
    const src = a.createBufferSource();
    src.buffer = noiseBuf(a);
    src.loop = true;
    const lp = a.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(520, now);
    lp.frequency.exponentialRampToValueAtTime(140, now + end);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.05, now + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, now + end);
    src.connect(lp).connect(g).connect(a.destination);
    src.start(now);
    src.stop(now + end + 0.05);
  },
  pop: () => blip(660, 0.08, 'sine', 0.08),
  win() {
    const a = ac();
    if (!a) return;
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.14, 'triangle', 0.07), i * 90));
  },
};

// iOS Safari has no Vibration API, but toggling a native <input switch> from a
// user gesture plays the system "tick" haptic (iOS 18+). Elsewhere it's a no-op.
let iosSwitch: HTMLLabelElement | null = null;
function iosTick() {
  try {
    if (!iosSwitch) {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.id = 'haptic-switch';
      const label = document.createElement('label');
      label.htmlFor = input.id;
      for (const el of [input, label]) {
        el.setAttribute('aria-hidden', 'true');
        el.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-99px;top:0';
        el.tabIndex = -1;
      }
      document.body.append(input, label);
      iosSwitch = label;
    }
    iosSwitch.click();
  } catch {
    /* unsupported */
  }
}

export function vibrate(pattern: number | number[]) {
  if (!haptics) return;
  try {
    if (typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
    else iosTick();
  } catch {
    /* unsupported */
  }
}
