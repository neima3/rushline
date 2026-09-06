import type { BuiltTrack, CameraMode, CarSnap, GhostFrame, Phase, TrackId } from "./types";
import { getTrack, medalFor } from "./track";
import { CarSim, FIXED_DT, MAX_PHYS_STEPS, lerpSnap } from "./physics";
import { World } from "./scene";
import { Input } from "./input";
import { GameAudio } from "./audio";
import { readSave, TRACK_ORDER, useGame, writeSave } from "./store";

type Probe = {
  getYaw: () => number;
  getSpeed: () => number;
  setSteer?: (v: number) => void;
  setKeys?: (codes: string[]) => void;
};

declare global {
  interface Window {
    __controlsTest?: Probe;
    __rushline?: Game;
  }
}

export class Game {
  private world: World;
  private input = new Input();
  private audio = new GameAudio();
  private car = new CarSim();
  private prev: CarSnap;
  private curr: CarSnap;
  private track: BuiltTrack;
  private trackId: TrackId = "circuit";
  private running = true;
  private lastT = 0;
  private acc = 0;
  private hudAcc = 0;
  private time = 0;
  private timeHold = 0;
  private raceClockAt = 0;
  private countdown = -1;
  private countdownAt = 0;
  private pausedFrom: Phase | null = null;
  private phase: Phase = "menu";
  private camera: CameraMode = "chase";
  private attractS = 0;
  private recording: GhostFrame[] = [];
  private ghost: GhostFrame[] | null = null;
  private reduced = false;
  private injectSteer: number | null = null;
  private canvas: HTMLCanvasElement;
  private ro: ResizeObserver;
  private raf = 0;
  private menuYPrev = 0;
  private padAcc = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.world = new World(canvas);
    this.track = getTrack("circuit");
    this.world.loadTrack(this.track, this.track.def.env);
    this.car.reset(this.track);
    this.curr = this.car.snap();
    this.prev = this.car.snap();
    this.canvas.tabIndex = 0;
    this.canvas.style.outline = "none";
    this.input.attach(this.canvas);
    this.audio.attach();
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.ghost = readSave().ghosts.circuit ?? null;

    this.ro = new ResizeObserver(() => this.fit());
    this.ro.observe(canvas.parentElement || canvas);
    this.fit();

    window.__controlsTest = {
      getYaw: () => this.car.yaw,
      getSpeed: () => this.car.speed,
      setKeys: (codes) => this.input.setKeys(codes),
      setSteer: (v) => {
        this.injectSteer = v;
      },
    };
    window.__rushline = this;

    this.lastT = performance.now();
    this.raf = requestAnimationFrame(this.loop);
    useGame.getState().setReady(true);
    useGame.getState().refreshBest();
  }

  private fit() {
    const parent = this.canvas.parentElement || this.canvas;
    const r = parent.getBoundingClientRect();
    this.world.resize(Math.max(1, r.width), Math.max(1, r.height));
  }

  setPhase(phase: Phase) {
    this.phase = phase;
    useGame.getState().setPhase(phase);
  }

  setCamera(mode: CameraMode) {
    this.camera = mode;
    useGame.getState().setCamera(mode);
    this.world.snapCamera(this.curr, mode);
  }

  setMuted(m: boolean) {
    this.audio.setMuted(m);
    useGame.getState().setMuted(m);
  }

  setAutoThrottle(v: boolean) {
    this.input.autoThrottle = v;
    useGame.getState().setAutoThrottle(v);
  }

  setTouch(v: boolean) {
    useGame.getState().setTouch(v);
    if (v && !useGame.getState().autoThrottle) {
      this.setAutoThrottle(true);
    }
  }

  load(id: TrackId) {
    this.trackId = id;
    this.track = getTrack(id);
    this.world.loadTrack(this.track, this.track.def.env);
    this.ghost = readSave().ghosts[id] ?? null;
    this.car.reset(this.track);
    this.curr = this.car.snap();
    this.prev = this.car.snap();
    this.attractS = 0;
    this.acc = 0;
    this.world.snapCamera(this.curr, this.camera);
    useGame.getState().setTrack(id);
    useGame.getState().setHud({
      laps: this.track.def.laps,
      cpTotal: this.track.checkpoints.length,
      lap: 1,
      cp: 0,
      time: 0,
    });
  }

  startRace(id?: TrackId) {
    if (id) this.load(id);
    else this.load(this.trackId);
    this.car.reset(this.track);
    this.curr = this.car.snap();
    this.prev = this.car.snap();
    this.time = 0;
    this.timeHold = 0;
    this.raceClockAt = 0;
    this.acc = 0;
    this.countdown = 2.4;
    this.countdownAt = performance.now();
    this.pausedFrom = null;
    this.recording = [];
    this.phase = "countdown";
    this.lastT = this.countdownAt;
    this.world.snapCamera(this.curr, this.camera);
    useGame.getState().setPhase("countdown");
    useGame.getState().setResults(null);
    useGame.getState().setHud({
      time: 0,
      countdown: 3,
      lap: 1,
      laps: this.track.def.laps,
      cp: 0,
      cpTotal: this.track.checkpoints.length,
      medal: null,
      wrongWay: false,
    });
    this.audio.unlock();
    this.audio.countdown(3);
    this.capturePlayFocus();
    requestAnimationFrame(() => this.capturePlayFocus());
  }

  pause() {
    if (this.phase !== "race" && this.phase !== "countdown") return;
    this.pausedFrom = this.phase;
    if (this.phase === "race") this.timeHold = this.time;
    if (this.phase === "countdown") this.countdown = Math.max(0, 2.4 - (performance.now() - this.countdownAt) / 1000);
    this.phase = "paused";
    useGame.getState().setPhase("paused");
  }

  resume() {
    if (this.phase !== "paused") return;
    const next = this.pausedFrom === "countdown" && this.countdown > 0 ? "countdown" : "race";
    this.pausedFrom = null;
    this.phase = next;
    this.lastT = performance.now();
    if (next === "race") this.raceClockAt = this.lastT;
    if (next === "countdown") this.countdownAt = this.lastT - (2.4 - this.countdown) * 1000;
    useGame.getState().setPhase(next);
    this.capturePlayFocus();
  }

  menu() {
    this.phase = "menu";
    this.countdown = -1;
    this.acc = 0;
    this.car.reset(this.track);
    this.curr = this.car.snap();
    this.prev = this.car.snap();
    this.world.snapCamera(this.curr, this.camera);
    useGame.getState().setPhase("menu");
    useGame.getState().setHud({ countdown: null });
  }

  private loop = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const rawDt = (now - this.lastT) / 1000;
    this.lastT = now;
    if (rawDt <= 0) return;
    const dt = Math.min(rawDt, 0.1);

    const store = useGame.getState();
    this.input.autoThrottle = store.autoThrottle;
    this.camera = store.camera;
    if (store.muted !== this.audio.muted) this.audio.setMuted(store.muted);

    const actions = this.input.sample();
    if (this.injectSteer != null) actions.steer = this.injectSteer;

    this.padAcc += dt;
    if (this.padAcc > 0.2) {
      this.padAcc = 0;
      const p = this.input.pad;
      const cur = store.pad;
      if (p.connected !== cur.connected || p.active !== cur.active || p.id !== cur.id) {
        useGame.getState().setPad(p);
      }
    }

    this.handleMenuPad(actions);

    if (actions.pause && (this.phase === "race" || this.phase === "countdown")) this.pause();
    else if (actions.pause && this.phase === "paused") this.resume();
    if (actions.camera) this.setCamera(this.camera === "chase" ? "hood" : "chase");
    if (actions.restart && (this.phase === "race" || this.phase === "paused" || this.phase === "results")) {
      this.startRace(this.trackId);
    }
    if (actions.respawn && this.phase === "race") this.applyRespawn();

    const simulate = this.phase === "race" || this.phase === "countdown";
    if (this.phase === "countdown") {
      const prevC = Math.ceil(this.countdown);
      this.countdown = 2.4 - (now - this.countdownAt) / 1000;
      const nextC = Math.ceil(this.countdown);
      if (nextC < prevC && nextC >= 0) this.audio.countdown(nextC);
      if (this.countdown <= 0) {
        this.phase = "race";
        this.time = 0;
        this.timeHold = 0;
        this.raceClockAt = now;
        useGame.getState().setPhase("race");
        useGame.getState().setHud({ countdown: 0 });
      } else {
        useGame.getState().setHud({ countdown: Math.max(1, nextC) });
      }
    }

    if (simulate) {
      this.acc = Math.min(this.acc + dt, MAX_PHYS_STEPS * FIXED_DT);
      let steps = 0;
      while (this.acc >= FIXED_DT && steps < MAX_PHYS_STEPS) {
        this.prev = this.car.snap();
        this.car.step(this.track, actions, FIXED_DT);
        if (this.car.justBoost) {
          this.audio.boost();
          this.world.addTrauma(0.2);
          this.input.rumble("boost");
        }
        if (this.car.justTurbo) {
          this.audio.turbo();
          this.world.addTrauma(0.16);
          this.input.rumble("turbo");
        }
        if (this.car.justLand) {
          this.audio.land();
          this.world.addTrauma(0.12);
          this.input.rumble("land");
        }
        if (this.car.justCp || this.car.justLap) {
          this.audio.checkpoint();
          this.world.addTrauma(0.12);
        }
        if (this.car.wallHit > 0.15) {
          this.audio.crash();
          this.input.rumble("crash");
        }
        if (this.car.justFinish) this.onFinish();
        if (this.car.justRespawn) this.afterSimRespawn();
        this.acc -= FIXED_DT;
        steps++;
      }
      if (this.car.justRespawn) this.acc = 0;
      this.curr = this.car.snap();
      if (this.car.skipInterp || this.car.justRespawn || Math.abs(this.curr.s - this.prev.s) > 40) {
        this.prev = this.curr;
        this.car.skipInterp = false;
      }
      if (this.phase === "race") {
        this.time = this.timeHold + (now - this.raceClockAt);
        if (this.recording.length === 0 || this.time - this.recording[this.recording.length - 1]!.t > 40) {
          this.recording.push({ t: this.time, s: this.car.s, n: this.car.n, heading: this.car.heading });
        }
      }
    } else if (this.phase === "menu" || this.phase === "select") {
      this.attractS += dt * 22;
      if (this.attractS > this.track.length) this.attractS -= this.track.length;
    }

    const alpha = Math.max(0, Math.min(1, this.acc / FIXED_DT));
    const vis = lerpSnap(this.prev, this.curr, alpha);
    this.world.applyCar(vis, dt, actions.steer, actions.brake);
    this.world.applyGhost(this.track, this.ghost, this.time);
    this.world.stepParticles(dt);
    const attract = this.phase === "menu" || this.phase === "select";
    this.world.updateCamera(vis, dt, this.camera, attract, this.attractS, this.track, this.reduced);
    this.audio.setEngine(vis.speed, actions.throttle, vis.boost, vis.airborne, vis.slide);
    this.world.render();

    this.hudAcc += dt;
    if (this.hudAcc > 0.08) {
      this.hudAcc = 0;
      const medal = this.phase === "race" ? medalFor(this.trackId, this.time) : null;
      useGame.getState().setHud({
        time: this.time,
        speed: vis.speed,
        cp: Math.max(0, this.car.lastCp + 1),
        cpTotal: this.track.checkpoints.length,
        lap: this.car.lap,
        laps: this.track.def.laps,
        boost: vis.boost,
        medal,
        wrongWay: this.car.wrongWay > 0.45,
        countdown: this.phase === "countdown" ? Math.max(1, Math.ceil(this.countdown)) : this.time < 450 ? 0 : null,
        splittime: null,
        driftCharge: vis.driftCharge,
      });
    }
  };

  private onFinish() {
    const time = this.time;
    const medal = medalFor(this.trackId, time);
    const prev = readSave().best[this.trackId] ?? null;
    const isPb = prev == null || time < prev;
    if (isPb) {
      writeSave((s) => {
        s.best[this.trackId] = time;
        s.ghosts[this.trackId] = this.recording.slice();
      });
      this.ghost = this.recording.slice();
      useGame.getState().refreshBest();
    }
    this.audio.finish();
    this.world.addTrauma(0.4);
    this.input.rumble("finish");
    this.phase = "results";
    useGame.getState().setPhase("results");
    useGame.getState().setResults({
      time,
      best: isPb ? time : prev,
      medal,
      isPb,
      trackId: this.trackId,
    });
  }

  setTouchSteer(v: number) {
    this.input.touchSteer = v;
  }

  setTouchThrottle(v: number) {
    this.input.touchThrottle = v;
  }

  setTouchBrake(v: number) {
    this.input.touchBrake = v;
  }

  setTouchSlide(v: number) {
    this.input.touchSlide = v;
  }

  private handleMenuPad(actions: { confirm: boolean; back: boolean; menuY: number }) {
    const y = Math.abs(actions.menuY) > 0.5 ? Math.sign(actions.menuY) : 0;
    const yEdge = y !== 0 && y !== this.menuYPrev;
    this.menuYPrev = y;

    if (this.phase === "menu") {
      if (actions.confirm) this.startRace(this.trackId);
      return;
    }
    if (this.phase === "select") {
      if (actions.back) this.menu();
      if (actions.confirm) this.startRace(this.trackId);
      if (yEdge) {
        const i = TRACK_ORDER.indexOf(this.trackId);
        const next = TRACK_ORDER[(i + y + TRACK_ORDER.length) % TRACK_ORDER.length]!;
        this.load(next);
      }
      return;
    }
    if (this.phase === "paused") {
      if (actions.confirm) this.resume();
      else if (actions.back) this.menu();
      return;
    }
    if (this.phase === "results") {
      if (actions.confirm) this.startRace(this.trackId);
      else if (actions.back) this.menu();
    }
  }

  respawn() {
    if (this.phase === "race" || this.phase === "countdown") this.applyRespawn();
  }

  private applyRespawn() {
    this.car.respawn(this.track);
    this.afterSimRespawn();
  }

  private afterSimRespawn() {
    this.curr = this.car.snap();
    this.prev = this.curr;
    this.acc = 0;
    this.world.snapCamera(this.curr, this.camera);
  }

  capturePlayFocus() {
    const el = this.canvas;
    if (!el) return;
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.input.detach();
    this.audio.dispose();
    this.world.dispose();
    if (window.__rushline === this) delete window.__rushline;
    if (window.__controlsTest) delete window.__controlsTest;
  }
}
