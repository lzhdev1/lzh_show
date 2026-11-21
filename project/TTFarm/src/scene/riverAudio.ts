// CC0 recordings, edited into seamless loops.
// “Stream River Water Up Close” by jackthemurray: https://freesound.org/s/433589/
// “Soft Rain in Forest Raindrops fall on leaves” by Borgory: https://freesound.org/s/678435/
import riverRecording from "../assets/river-flow.mp3?url";
import rainRecording from "../assets/rain-on-leaves.mp3?url";
import {
  getRainSoundEnabled, getRiverSoundEnabled, RAIN_SOUND_CHANGED, RIVER_SOUND_CHANGED,
} from "../game/riverSoundSetting";
import { isRainy, type WeatherKind } from "../game/weather";
import { RIVER_BED, riverInfo } from "./layout";

export {
  getRainSoundEnabled, getRiverSoundEnabled, setRainSoundEnabled, setRiverSoundEnabled,
} from "../game/riverSoundSetting";

const AUDIBLE_DISTANCE = 22;
const gestures = ["pointerdown", "pointerup", "keydown"] as const;

function createLoop(ctx: AudioContext, url: string, output: AudioNode, signal: AbortSignal, fade: number) {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(output);
  let buffer: AudioBuffer | undefined;
  let source: AudioBufferSourceNode | undefined;
  let loading = false;
  let retryAfter = 0;
  let stopTimer: number | undefined;
  let target = 0;
  let scheduledVolume = 0;

  function stop() {
    window.clearTimeout(stopTimer);
    stopTimer = undefined;
    source?.stop();
    source?.disconnect();
    source = undefined;
    scheduledVolume = 0;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime);
  }

  async function load() {
    loading = true;
    try {
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error(String(response.status));
      const decoded = await ctx.decodeAudioData(await response.arrayBuffer());
      if (!signal.aborted) {
        buffer = decoded;
        sync();
      }
    } catch (error) {
      if (!signal.aborted) {
        retryAfter = performance.now() + 30_000;
        console.warn("[TT农场] 环境声暂时无法加载", url, error);
      }
    } finally {
      loading = false;
    }
  }

  function sync() {
    if (signal.aborted || ctx.state !== "running" || document.hidden) return;
    if (target === 0) {
      if (source && stopTimer === undefined) {
        gain.gain.setTargetAtTime(0, ctx.currentTime, fade);
        scheduledVolume = 0;
        stopTimer = window.setTimeout(stop, fade * 6000);
      }
      return;
    }
    if (!buffer) {
      if (!loading && performance.now() >= retryAfter) void load();
      return;
    }
    if (stopTimer !== undefined) {
      window.clearTimeout(stopTimer);
      stopTimer = undefined;
    }
    if (!source) {
      source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain);
      source.start(0, ctx.currentTime % buffer.duration);
    }
    if (target !== scheduledVolume) {
      gain.gain.setTargetAtTime(target, ctx.currentTime, fade);
      scheduledVolume = target;
    }
  }

  return {
    setVolume(volume: number) {
      target = volume;
      sync();
    },
    stop,
  };
}

export function createRiverAudio() {
  const download = new AbortController();
  let context: AudioContext | undefined;
  let river: ReturnType<typeof createLoop> | undefined;
  let rain: ReturnType<typeof createLoop> | undefined;
  let tone: BiquadFilterNode;
  let pan: StereoPannerNode;
  let weather: WeatherKind = "sunny";
  let proximity = 0;
  let bearing = 0;
  let lastProximity = NaN;
  let lastBearing = NaN;
  let nextUpdate = 0;
  let air: AudioBufferSourceNode | undefined;
  let airGain: GainNode | undefined;
  let airFilter: BiquadFilterNode | undefined;

  // 同一段低频噪声随阵风起伏，也能生成闪电之后的滚雷。
  function mixAir() {
    if (!context) return;
    const active = getRainSoundEnabled() && (weather === "gale" || weather === "storm") && !document.hidden;
    if (!active) {
      if (air) { air.stop(); air.disconnect(); air = undefined; }
      return;
    }
    if (context.state !== "running") return;
    if (!airGain || !airFilter) {
      airGain = context.createGain();
      airGain.gain.value = 0;
      airFilter = context.createBiquadFilter();
      airFilter.type = "lowpass";
      airFilter.Q.value = .65;
      airFilter.connect(airGain).connect(context.destination);
    }
    if (!air) {
      const rate = 16000, length = rate*3;
      const buffer = context.createBuffer(1, length, rate);
      const samples = buffer.getChannelData(0);
      let brown = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random()*2-1;
        brown = (brown+.045*white)/1.045;
        samples[i] = (brown*2.1 + white*.08)*Math.min(1,i/300,(length-i)/300);
      }
      air = context.createBufferSource();
      air.buffer = buffer;
      air.loop = true;
      air.connect(airFilter);
      air.start();
    }
    const time = performance.now()*.001;
    const gust = .5+.5*Math.sin(time*1.17+Math.sin(time*.71));
    const delay = time % 13 - .65;
    const rumble = delay > 0 ? Math.min(1,delay*4)*Math.exp(-delay*.94) : 0;
    const storm = weather === "storm";
    airFilter.frequency.setTargetAtTime(storm ? 115 + rumble*160 : 380+gust*680, context.currentTime, .22);
    airGain.gain.setTargetAtTime(storm ? .15+rumble*1.42 : .24 + gust*.45, context.currentTime, .12);
  }

  function mix() {
    if (!context || document.hidden) return;
    if (proximity !== lastProximity) {
      tone.frequency.setTargetAtTime(1400 + proximity * 7600, context.currentTime, 0.16);
      lastProximity = proximity;
    }
    if (bearing !== lastBearing) {
      pan.pan.setTargetAtTime(bearing, context.currentTime, 0.12);
      lastBearing = bearing;
    }
    river?.setVolume(getRiverSoundEnabled() ? proximity * 0.78 : 0);
    rain?.setVolume(getRainSoundEnabled() && isRainy(weather) ? (weather === "storm" ? .91 : .72) : 0);
    mixAir();
  }

  function unlock() {
    if (download.signal.aborted || document.hidden || !window.AudioContext) return;
    if (!getRiverSoundEnabled() && !getRainSoundEnabled()) return;
    if (!context) {
      try {
        context = new AudioContext({ latencyHint: "playback" });
        tone = context.createBiquadFilter();
        tone.type = "lowpass";
        tone.Q.value = 0.7;
        pan = context.createStereoPanner();
        tone.connect(pan).connect(context.destination);
        river = createLoop(context, riverRecording, tone, download.signal, 0.12);
        rain = createLoop(context, rainRecording, context.destination, download.signal, 0.19);
        context.onstatechange = mix;
      } catch {
        if (context) void context.close().catch(() => {});
        context = undefined;
        return;
      }
    }
    if (context.state !== "running") void context.resume().catch(() => {});
    mix();
  }

  function onVisibility() {
    if (!context) return;
    if (document.hidden) {
      river?.stop();
      rain?.stop();
      mixAir();
      void context.suspend().catch(() => {});
    } else if (getRiverSoundEnabled() || getRainSoundEnabled()) {
      // A quick return can arrive before the preceding suspend() promise settles.
      void context.resume().then(mix).catch(() => {});
    }
  }

  function onSetting() {
    unlock();
    mix();
  }

  for (const event of gestures) window.addEventListener(event, unlock, true);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener(RIVER_SOUND_CHANGED, onSetting);
  window.addEventListener(RAIN_SOUND_CHANGED, onSetting);
  if (navigator.userActivation?.hasBeenActive) unlock();

  return {
    update(x: number, z: number, screenRightX: number, screenRightZ: number, currentWeather: WeatherKind) {
      const changed = weather !== currentWeather;
      weather = currentWeather;
      if (document.hidden || download.signal.aborted) return;
      const now = performance.now();
      if (now < nextUpdate && !changed) return;
      nextUpdate = now + 120;
      const point = riverInfo(x, z);
      const fromWater = Math.max(0, point.dist - RIVER_BED.waterLine);
      const near = Math.max(0, 1 - fromWater / AUDIBLE_DISTANCE);
      proximity = near * near * (3 - 2 * near);
      const side = -(point.nx * screenRightX + point.nz * screenRightZ);
      bearing = 0.62 * side * Math.min(1, point.dist / RIVER_BED.waterLine);
      mix();
    },
    dispose() {
      for (const event of gestures) window.removeEventListener(event, unlock, true);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(RIVER_SOUND_CHANGED, onSetting);
      window.removeEventListener(RAIN_SOUND_CHANGED, onSetting);
      download.abort();
      river?.stop();
      rain?.stop();
      river = rain = undefined;
      air?.stop(); air?.disconnect(); airFilter?.disconnect(); airGain?.disconnect();
      if (context) {
        context.onstatechange = null;
        void context.close().catch(() => {});
        context = undefined;
      }
    },
  };
}
