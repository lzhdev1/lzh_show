/**
 * 农场现场音效：脚步、播种、浇水、收获、车辆。
 * 全部用 WebAudio 程序化合成，不新增音频文件；与钓鱼、河流各自独立。
 */
import { getSfxEnabled, SFX_CHANGED, SFX_EVENT, type SfxKind } from "../game/sfx";

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
    master.gain.value = getSfxEnabled() ? 0.5 : 0;
    master.connect(ctx.destination);
    const length = Math.floor(ctx.sampleRate * 1.2);
    noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** 第一次点击/按键时解锁；之后的异步动作也能正常发声。 */
export function unlockFarmAudio(): void {
  ensure();
}

if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", unlockFarmAudio, { once: true, passive: true });
  window.addEventListener("keydown", unlockFarmAudio, { once: true });
  window.addEventListener(SFX_CHANGED, () => {
    if (master) master.gain.value = getSfxEnabled() ? 0.5 : 0;
  });
  window.addEventListener(SFX_EVENT, (event) => {
    const kind = (event as CustomEvent<SfxKind>).detail;
    play(kind);
  });
}

function panNode(c: AudioContext, pan: number): AudioNode {
  if (!pan) {
    // 返回一个单位增益节点，保持 filter→gain→master 的链路完整
    return c.createGain();
  }
  const node = c.createStereoPanner();
  node.pan.value = pan;
  return node;
}

interface NoiseOptions {
  cutoff: number;
  peak: number;
  type?: BiquadFilterType;
  pan?: number;
  delay?: number;
  q?: number;
  attack?: number;
  hold?: number;
}

function noiseBurst(duration: number, options: NoiseOptions): void {
  const c = ensure();
  if (!c || !noise || !master) return;
  const start = c.currentTime + (options.delay ?? 0);
  const src = c.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = options.type ?? "lowpass";
  filter.frequency.value = options.cutoff;
  filter.Q.value = options.q ?? 0.8;
  const gain = c.createGain();
  const peak = options.peak;
  const attack = options.attack ?? 0.012;
  const hold = options.hold ?? 0;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(peak, start + attack);
  if (hold > 0) gain.gain.setValueAtTime(peak, start + attack + hold);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  src.connect(filter).connect(gain).connect(panNode(c, options.pan ?? 0)).connect(master);
  src.start(start);
  src.stop(start + duration + 0.03);
}

function tone(freq: number, duration: number, peak: number, type: OscillatorType = "sine",
  slide = 0, delay = 0, pan = 0): void {
  const c = ensure();
  if (!c || !master) return;
  const start = c.currentTime + delay;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(20, freq), start);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), start + duration);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(peak, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(panNode(c, pan)).connect(master);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

// —— 脚步：草地上的短促沙沙，跑动更重、更密 ——
let stepClock = 0;
let stepSide = 1;
let wasMoving = false;

export function updateWalk(moving: boolean, running: boolean, dt: number): void {
  if (!moving) {
    stepClock = 0;
    wasMoving = false;
    return;
  }
  const interval = running ? 0.29 : 0.47;
  if (!wasMoving) stepClock = interval;
  wasMoving = true;
  stepClock += dt;
  if (stepClock < interval) return;
  stepClock = 0;
  stepSide = -stepSide;
  const pan = stepSide * 0.12;
  const lift = running ? 1 : 0.68;
  noiseBurst(running ? 0.1 : 0.12, {
    cutoff: running ? 900 : 620, peak: 0.052 * lift, type: "lowpass", pan, q: 1.1,
  });
  noiseBurst(running ? 0.06 : 0.075, {
    cutoff: 2300, peak: 0.018 * lift, type: "bandpass", pan, q: 1.4,
  });
  tone(64 + Math.random() * 8, 0.08, 0.028 * lift, "sine", -18, 0, pan);
}

export function playLanding(): void {
  noiseBurst(0.15, { cutoff: 430, peak: 0.11, type: "lowpass" });
  tone(54, 0.18, 0.06, "sine", -16);
}

// —— 动作音效 ——
export function play(kind: SfxKind): void {
  if (!getSfxEnabled()) return;
  switch (kind) {
    case "plant":
      noiseBurst(0.16, { cutoff: 520, peak: 0.13 });
      noiseBurst(0.1, { cutoff: 800, peak: 0.08, delay: 0.1 });
      tone(330, 0.12, 0.045, "triangle", 120, 0.1);
      break;
    case "water": {
      const c = ensure();
      if (!c || !noise || !master) return;
      const start = c.currentTime;
      const src = c.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const filter = c.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1500;
      filter.Q.value = 0.55;
      const gain = c.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.075, start + 0.07);
      gain.gain.setValueAtTime(0.075, start + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.58);
      src.connect(filter).connect(gain).connect(master);
      src.start(start);
      src.stop(start + 0.6);
      tone(980, 0.09, 0.04, "sine", -220, 0.1);
      tone(1180, 0.08, 0.032, "sine", -260, 0.28);
      tone(880, 0.1, 0.028, "sine", -180, 0.44);
      break;
    }
    case "harvest":
      noiseBurst(0.18, { cutoff: 1800, peak: 0.075, type: "bandpass", q: 0.7 });
      tone(420, 0.12, 0.05, "triangle", 260, 0.04);
      tone(820, 0.1, 0.035, "triangle", 120, 0.16);
      tone(1060, 0.12, 0.03, "triangle", 90, 0.24);
      break;
  }
}

// —— 车辆：低频引擎循环，随速度变调；熄火时收声 ——
interface EngineNodes {
  a: OscillatorNode;
  b: OscillatorNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  road: AudioBufferSourceNode;
  roadGain: GainNode;
}

let engine: EngineNodes | null = null;

export function startDrive(): void {
  if (engine) return;
  const c = ensure();
  if (!c || !noise || !master) return;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 220;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.linearRampToValueAtTime(0.04, c.currentTime + 0.18);
  const a = c.createOscillator();
  a.type = "sawtooth";
  a.frequency.value = 46;
  const b = c.createOscillator();
  b.type = "triangle";
  b.frequency.value = 92;
  a.connect(filter).connect(gain).connect(master);
  b.connect(gain);
  a.start();
  b.start();

  const road = c.createBufferSource();
  road.buffer = noise;
  road.loop = true;
  const roadFilter = c.createBiquadFilter();
  roadFilter.type = "bandpass";
  roadFilter.frequency.value = 1700;
  roadFilter.Q.value = 0.6;
  const roadGain = c.createGain();
  roadGain.gain.value = 0;
  road.connect(roadFilter).connect(roadGain).connect(master);
  road.start();

  engine = { a, b, filter, gain, road, roadGain };
  tone(76, 0.2, 0.06, "square", 28);
}

export function updateDrive(speed: number, throttle: number, boost: boolean): void {
  if (!engine || !ctx) return;
  const s = Math.abs(speed);
  const targetGain = (s < 0.15 ? 0.034 : 0.046) + Math.min(0.032, s * 0.0045);
  const freq = 44 + Math.min(78, s * 4.6) + (boost ? 6 : 0);
  const now = ctx.currentTime;
  engine.gain.gain.setTargetAtTime(getSfxEnabled() ? targetGain : 0, now, 0.1);
  engine.a.frequency.setTargetAtTime(freq, now, 0.12);
  engine.b.frequency.setTargetAtTime(freq * 2.05, now, 0.12);
  engine.filter.frequency.setTargetAtTime(190 + s * 34 + Math.abs(throttle) * 28, now, 0.12);
  engine.roadGain.gain.setTargetAtTime(Math.min(0.03, s * 0.006), now, 0.14);
}

export function stopDrive(): void {
  if (!engine || !ctx) return;
  const nodes = engine;
  engine = null;
  const now = ctx.currentTime;
  nodes.gain.gain.cancelScheduledValues(now);
  nodes.gain.gain.setTargetAtTime(0.0001, now, 0.12);
  nodes.roadGain.gain.setTargetAtTime(0, now, 0.1);
  nodes.a.stop(now + 0.4);
  nodes.b.stop(now + 0.4);
  nodes.road.stop(now + 0.4);
  tone(120, 0.22, 0.035, "triangle", -60);
}

/** 切换视角/停止驾驶时兜底，避免引擎声残留。 */
export function silenceDrive(): void {
  if (engine) stopDrive();
}
