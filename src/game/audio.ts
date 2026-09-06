export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private engine: GainNode | null = null;
  private osc: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private osc3: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private scrape: OscillatorNode | null = null;
  private scrapeGain: GainNode | null = null;
  private scrapeFilter: BiquadFilterNode | null = null;
  muted = false;
  private unlocked = false;

  unlock = () => {
    if (this.unlocked && this.ctx?.state === "running") return;
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.engine = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.72;
      this.sfx.gain.value = 0.9;
      this.engine.gain.value = 0;
      this.sfx.connect(this.master);
      this.engine.connect(this.master);
      this.master.connect(this.ctx.destination);

      this.osc = this.ctx.createOscillator();
      this.osc.type = "sawtooth";
      this.osc.frequency.value = 48;
      this.osc2 = this.ctx.createOscillator();
      this.osc2.type = "triangle";
      this.osc2.frequency.value = 96;
      this.osc3 = this.ctx.createOscillator();
      this.osc3.type = "square";
      this.osc3.frequency.value = 24;
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = "lowpass";
      this.engineFilter.frequency.value = 900;
      const oscGain = this.ctx.createGain();
      oscGain.gain.value = 0.16;
      const osc2Gain = this.ctx.createGain();
      osc2Gain.gain.value = 0.09;
      const osc3Gain = this.ctx.createGain();
      osc3Gain.gain.value = 0.04;
      this.osc.connect(oscGain);
      this.osc2.connect(osc2Gain);
      this.osc3.connect(osc3Gain);
      oscGain.connect(this.engineFilter);
      osc2Gain.connect(this.engineFilter);
      osc3Gain.connect(this.engineFilter);
      this.engineFilter.connect(this.engine);
      this.osc.start();
      this.osc2.start();
      this.osc3.start();

      this.scrape = this.ctx.createOscillator();
      this.scrape.type = "sawtooth";
      this.scrape.frequency.value = 140;
      this.scrapeFilter = this.ctx.createBiquadFilter();
      this.scrapeFilter.type = "bandpass";
      this.scrapeFilter.frequency.value = 900;
      this.scrapeFilter.Q.value = 2.2;
      this.scrapeGain = this.ctx.createGain();
      this.scrapeGain.gain.value = 0;
      this.scrape.connect(this.scrapeFilter);
      this.scrapeFilter.connect(this.scrapeGain);
      this.scrapeGain.connect(this.sfx);
      this.scrape.start();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    this.unlocked = true;
  };

  attach() {
    window.addEventListener("pointerdown", this.unlock);
    window.addEventListener("keydown", this.unlock);
    window.addEventListener("gamepadconnected", this.unlock);
    document.addEventListener("visibilitychange", this.onVis);
  }

  detach() {
    window.removeEventListener("pointerdown", this.unlock);
    window.removeEventListener("keydown", this.unlock);
    window.removeEventListener("gamepadconnected", this.unlock);
    document.removeEventListener("visibilitychange", this.onVis);
  }

  private onVis = () => {
    if (document.visibilityState === "visible") this.unlock();
  };

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.72, this.ctx.currentTime, 0.03);
    }
  }

  setEngine(speed: number, throttle: number, boost: number, airborne: boolean, slide = 0) {
    if (!this.ctx || !this.osc || !this.osc2 || !this.engine || !this.engineFilter) return;
    const t = this.ctx.currentTime;
    const abs = Math.abs(speed);
    const freq = 40 + abs * 7.6 + throttle * 20 + boost * 28;
    this.osc.frequency.setTargetAtTime(freq, t, 0.05);
    this.osc2.frequency.setTargetAtTime(freq * 2.03, t, 0.05);
    this.osc3?.frequency.setTargetAtTime(freq * 0.5, t, 0.06);
    this.engineFilter.frequency.setTargetAtTime(680 + abs * 32 + boost * 480, t, 0.08);
    const vol = this.muted ? 0 : 0.014 + abs * 0.0019 + throttle * 0.022 + (airborne ? 0.012 : 0);
    this.engine.gain.setTargetAtTime(Math.min(0.13, vol), t, 0.06);
    if (this.scrape && this.scrapeGain && this.scrapeFilter) {
      const skid = slide > 0.35 && abs > 8 && !airborne ? (slide - 0.2) * 0.045 : 0;
      this.scrapeGain.gain.setTargetAtTime(this.muted ? 0 : skid, t, 0.05);
      this.scrape.frequency.setTargetAtTime(120 + abs * 4 + slide * 80, t, 0.08);
      this.scrapeFilter.frequency.setTargetAtTime(700 + abs * 18, t, 0.08);
    }
  }

  blip(freq: number, dur = 0.09, type: OscillatorType = "sine", gain = 0.12) {
    if (!this.ctx || !this.sfx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
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

  checkpoint() {
    this.blip(880, 0.08, "triangle", 0.1);
    this.blip(1320, 0.12, "sine", 0.07);
  }

  finish() {
    this.blip(523, 0.14, "triangle", 0.1);
    window.setTimeout(() => this.blip(659, 0.14, "triangle", 0.1), 90);
    window.setTimeout(() => this.blip(784, 0.22, "triangle", 0.12), 180);
  }

  boost() {
    this.blip(180, 0.16, "sawtooth", 0.06);
    this.blip(420, 0.2, "triangle", 0.05);
  }

  turbo() {
    this.blip(240, 0.12, "sawtooth", 0.07);
    this.blip(540, 0.18, "triangle", 0.06);
    this.blip(880, 0.1, "sine", 0.04);
  }

  land() {
    this.blip(70, 0.14, "square", 0.07);
    this.blip(110, 0.1, "sawtooth", 0.04);
  }

  crash() {
    this.blip(90, 0.12, "square", 0.06);
    this.blip(48, 0.18, "sawtooth", 0.05);
  }

  countdown(n: number) {
    if (n <= 0) this.blip(720, 0.16, "triangle", 0.11);
    else this.blip(420, 0.1, "sine", 0.08);
  }

  dispose() {
    this.detach();
    try {
      this.osc?.stop();
      this.osc2?.stop();
      this.osc3?.stop();
      this.scrape?.stop();
      void this.ctx?.close();
    } catch {
      /* already closed */
    }
    this.ctx = null;
  }
}
