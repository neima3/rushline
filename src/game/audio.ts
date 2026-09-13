import type { Medal, Phase } from "./types";

export type EngineInput = {
  speed: number;
  throttle: number;
  boost: number;
  airborne: boolean;
  racing: boolean;
};

export type EngineMix = {
  rpm: number;
  fundHz: number;
  harmHz: number;
  subHz: number;
  load: number;
  gain: number;
  cutoff: number;
  noise: number;
  whine: number;
  whineHz: number;
};

export type ScrapeInput = {
  speed: number;
  slide: number;
  airborne: boolean;
  racing: boolean;
};

export type ScrapeMix = {
  gain: number;
  freq: number;
  cutoff: number;
};

const IDLE_RPM = 920;
const REDLINE_RPM = 9100;
const REF_SPEED = 40;
const MUSIC_SCALE = 0.3;
const MASTER_SCALE = 0.92;

export function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

export function muteFromSearch(search: string): boolean {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const raw = q.get("mute") ?? q.get("muted");
  if (raw == null) return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function masterLin(muted: boolean, master: number) {
  return muted ? 0 : clamp01(master) * MASTER_SCALE;
}

export function musicDuck(phase: Phase): number {
  if (phase === "race") return 0.13;
  if (phase === "countdown") return 0.22;
  if (phase === "paused") return 0.38;
  if (phase === "results") return 0.52;
  return 1;
}

export function engineMix(input: EngineInput): EngineMix {
  const speedAbs = Math.abs(input.speed);
  const drive = clamp01(speedAbs / REF_SPEED);
  const thr = clamp01(input.throttle);
  const boostAmt = clamp01(input.boost / 1.2);
  const air = input.airborne ? 1 : 0;

  let rpm =
    IDLE_RPM +
    drive * (REDLINE_RPM - IDLE_RPM) * 0.84 +
    thr * (1 - drive * 0.5) * 1680 +
    boostAmt * 980;
  if (air) rpm += 420 + thr * 260;
  rpm = Math.min(REDLINE_RPM + 700, Math.max(IDLE_RPM, rpm));

  const fundHz = rpm / 60;
  const load = clamp01(0.16 + thr * 0.58 + drive * 0.32 + boostAmt * 0.22);

  let gain = 0;
  if (input.racing) {
    gain = 0.016 + drive * 0.046 + thr * 0.058 + boostAmt * 0.038;
    if (air) gain *= 0.58;
    if (speedAbs < 0.8 && thr < 0.04) gain = 0.011;
    gain = Math.min(0.155, gain);
  }

  const cutoff = 480 + drive * 1480 + thr * 760 + boostAmt * 1680 - air * 240;
  const noise = input.racing ? 0.01 + drive * 0.028 + thr * 0.018 + boostAmt * 0.05 + air * 0.012 : 0;
  const whine = input.racing ? boostAmt * 0.042 + (rpm > 6400 ? ((rpm - 6400) / 9000) * 0.018 : 0) : 0;

  return {
    rpm,
    fundHz,
    harmHz: fundHz * 2.017,
    subHz: fundHz * 0.5,
    load,
    gain,
    cutoff: Math.max(280, cutoff),
    noise,
    whine,
    whineHz: 1400 + drive * 900 + boostAmt * 720,
  };
}

export function scrapeMix(input: ScrapeInput): ScrapeMix {
  const speedAbs = Math.abs(input.speed);
  const slide = clamp01(input.slide);
  const live = input.racing && !input.airborne && slide > 0.28 && speedAbs > 6;
  const gain = live ? (slide - 0.16) * 0.075 * clamp01(speedAbs / 26) : 0;
  return {
    gain: Math.min(0.085, Math.max(0, gain)),
    freq: 88 + speedAbs * 6.2 + slide * 120,
    cutoff: 460 + speedAbs * 24 + slide * 220,
  };
}

export function medalNotes(medal: Medal | null): number[] {
  if (medal === "author") return [523.25, 659.25, 783.99, 987.77, 1174.66, 1567.98];
  if (medal === "gold") return [523.25, 659.25, 783.99, 1046.5, 1318.51];
  if (medal === "silver") return [523.25, 659.25, 783.99, 1046.5];
  if (medal === "bronze") return [523.25, 659.25, 783.99];
  return [];
}

export function landGain(speedAbs: number) {
  return Math.min(0.16, 0.045 + clamp01(speedAbs / 36) * 0.1);
}

function makePinkBuffer(ctx: AudioContext, seconds = 1.4) {
  const rate = ctx.sampleRate;
  const n = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(1, n, rate);
  const data = buf.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.57 * b2 + white * 1.052691;
    data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.16;
  }
  return buf;
}

function makeDriveCurve(amount = 2.4) {
  const n = 256;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
  }
  return curve;
}

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  private engine: GainNode | null = null;
  private vols = { master: 0.8, sfx: 0.9, music: 0.42 };
  private duck = 1;
  private musicOsc: OscillatorNode[] = [];
  private osc: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private osc3: OscillatorNode | null = null;
  private whine: OscillatorNode | null = null;
  private whineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private noiseGain: GainNode | null = null;
  private scrape: OscillatorNode | null = null;
  private scrapeGain: GainNode | null = null;
  private scrapeFilter: BiquadFilterNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private noiseSrc: AudioBufferSourceNode | null = null;
  private scrapeNoise: AudioBufferSourceNode | null = null;
  muted = false;
  private unlocked = false;
  private scene: Phase = "menu";
  private lean = false;

  unlock = () => {
    if (this.unlocked && this.ctx?.state === "running") return;
    try {
      if (!this.ctx) this.buildBuses();
      if (this.ctx?.state === "suspended") void this.ctx.resume();
      this.unlocked = true;
      this.tickUnlock();
      if (!this.osc) {
        const build = () => {
          try {
            if (this.ctx && !this.osc) this.buildVoices();
          } catch {
            /* headless / no output device */
          }
        };
        if (typeof requestAnimationFrame === "function") requestAnimationFrame(build);
        else queueMicrotask(build);
      }
    } catch {
      this.unlocked = false;
    }
  };

  private buildBuses() {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC({ latencyHint: "interactive" });
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.sfx = ctx.createGain();
    this.music = ctx.createGain();
    this.engine = ctx.createGain();
    this.master.gain.value = masterLin(this.muted, this.vols.master);
    this.sfx.gain.value = this.vols.sfx;
    this.music.gain.value = this.vols.music * MUSIC_SCALE * this.duck;
    this.engine.gain.value = 0;
    this.sfx.connect(this.master);
    this.engine.connect(this.sfx);
    this.music.connect(this.master);
    this.master.connect(ctx.destination);
  }

  private buildVoices() {
    if (!this.ctx || !this.engine || !this.sfx || this.osc) return;
    const ctx = this.ctx;
    this.noiseBuf = makePinkBuffer(ctx);

    this.osc = ctx.createOscillator();
    this.osc.type = "sawtooth";
    this.osc.frequency.value = IDLE_RPM / 60;
    this.osc2 = ctx.createOscillator();
    this.osc2.type = "triangle";
    this.osc2.frequency.value = (IDLE_RPM / 60) * 2.017;
    this.osc3 = ctx.createOscillator();
    this.osc3.type = "sine";
    this.osc3.frequency.value = IDLE_RPM / 120;

    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = "lowpass";
    this.engineFilter.frequency.value = 720;
    this.engineFilter.Q.value = 0.85;

    const drive = ctx.createWaveShaper();
    drive.curve = makeDriveCurve(this.lean ? 1.4 : 2.6);
    drive.oversample = this.lean ? "none" : "2x";

    const oscGain = ctx.createGain();
    oscGain.gain.value = 0.15;
    const osc2Gain = ctx.createGain();
    osc2Gain.gain.value = 0.08;
    const osc3Gain = ctx.createGain();
    osc3Gain.gain.value = 0.11;
    this.osc.connect(oscGain);
    this.osc2.connect(osc2Gain);
    this.osc3.connect(osc3Gain);
    oscGain.connect(this.engineFilter);
    osc2Gain.connect(this.engineFilter);
    osc3Gain.connect(this.engineFilter);

    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0;
    const noiseBp = ctx.createBiquadFilter();
    noiseBp.type = "bandpass";
    noiseBp.frequency.value = 780;
    noiseBp.Q.value = 0.9;
    this.noiseSrc = ctx.createBufferSource();
    this.noiseSrc.buffer = this.noiseBuf;
    this.noiseSrc.loop = true;
    this.noiseSrc.connect(noiseBp);
    noiseBp.connect(this.noiseGain);
    this.noiseGain.connect(this.engineFilter);

    this.whine = ctx.createOscillator();
    this.whine.type = "sine";
    this.whine.frequency.value = 1600;
    this.whineGain = ctx.createGain();
    this.whineGain.gain.value = 0;
    this.whine.connect(this.whineGain);
    this.whineGain.connect(this.engineFilter);

    this.engineFilter.connect(drive);
    drive.connect(this.engine);

    this.osc.start();
    this.osc2.start();
    this.osc3.start();
    this.whine.start();
    this.noiseSrc.start();

    this.scrape = ctx.createOscillator();
    this.scrape.type = "sawtooth";
    this.scrape.frequency.value = 140;
    this.scrapeFilter = ctx.createBiquadFilter();
    this.scrapeFilter.type = "bandpass";
    this.scrapeFilter.frequency.value = 900;
    this.scrapeFilter.Q.value = 2.4;
    this.scrapeGain = ctx.createGain();
    this.scrapeGain.gain.value = 0;
    const scrapeOscGain = ctx.createGain();
    scrapeOscGain.gain.value = 0.35;
    this.scrape.connect(scrapeOscGain);
    scrapeOscGain.connect(this.scrapeFilter);
    this.scrapeNoise = ctx.createBufferSource();
    this.scrapeNoise.buffer = this.noiseBuf;
    this.scrapeNoise.loop = true;
    const scrapeNoiseGain = ctx.createGain();
    scrapeNoiseGain.gain.value = 0.7;
    this.scrapeNoise.connect(scrapeNoiseGain);
    scrapeNoiseGain.connect(this.scrapeFilter);
    this.scrapeFilter.connect(this.scrapeGain);
    this.scrapeGain.connect(this.sfx);
    this.scrape.start();
    this.scrapeNoise.start();

    this.startMusic();
  }

  private tickUnlock() {
    if (!this.ctx) return;
    const buf = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    src.start();
  }

  attach() {
    window.addEventListener("pointerdown", this.unlock);
    window.addEventListener("touchstart", this.unlock, { passive: true });
    window.addEventListener("keydown", this.unlock);
    window.addEventListener("gamepadconnected", this.unlock);
    document.addEventListener("visibilitychange", this.onVis);
    window.addEventListener("pagehide", this.onHide);
    window.addEventListener("pageshow", this.onShow);
    document.addEventListener("freeze", this.onHide);
    document.addEventListener("resume", this.onShow);
  }

  detach() {
    window.removeEventListener("pointerdown", this.unlock);
    window.removeEventListener("touchstart", this.unlock);
    window.removeEventListener("keydown", this.unlock);
    window.removeEventListener("gamepadconnected", this.unlock);
    document.removeEventListener("visibilitychange", this.onVis);
    window.removeEventListener("pagehide", this.onHide);
    window.removeEventListener("pageshow", this.onShow);
    document.removeEventListener("freeze", this.onHide);
    document.removeEventListener("resume", this.onShow);
  }

  private onVis = () => {
    if (document.visibilityState === "hidden") this.onHide();
    else this.onShow();
  };

  private onHide = () => {
    if (!this.ctx || !this.unlocked) return;
    if (this.ctx.state === "running") void this.ctx.suspend();
  };

  private onShow = () => {
    if (!this.ctx || !this.unlocked) return;
    if (document.visibilityState === "hidden") return;
    if (this.ctx.state === "suspended") void this.ctx.resume();
  };

  applyVolumes(master: number, sfx: number, music: number) {
    this.vols = { master, sfx, music };
    this.syncGains();
  }

  setQuality(quality: "low" | "medium" | "high") {
    this.lean = quality === "low";
  }

  setScene(phase: Phase) {
    if (this.scene === phase) return;
    this.scene = phase;
    this.duck = musicDuck(phase);
    this.syncGains();
  }

  private syncGains() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master?.gain.setTargetAtTime(masterLin(this.muted, this.vols.master), t, 0.03);
    this.sfx?.gain.setTargetAtTime(this.vols.sfx, t, 0.03);
    this.music?.gain.setTargetAtTime(this.vols.music * MUSIC_SCALE * this.duck, t, 0.08);
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.syncGains();
  }

  getState() {
    return {
      muted: this.muted,
      unlocked: this.unlocked,
      running: this.ctx?.state === "running",
      scene: this.scene,
      duck: this.duck,
    };
  }

  private startMusic() {
    if (!this.ctx || !this.music || this.musicOsc.length) return;
    const t = this.ctx.currentTime;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    filter.Q.value = 0.65;
    filter.connect(this.music);

    const voices: [number, OscillatorType, number][] = this.lean
      ? [
          [110, "sine", 0.15],
          [164.81, "triangle", 0.055],
        ]
      : [
          [110, "sine", 0.145],
          [164.81, "triangle", 0.062],
          [220, "sine", 0.04],
          [329.63, "sine", 0.018],
        ];
    for (const [freq, type, gain] of voices) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = gain;
      o.connect(g);
      g.connect(filter);
      o.start(t);
      this.musicOsc.push(o);
    }

    const lfo = this.ctx.createOscillator();
    const lfoG = this.ctx.createGain();
    lfo.frequency.value = 0.06;
    lfoG.gain.value = 70;
    lfo.connect(lfoG);
    lfoG.connect(filter.frequency);
    lfo.start(t);
    this.musicOsc.push(lfo);
  }

  setEngine(speed: number, throttle: number, boost: number, airborne: boolean, slide = 0, racing = true) {
    if (!this.ctx || !this.osc || !this.osc2 || !this.engine || !this.engineFilter) return;
    const t = this.ctx.currentTime;
    const mix = engineMix({ speed, throttle, boost, airborne, racing });
    this.osc.frequency.setTargetAtTime(mix.fundHz, t, 0.045);
    this.osc2.frequency.setTargetAtTime(mix.harmHz, t, 0.045);
    this.osc3?.frequency.setTargetAtTime(mix.subHz, t, 0.055);
    this.engineFilter.frequency.setTargetAtTime(mix.cutoff, t, 0.07);
    this.engineFilter.Q.setTargetAtTime(0.7 + mix.load * 0.55, t, 0.1);
    this.engine.gain.setTargetAtTime(this.muted ? 0 : mix.gain, t, 0.055);
    this.noiseGain?.gain.setTargetAtTime(this.muted ? 0 : mix.noise, t, 0.06);
    this.whine?.frequency.setTargetAtTime(mix.whineHz, t, 0.08);
    this.whineGain?.gain.setTargetAtTime(this.muted ? 0 : mix.whine, t, 0.06);
    if (this.scrape && this.scrapeGain && this.scrapeFilter) {
      const skid = scrapeMix({ speed, slide, airborne, racing });
      this.scrapeGain.gain.setTargetAtTime(this.muted ? 0 : skid.gain, t, 0.045);
      this.scrape.frequency.setTargetAtTime(skid.freq, t, 0.07);
      this.scrapeFilter.frequency.setTargetAtTime(skid.cutoff, t, 0.07);
    }
  }

  private live() {
    return Boolean(this.ctx && this.sfx && !this.muted);
  }

  blip(freq: number, dur = 0.09, type: OscillatorType = "sine", gain = 0.12, at = 0) {
    if (!this.ctx || !this.sfx || this.muted) return;
    const t = this.ctx.currentTime + at;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(Math.max(0.0001, gain), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.02);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }

  private noiseBurst(opts: {
    dur: number;
    gain: number;
    freq: number;
    type?: BiquadFilterType;
    q?: number;
    at?: number;
  }) {
    if (!this.ctx || !this.sfx || !this.noiseBuf || this.muted) return;
    const t = this.ctx.currentTime + (opts.at ?? 0);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = opts.type ?? "bandpass";
    f.frequency.value = opts.freq;
    f.Q.value = opts.q ?? 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(opts.gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    src.start(t);
    src.stop(t + opts.dur + 0.02);
    src.onended = () => {
      src.disconnect();
      f.disconnect();
      g.disconnect();
    };
  }

  click() {
    if (!this.live()) return;
    this.blip(1860, 0.035, "sine", 0.045);
    this.blip(920, 0.028, "triangle", 0.02);
  }

  checkpoint() {
    this.blip(880, 0.09, "triangle", 0.1);
    this.blip(1320, 0.13, "sine", 0.07, 0.04);
  }

  finish(medal: Medal | null = null) {
    this.blip(523.25, 0.14, "triangle", 0.1);
    this.blip(659.25, 0.14, "triangle", 0.1, 0.09);
    this.blip(783.99, 0.22, "triangle", 0.12, 0.18);
    const notes = medalNotes(medal);
    notes.forEach((freq, i) => {
      this.blip(freq, 0.2 + i * 0.02, i > 2 ? "sine" : "triangle", 0.07 - i * 0.006, 0.32 + i * 0.07);
    });
  }

  medal(kind: Medal | null) {
    this.finish(kind);
  }

  boost() {
    this.noiseBurst({ dur: 0.2, gain: 0.055, freq: 620, type: "highpass", q: 0.7 });
    this.blip(70, 0.12, "sine", 0.07);
    this.blip(180, 0.16, "sawtooth", 0.05);
    this.blip(420, 0.2, "triangle", 0.045, 0.03);
  }

  turbo() {
    this.noiseBurst({ dur: 0.16, gain: 0.04, freq: 1400, type: "highpass", q: 0.8 });
    this.blip(240, 0.12, "sawtooth", 0.065);
    this.blip(540, 0.18, "triangle", 0.055, 0.02);
    this.blip(880, 0.1, "sine", 0.035, 0.04);
  }

  land(speedAbs = 16) {
    const g = landGain(speedAbs);
    this.noiseBurst({ dur: 0.12, gain: g * 0.7, freq: 180, type: "lowpass", q: 0.6 });
    this.blip(58, 0.16, "sine", g);
    this.blip(110, 0.09, "sawtooth", g * 0.35);
  }

  crash(amount = 0.16) {
    const g = 0.04 + clamp01(amount / 0.2) * 0.05;
    this.noiseBurst({ dur: 0.16, gain: g, freq: 240, type: "bandpass", q: 0.8 });
    this.blip(90, 0.12, "square", g);
    this.blip(48, 0.18, "sawtooth", g * 0.8);
  }

  countdown(n: number) {
    if (n <= 0) {
      this.blip(720, 0.16, "triangle", 0.11);
      this.blip(1080, 0.12, "sine", 0.05, 0.02);
    } else {
      this.blip(420, 0.1, "sine", 0.08);
    }
  }

  dispose() {
    this.detach();
    try {
      this.osc?.stop();
      this.osc2?.stop();
      this.osc3?.stop();
      this.whine?.stop();
      this.scrape?.stop();
      this.noiseSrc?.stop();
      this.scrapeNoise?.stop();
      for (const o of this.musicOsc) o.stop();
      this.musicOsc = [];
      void this.ctx?.close();
    } catch {
      /* already closed */
    }
    this.ctx = null;
    this.unlocked = false;
  }
}
