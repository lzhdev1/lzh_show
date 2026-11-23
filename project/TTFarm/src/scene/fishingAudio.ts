/** 钓鱼音效：全部用 WebAudio 程序化合成，不依赖外部音频文件。 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    const length = Math.floor(ctx.sampleRate * 1.2);
    noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** 必须在用户第一次点击钓鱼按钮时调用，浏览器才允许出声。 */
export function unlockFishingAudio() {
  ensure();
}

function envelope(ctx: AudioContext, duration: number, peak = 0.2, attack = 0.02) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, ctx.currentTime);
  g.gain.linearRampToValueAtTime(peak, ctx.currentTime + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  return g;
}

function burst(duration: number, lowpass: number, peak = 0.18) {
  const c = ensure();
  if (!c || !noise || !master) return;
  const src = c.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = lowpass;
  const g = envelope(c, duration, peak, 0.012);
  src.connect(filter).connect(g).connect(master);
  src.start();
  src.stop(c.currentTime + duration + 0.02);
}

function tone(freq: number, duration: number, peak = 0.14, type: OscillatorType = "sine", slide = 0) {
  const c = ensure();
  if (!c || !master) return;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), c.currentTime + duration);
  const g = envelope(c, duration, peak, 0.008);
  osc.connect(g).connect(master);
  osc.start();
  osc.stop(c.currentTime + duration + 0.02);
}

export interface FishingAudio {
  cast: () => void;
  plop: () => void;
  bite: () => void;
  updateReel: (active: boolean, tension: number, dt: number) => void;
  success: () => void;
  fail: () => void;
  dispose: () => void;
}

export function createFishingAudio(): FishingAudio {
  let clickAt = 0;
  return {
    cast: () => {
      burst(0.32, 1400, 0.2);
      tone(520, 0.18, 0.05, "triangle", -280);
    },
    plop: () => {
      burst(0.12, 700, 0.13);
      tone(190, 0.16, 0.11, "sine", -110);
    },
    bite: () => {
      tone(720, 0.08, 0.08, "square", -120);
      window.setTimeout(() => tone(580, 0.1, 0.08, "square", -90), 90);
      window.setTimeout(() => burst(0.18, 500, 0.1), 110);
    },
    updateReel: (active, tension, dt) => {
      const c = ensure();
      if (!c || !master) return;
      if (!active) {
        clickAt = 0;
        return;
      }
      clickAt -= dt;
      if (clickAt <= 0) {
        clickAt = 0.055 + Math.random() * 0.018;
        const peak = 0.025 + tension * 0.045;
        const g = envelope(c, 0.035, peak, 0.002);
        const osc = c.createOscillator();
        osc.type = "square";
        osc.frequency.value = 360 + Math.random() * 120 + tension * 180;
        osc.connect(g).connect(master);
        osc.start();
        osc.stop(c.currentTime + 0.045);
        if (tension > 0.6) burst(0.09, 2200, 0.018);
      }
    },
    success: () => {
      tone(660, 0.18, 0.12, "triangle", 120);
      window.setTimeout(() => tone(880, 0.24, 0.1, "triangle", 140), 120);
      window.setTimeout(() => burst(0.22, 900, 0.14), 80);
    },
    fail: () => {
      burst(0.16, 2400, 0.12);
      tone(210, 0.2, 0.08, "sawtooth", -120);
      window.setTimeout(() => tone(140, 0.22, 0.05, "sine", -60), 80);
    },
    dispose: () => {
      // 全局音频上下文留给下一次钓鱼复用，避免频繁重建
    },
  };
}
