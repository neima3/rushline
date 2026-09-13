import { nextLivery } from "./livery";
import {
  isLobbyPhase,
  type BuiltTrack,
  type CameraMode,
  type CarSnap,
  type GhostFrame,
  type GhostPref,
  type Phase,
  type TrackId,
} from "./types";
import { getTrack, medalFor, medalPace, sampleAt } from "./track";
import {
  cpFlashHoldMs,
  cpFlashLabel,
  ghostDeltaSmooth,
  ghostLead,
  ghostRaceSplitMs,
  ghostSplitMs,
  ghostTimeAtS,
} from "./feel";
import { pickRaceGhost, sampleGhost, shouldRecord } from "./ghost";
import { padConnectCopy } from "./gamepad";
import { applyTouchDrive, autoThrottleCap, clampTouchSpeed } from "./auto-throttle";
import { COUNTDOWN_S, countdownPausedAt, countdownRemaining, wallClockMs } from "./clock";
import { CarSim, FIXED_DT, MAX_PHYS_STEPS, lerpSnap } from "./physics";
import { World } from "./scene";
import { Input } from "./input";
import { GameAudio, muteFromSearch } from "./audio";
import { buildResults } from "./flow";
import {
  defaultPhotoOrbit,
  downloadBlob,
  ghostScrubSpan,
  ghostScrubTime,
  nudgePhotoOrbit,
  PHOTO_PITCH_RATE,
  PHOTO_YAW_RATE,
  PHOTO_ZOOM_RATE,
  stillFilename,
  type PhotoOrbit,
} from "./photo";
import {
  applyCupCommit,
  applyRunCommit,
  readCupProgress,
  readLastSave,
  readSave,
  TRACK_ORDER,
  useGame,
} from "./store";
import {
  allCupEvents,
  continueEvent,
  CUP_EVENTS,
  getCupEvent,
  isEventUnlocked,
} from "./cup";
import type { Settings } from "./settings";
import { type GraphicsKnobs, type QualityTier } from "./quality";

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
  private ghostSource: "pb" | "last" | "none" = "none";
  private ghostPref: GhostPref = "auto";
  private ghostSmooth: number | null = null;
  private cpFlash: { kind: "cp" | "lap" | "finish"; delta: number | null; label: string } | null = null;
  private cpFlashUntil = 0;
  private reduced = false;
  private injectSteer: number | null = null;
  private canvas: HTMLCanvasElement;
  private ro: ResizeObserver;
  private raf = 0;
  private menuYPrev = 0;
  private padAcc = 0;
  private camSnapAfterSim = false;
  private unsubSettings: (() => void) | null = null;
  private frames = 0;
  private fpsAt = 0;
  private tabHidden = false;
  private photoMode = false;
  private photoFrom: Phase | null = null;
  private photoOrbit: PhotoOrbit = defaultPhotoOrbit();
  private photoScrub = 1;
  private photoFollowGhost = false;

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
    this.input.onPauseHotkey = () => {
      if (useGame.getState().settingsOpen) {
        useGame.getState().setSettingsOpen(false);
        return;
      }
      if (this.phase === "race" || this.phase === "countdown") this.pause();
      else if (this.phase === "paused") this.resume();
    };
    this.input.onCameraHotkey = () => {
      if (this.photoMode) {
        this.photoOrbit = defaultPhotoOrbit();
        return;
      }
      if (isLobbyPhase(this.phase)) return;
      this.setCamera(this.camera === "chase" ? "hood" : "chase");
    };
    this.input.onPhotoHotkey = () => {
      if (useGame.getState().settingsOpen) return;
      this.togglePhoto();
    };
    this.audio.attach();
    if (muteFromSearch(window.location.search)) this.setMuted(true);
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.bindPad();
    this.applyGhostChoice("circuit");

    this.ro = new ResizeObserver(() => this.fit());
    this.ro.observe(canvas.parentElement || canvas);
    window.visualViewport?.addEventListener("resize", this.onViewport);
    window.addEventListener("orientationchange", this.onViewport);
    document.addEventListener("visibilitychange", this.onVis);
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

    this.syncSettings(useGame.getState().settings);
    this.unsubSettings = useGame.subscribe((s, prev) => {
      if (s.settings !== prev.settings) this.syncSettings(s.settings);
    });

    this.lastT = performance.now();
    this.fpsAt = this.lastT;
    this.raf = requestAnimationFrame(this.loop);
    useGame.getState().setReady(true);
    useGame.getState().refreshBest();
    useGame.getState().refreshCup();
  }

  private syncSettings(s: Settings) {
    this.world.applySettings(s);
    this.world.setLivery(s.livery);
    this.audio.setQuality(s.quality);
    this.audio.applyVolumes(s.master, s.sfx, s.music);
    this.input.touchSteerSensitivity = s.touchSteerSensitivity;
    this.input.invertSteer = s.invertSteer;
    this.input.autoThrottle = s.autoThrottle;
    this.car.trackAssist = s.trackAssist;
  }

  private bindPad() {
    this.input.onPadChange = (info, reason) => {
      useGame.getState().setPad(info);
      if (reason === "connect") useGame.getState().setPadBanner(padConnectCopy(info));
      if (reason === "disconnect") useGame.getState().setPadBanner("Controller disconnected");
    };
    this.input.refreshPad("poll");
    useGame.getState().setPad(this.input.pad);
  }

  private applyGhostChoice(id: TrackId) {
    const picked = pickRaceGhost(readSave().ghosts[id], readLastSave().runs[id]?.frames, this.ghostPref);
    this.ghost = picked.frames;
    this.ghostSource = picked.source;
    this.ghostPref = "auto";
  }

  private fit() {
    const parent = this.canvas.parentElement || this.canvas;
    const r = parent.getBoundingClientRect();
    let w = Math.max(1, r.width);
    let h = Math.max(1, r.height);
    const vv = window.visualViewport;
    if (vv && vv.width > 0 && vv.height > 0) {
      w = Math.max(1, Math.min(w, vv.width));
      h = Math.max(1, Math.min(h, vv.height));
    }
    this.world.resize(w, h);
  }

  private onViewport = () => this.fit();

  private onVis = () => {
    if (document.hidden) {
      this.tabHidden = true;
      if (this.phase === "race") this.timeHold = this.time;
      if (this.phase === "countdown") {
        this.countdown = Math.max(0, countdownRemaining(this.countdownAt, performance.now(), COUNTDOWN_S));
      }
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      return;
    }
    this.tabHidden = false;
    const now = performance.now();
    this.lastT = now;
    this.fpsAt = now;
    if (this.phase === "race") this.raceClockAt = now;
    if (this.phase === "countdown") {
      this.countdownAt = countdownPausedAt(now, this.countdown, COUNTDOWN_S);
    }
    if (this.running && this.raf === 0) this.raf = requestAnimationFrame(this.loop);
  };

  setPhase(phase: Phase) {
    this.phase = phase;
    this.audio.setScene(phase);
    useGame.getState().setPhase(phase);
  }

  get cam() {
    return this.camera;
  }

  get paused() {
    return this.phase === "paused";
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

  uiClick() {
    this.audio.unlock();
    this.audio.click();
  }

  getAudioState() {
    return this.audio.getState();
  }

  applySettings(s: Settings | GraphicsKnobs) {
    this.world.applySettings(s);
    useGame.getState().setQuality(s.quality);
  }

  getGraphics() {
    return this.world.getGraphics();
  }

  setShadows(on: boolean) {
    this.world.setShadows(on);
  }

  setBloom(on: boolean) {
    this.world.setBloom(on);
  }

  setFogEnabled(on: boolean) {
    this.world.setFogEnabled(on);
  }

  setFogDensity(nearMul: number, farMul?: number) {
    this.world.setFogDensity(nearMul, farMul);
  }

  setPixelRatioCap(cap: number) {
    this.world.setPixelRatioCap(cap);
  }

  setQuality(tier: QualityTier) {
    useGame.getState().setQuality(tier);
    this.world.setQuality(tier);
  }

  setAutoThrottle(v: boolean) {
    this.input.autoThrottle = v;
    useGame.getState().setAutoThrottle(v);
  }

  setTouch(v: boolean) {
    this.input.touchMode = v;
    useGame.getState().setTouch(v);
  }

  capturePlayFocus() {
    // Focusing the canvas on iOS Safari cancels the active pointer
    // (pointercancel / touchcancel) and drops TouchPad Accel / Brake.
    if (this.input.touchMode) return;
    const el = this.canvas;
    if (!el) return;
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
  }

  load(id: TrackId) {
    this.trackId = id;
    this.track = getTrack(id);
    this.world.loadTrack(this.track, this.track.def.env);
    this.applyGhostChoice(id);
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

  beginTrial(id?: TrackId, pref: GhostPref = "auto") {
    useGame.getState().setCupSession(null);
    this.startRace(id, pref);
  }

  beginCup(eventId: string) {
    const event = getCupEvent(eventId);
    if (!event) return;
    const progress = readCupProgress();
    if (!isEventUnlocked(progress, event)) return;
    useGame.getState().setCupSession(event.id);
    useGame.getState().setCupFocus(event.id);
    this.startRace(event.trackId);
  }

  openCup() {
    this.clearPhoto();
    const progress = readCupProgress();
    const focus = getCupEvent(useGame.getState().cupFocusId);
    const next = continueEvent(progress) ?? focus ?? CUP_EVENTS.gold[0]!;
    useGame.getState().refreshCup();
    useGame.getState().setCupFocus(next.id);
    this.load(next.trackId);
    this.phase = "cup";
    this.audio.setScene("cup");
    this.countdown = -1;
    this.acc = 0;
    this.car.reset(this.track);
    this.curr = this.car.snap();
    this.prev = this.car.snap();
    this.world.snapCamera(this.curr, this.camera);
    useGame.getState().setPhase("cup");
    useGame.getState().setHud({ countdown: null });
  }

  startRace(id?: TrackId, pref: GhostPref = "auto") {
    this.clearPhoto();
    this.ghostPref = pref;
    if (id) this.load(id);
    else this.load(this.trackId);
    this.car.reset(this.track);
    this.curr = this.car.snap();
    this.prev = this.car.snap();
    this.time = 0;
    this.timeHold = 0;
    this.raceClockAt = 0;
    this.acc = 0;
    this.countdown = COUNTDOWN_S;
    this.countdownAt = performance.now();
    this.pausedFrom = null;
    this.recording = [];
    this.ghostSmooth = null;
    this.cpFlash = null;
    this.cpFlashUntil = 0;
    this.phase = "countdown";
    this.lastT = this.countdownAt;
    this.world.snapCamera(this.curr, this.camera);
    useGame.getState().setPhase("countdown");
    useGame.getState().setResults(null);
    const gridPace = medalPace(this.trackId, 0);
    useGame.getState().setHud({
      time: 0,
      countdown: 3,
      lap: 1,
      laps: this.track.def.laps,
      cp: 0,
      cpTotal: this.track.checkpoints.length,
      medal: gridPace.holding,
      medalRemain: gridPace.remain,
      ghostDelta: null,
      ghostS: null,
      ghostN: null,
      ghostLead: null,
      cpFlash: null,
      wrongWay: false,
    });
    this.audio.unlock();
    this.audio.setScene("countdown");
    this.audio.countdown(3);
    this.capturePlayFocus();
    requestAnimationFrame(() => this.capturePlayFocus());
  }

  pause() {
    if (this.phase !== "race" && this.phase !== "countdown") return;
    this.pausedFrom = this.phase;
    if (this.phase === "race") this.timeHold = this.time;
    if (this.phase === "countdown") {
      this.countdown = Math.max(0, countdownRemaining(this.countdownAt, performance.now()));
    }
    this.phase = "paused";
    this.audio.setScene("paused");
    useGame.getState().setPhase("paused");
  }

  resume() {
    if (this.phase !== "paused") return;
    const next = this.pausedFrom === "countdown" && this.countdown > 0 ? "countdown" : "race";
    this.pausedFrom = null;
    this.phase = next;
    this.audio.setScene(next);
    this.lastT = performance.now();
    if (next === "race") this.raceClockAt = this.lastT;
    if (next === "countdown") this.countdownAt = countdownPausedAt(this.lastT, this.countdown);
    useGame.getState().setPhase(next);
    this.capturePlayFocus();
  }

  menu() {
    this.clearPhoto();
    this.phase = "menu";
    this.audio.setScene("menu");
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
    if (this.tabHidden || document.hidden) {
      this.raf = 0;
      return;
    }
    this.raf = requestAnimationFrame(this.loop);
    const rawDt = (now - this.lastT) / 1000;
    this.lastT = now;
    const dt = rawDt > 0 ? Math.min(rawDt, 0.1) : 0;

    const store = useGame.getState();
    this.input.autoThrottle = store.autoThrottle;
    this.camera = store.camera;
    if (store.muted !== this.audio.muted) this.audio.setMuted(store.muted);

    const actions = this.input.sample();
    if (this.injectSteer != null) actions.steer = this.injectSteer;
    // Same resolveRaceDrive path the tests use: sample() already ran
    // resolveSampleDrive (Brake exclusive). applyTouchDrive is the loop gate.
    const drive = applyTouchDrive({
      throttle: actions.throttle,
      brake: actions.brake,
      touchBrake: this.input.touchBrake,
      autoThrottle: this.input.autoThrottle,
      manualThrottle: this.input.manualThrottle,
      cap: autoThrottleCap({
        trackId: this.trackId,
        s: this.car.s,
        speed: this.car.speed,
        firstCp: this.track.checkpoints[0] ?? 80,
        touchMode: this.input.touchMode,
        countdown: this.phase === "countdown",
      }),
    });
    actions.throttle = drive.throttle;
    actions.brake = drive.brake;

    this.padAcc += dt;
    if (this.padAcc > 0.2) {
      this.padAcc = 0;
      const p = this.input.pad;
      const cur = store.pad;
      if (p.connected !== cur.connected || p.active !== cur.active || p.id !== cur.id) {
        useGame.getState().setPad(p);
      }
    }

    if (store.settingsOpen) {
      if (actions.back || actions.confirm || actions.pause) useGame.getState().setSettingsOpen(false);
    } else if (this.photoMode) {
      this.handlePhotoPad(actions, dt);
    } else {
      this.handleMenuPad(actions);
      if (actions.photo) this.togglePhoto();
      if (actions.pause && (this.phase === "race" || this.phase === "countdown")) this.pause();
      else if (actions.pause && this.phase === "paused") this.resume();
      if (actions.camera) this.setCamera(this.camera === "chase" ? "hood" : "chase");
      if (actions.restart && (this.phase === "race" || this.phase === "paused" || this.phase === "results")) {
        this.startRace(this.trackId);
      }
      if (actions.respawn && (this.phase === "race" || this.phase === "countdown")) this.applyRespawn();
    }

    const simulate = !this.photoMode && (this.phase === "race" || this.phase === "countdown");
    if (!this.photoMode && this.phase === "countdown") {
      const prevC = Math.ceil(this.countdown);
      this.countdown = countdownRemaining(this.countdownAt, now);
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
        this.car.speed = clampTouchSpeed(this.car.speed, this.input.touchMode);
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
          this.audio.land(Math.abs(this.car.speed));
          this.world.addTrauma(0.12);
          this.input.rumble("land");
        }
        if (this.car.justCp || this.car.justLap) {
          this.audio.checkpoint();
          this.world.addTrauma(0.12);
          this.world.flashTiming(this.car.snap(), this.car.justLap ? "lap" : "cp");
          this.armCpFlash(this.car.justLap ? "lap" : "cp", now);
        }
        if (this.car.wallHit > 0.15) {
          this.audio.crash(this.car.wallHit);
          this.input.rumble("crash");
        }
        if (this.car.justFinish) {
          this.armCpFlash("finish", now);
          this.world.flashTiming(this.car.snap(), "finish");
          this.onFinish();
        }
        if (this.car.justRespawn) {
          this.camSnapAfterSim = true;
          this.afterSimRespawn();
        }
        this.acc -= FIXED_DT;
        steps++;
      }
      if (this.car.justRespawn || this.camSnapAfterSim) {
        this.acc = 0;
        this.afterSimRespawn();
        this.camSnapAfterSim = false;
      }
      this.curr = this.car.snap();
      if (this.car.skipInterp || this.car.justRespawn || Math.abs(this.curr.s - this.prev.s) > 40) {
        this.prev = this.curr;
        this.car.skipInterp = false;
      }
      if (this.phase === "race") {
        this.time = wallClockMs(this.timeHold, this.raceClockAt, now);
        const frame = { t: this.time, s: this.car.s, n: this.car.n, heading: this.car.heading };
        if (shouldRecord(this.recording[this.recording.length - 1], frame)) this.recording.push(frame);
      }
    } else if (isLobbyPhase(this.phase)) {
      this.attractS += dt * 22;
      if (this.attractS > this.track.length) this.attractS -= this.track.length;
    }

    const alpha = Math.max(0, Math.min(1, this.acc / FIXED_DT));
    const vis = lerpSnap(this.prev, this.curr, alpha);
    this.world.applyCar(vis, this.photoMode ? 0 : dt, this.photoMode ? 0 : actions.steer, this.photoMode ? 0 : actions.brake);
    this.car.clearFeelPulses();
    const ghostTime = this.photoGhostTime() ?? this.time;
    this.world.applyGhost(this.track, this.ghost, ghostTime, this.car.s, this.ghostSmooth);
    this.world.stepParticles(this.photoMode ? 0 : dt);
    const attract = !this.photoMode && isLobbyPhase(this.phase);
    if (this.photoMode) {
      this.world.applyPhotoCamera(this.photoLookTarget(vis), this.photoOrbit);
    } else {
      this.world.updateCamera(vis, dt, this.camera, attract, this.attractS, this.track, this.reduced, actions.steer);
    }
    this.audio.setScene(this.photoMode ? "paused" : this.phase);
    const racing = !this.photoMode && (this.phase === "race" || this.phase === "countdown");
    this.audio.setEngine(vis.speed, this.photoMode ? 0 : actions.throttle, vis.boost, vis.airborne, vis.slide, racing);
    if (!this.world.contextLost) this.world.render();

    this.frames++;
    if (now - this.fpsAt > 400) {
      useGame.getState().setFps(Math.round((this.frames * 1000) / (now - this.fpsAt)));
      this.frames = 0;
      this.fpsAt = now;
    }

    this.hudAcc += dt;
    if (this.hudAcc > 0.08) {
      this.hudAcc = 0;
      const pace =
        this.phase === "race" || this.phase === "countdown"
          ? medalPace(this.trackId, this.phase === "countdown" ? 0 : this.time)
          : { holding: null, remain: null };
      const ghost = sampleGhost(this.ghost, this.time, this.track.length, this.track.def.closed);
      let ghostDelta: number | null = null;
      if (ghost && this.phase === "race") {
        const atS = ghostTimeAtS(this.ghost, this.car.s, this.track.length, this.track.def.closed);
        ghostDelta = ghostRaceSplitMs(this.time, atS);
        if (ghostDelta == null) {
          ghostDelta = ghostSplitMs(ghost.s, this.car.s, vis.speed, this.track.length, this.track.def.closed);
        }
        this.ghostSmooth = ghostDeltaSmooth(this.ghostSmooth, ghostDelta, this.hudAcc || 0.08);
        ghostDelta = this.ghostSmooth;
      } else {
        this.ghostSmooth = null;
      }
      const flash = now < this.cpFlashUntil ? this.cpFlash : null;
      if (!flash) this.cpFlash = null;
      useGame.getState().setHud({
        time: this.time,
        speed: vis.speed,
        cp: Math.max(0, this.car.lastCp + 1),
        cpTotal: this.track.checkpoints.length,
        lap: this.car.lap,
        laps: this.track.def.laps,
        boost: vis.boost,
        medal: pace.holding,
        wrongWay: this.car.wrongWay > 0.45,
        countdown: this.phase === "countdown" ? Math.max(1, Math.ceil(this.countdown)) : this.time < 450 ? 0 : null,
        splittime: ghostDelta,
        driftCharge: vis.driftCharge,
        s: this.car.s,
        n: this.car.n,
        heading: this.car.heading,
        ghostS: ghost?.s ?? null,
        ghostN: ghost?.n ?? null,
        ghostDelta,
        ghostLead: ghostLead(ghostDelta),
        medalRemain: pace.remain,
        cpFlash: flash,
      });
    }
  };

  private armCpFlash(kind: "cp" | "lap" | "finish", now: number) {
    const atS = ghostTimeAtS(this.ghost, this.car.s, this.track.length, this.track.def.closed);
    const delta = this.phase === "race" ? ghostRaceSplitMs(this.time, atS) : null;
    this.cpFlash = {
      kind,
      delta,
      label: cpFlashLabel(kind, this.car.lastCp + 1),
    };
    this.cpFlashUntil = now + cpFlashHoldMs();
  }

  private onFinish() {
    this.clearPhoto();
    const time = this.time;
    const prevBest = readSave().best[this.trackId] ?? null;
    const priorGhost = this.ghost;
    const medal = medalFor(this.trackId, time);
    const commit = applyRunCommit(this.trackId, time, this.recording);
    const picked = pickRaceGhost(readSave().ghosts[this.trackId], readLastSave().runs[this.trackId]?.frames);
    this.ghost = picked.frames;
    this.ghostSource = picked.source;
    useGame.getState().refreshBest();
    const cupEvent = getCupEvent(useGame.getState().cupEventId);
    const cup = cupEvent ? applyCupCommit(cupEvent, time, medal) : null;
    if (cup) useGame.getState().refreshCup();
    this.audio.setScene("results");
    this.audio.finish(medal);
    this.world.addTrauma(0.4);
    this.input.rumble("finish");
    this.phase = "results";
    useGame.getState().setPhase("results");
    useGame.getState().setResults({
      ...buildResults({
        time,
        trackId: this.trackId,
        prevBest,
        ghost: priorGhost,
        medal,
        ghostSaved: commit.isPb ? commit.savedGhost : commit.savedLast,
        ghostSource: this.ghostSource,
        lastTime: commit.lastTime,
        recents: commit.recents,
      }),
      cup,
    });
  }

  setTouchSteer(v: number) {
    this.input.touchSteer = v;
  }

  setTouchThrottle(v: number) {
    if (this.input.touchBrake > 0.05 && v > 0) return;
    this.input.touchThrottle = v;
  }

  setTouchBrake(v: number) {
    this.input.touchBrake = v > 0.05 ? 1 : 0;
    if (v > 0.05) this.input.touchThrottle = 0;
  }

  setTouchSlide(v: number) {
    this.input.touchSlide = v;
  }

  enterPhoto() {
    if (this.photoMode) return;
    if (useGame.getState().settingsOpen) return;
    if (this.phase !== "race" && this.phase !== "countdown" && this.phase !== "paused" && this.phase !== "results") {
      return;
    }
    if (this.phase === "race") this.timeHold = this.time;
    if (this.phase === "countdown") {
      this.countdown = Math.max(0, countdownRemaining(this.countdownAt, performance.now(), COUNTDOWN_S));
    }
    this.photoFrom = this.phase;
    this.photoMode = true;
    this.photoOrbit = defaultPhotoOrbit();
    this.photoFollowGhost = false;
    this.photoScrub = this.phase === "results" ? 1 : this.photoScrubFromRace();
    const canGhost = this.phase === "results" && ghostScrubSpan(this.ghost) != null;
    useGame.getState().setPhotoMode(true);
    useGame.getState().setPhotoGhost(canGhost);
    useGame.getState().setPhotoScrub(this.photoScrub);
    useGame.getState().setPhotoFollowGhost(false);
    useGame.getState().setPhotoCapturing(false);
    this.input.touchSteer = 0;
    this.input.touchThrottle = 0;
    this.input.touchBrake = 0;
    this.input.touchSlide = 0;
  }

  exitPhoto() {
    if (!this.photoMode) return;
    const from = this.photoFrom;
    this.clearPhoto();
    const now = performance.now();
    this.lastT = now;
    if (from === "race") this.raceClockAt = now;
    if (from === "countdown") this.countdownAt = countdownPausedAt(now, this.countdown, COUNTDOWN_S);
    this.capturePlayFocus();
  }

  togglePhoto() {
    if (this.photoMode) this.exitPhoto();
    else this.enterPhoto();
  }

  nudgePhoto(dyaw: number, dpitch: number, dzoom = 0) {
    if (!this.photoMode) return;
    this.photoOrbit = nudgePhotoOrbit(this.photoOrbit, dyaw, dpitch, dzoom);
  }

  setPhotoScrub(u: number) {
    this.photoScrub = Math.max(0, Math.min(1, u));
    useGame.getState().setPhotoScrub(this.photoScrub);
  }

  setPhotoFollowGhost(v: boolean) {
    this.photoFollowGhost = v && ghostScrubSpan(this.ghost) != null;
    useGame.getState().setPhotoFollowGhost(this.photoFollowGhost);
  }

  async capturePhoto(): Promise<boolean> {
    if (!this.photoMode || this.world.contextLost) return false;
    const store = useGame.getState();
    store.setPhotoCapturing(true);
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const blob = await this.world.captureStill();
    store.setPhotoCapturing(false);
    if (!blob) return false;
    return downloadBlob(blob, stillFilename(this.trackId));
  }

  private clearPhoto() {
    this.photoMode = false;
    this.photoFrom = null;
    this.photoFollowGhost = false;
    this.photoOrbit = defaultPhotoOrbit();
    useGame.getState().setPhotoMode(false);
    useGame.getState().setPhotoCapturing(false);
    useGame.getState().setPhotoGhost(false);
    useGame.getState().setPhotoFollowGhost(false);
  }

  private photoScrubFromRace() {
    const span = ghostScrubSpan(this.ghost);
    if (!span) return 1;
    return Math.max(0, Math.min(1, (this.time - span.start) / (span.end - span.start)));
  }

  private photoGhostTime() {
    if (!this.photoMode || this.phase !== "results") return null;
    return ghostScrubTime(this.ghost, this.photoScrub);
  }

  private photoLookTarget(vis: CarSnap) {
    if (this.photoFollowGhost && this.phase === "results") {
      const t = ghostScrubTime(this.ghost, this.photoScrub);
      const pose = t != null ? sampleGhost(this.ghost, t, this.track.length, this.track.def.closed) : null;
      if (pose) {
        const at = sampleAt(this.track, pose.s);
        const ch = Math.cos(pose.heading);
        const sh = Math.sin(pose.heading);
        return {
          px: at.x + at.rx * pose.n + at.ux * 0.38,
          py: at.y + at.ry * pose.n + at.uy * 0.38,
          pz: at.z + at.rz * pose.n + at.uz * 0.38,
          fx: at.tx * ch - at.rx * sh,
          fy: at.ty * ch - at.ry * sh,
          fz: at.tz * ch - at.rz * sh,
        };
      }
    }
    return vis;
  }

  private handlePhotoPad(actions: { confirm: boolean; back: boolean; pause: boolean; camera: boolean; photo: boolean; steer: number; throttle: number; brake: number }, dt: number) {
    if (actions.photo || actions.back || actions.pause) {
      this.exitPhoto();
      return;
    }
    if (actions.confirm) {
      void this.capturePhoto();
      return;
    }
    if (actions.camera) this.photoOrbit = defaultPhotoOrbit();
    this.photoOrbit = nudgePhotoOrbit(
      this.photoOrbit,
      actions.steer * PHOTO_YAW_RATE * dt,
      (actions.throttle - actions.brake) * PHOTO_PITCH_RATE * dt,
      this.input.zoomHeld * PHOTO_ZOOM_RATE * dt,
    );
  }

  private handleMenuPad(actions: { confirm: boolean; back: boolean; menuY: number }) {
    const y = Math.abs(actions.menuY) > 0.5 ? Math.sign(actions.menuY) : 0;
    const yEdge = y !== 0 && y !== this.menuYPrev;
    this.menuYPrev = y;

    if (this.phase === "menu") {
      if (actions.confirm) {
        this.audio.click();
        this.beginTrial(this.trackId);
      }
      return;
    }
    if (this.phase === "garage") {
      if (actions.back || actions.confirm) {
        this.audio.click();
        this.setPhase("menu");
      }
      if (yEdge) {
        this.audio.click();
        const cur = useGame.getState().settings.livery;
        useGame.getState().setLivery(nextLivery(cur, y));
      }
      return;
    }
    if (this.phase === "select") {
      if (actions.back) {
        this.audio.click();
        this.menu();
      }
      if (actions.confirm) {
        this.audio.click();
        this.beginTrial(this.trackId);
      }
      if (yEdge) {
        this.audio.click();
        const i = TRACK_ORDER.indexOf(this.trackId);
        const next = TRACK_ORDER[(i + y + TRACK_ORDER.length) % TRACK_ORDER.length]!;
        this.load(next);
      }
      return;
    }
    if (this.phase === "cup") {
      if (actions.back) {
        this.audio.click();
        this.menu();
      }
      if (actions.confirm) {
        const id = useGame.getState().cupFocusId;
        if (getCupEvent(id) && isEventUnlocked(readCupProgress(), getCupEvent(id)!)) {
          this.audio.click();
          this.beginCup(id);
        }
      }
      if (yEdge) {
        this.audio.click();
        const list = allCupEvents();
        const i = Math.max(0, list.findIndex((e) => e.id === useGame.getState().cupFocusId));
        const next = list[(i + y + list.length) % list.length]!;
        useGame.getState().setCupFocus(next.id);
        this.load(next.trackId);
      }
      return;
    }
    if (this.phase === "paused") {
      if (actions.confirm) {
        this.audio.click();
        this.resume();
      } else if (actions.back) {
        this.audio.click();
        this.menu();
      }
      return;
    }
    if (this.phase === "results") {
      const results = useGame.getState().results;
      if (actions.confirm) {
        this.audio.click();
        if (results?.cup?.nextEventId) this.beginCup(results.cup.nextEventId);
        else this.startRace(this.trackId);
      } else if (actions.back) {
        this.audio.click();
        if (results?.cup) this.openCup();
        else this.menu();
      }
    }
  }

  respawn() {
    if (this.phase === "race" || this.phase === "countdown") this.applyRespawn();
  }

  private applyRespawn() {
    this.car.respawn(this.track);
    this.camSnapAfterSim = true;
    this.afterSimRespawn();
  }

  private afterSimRespawn() {
    this.curr = this.car.snap();
    this.prev = this.curr;
    this.acc = 0;
    this.world.snapCamera(this.curr, this.camera);
  }

  dispose() {
    this.clearPhoto();
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.unsubSettings?.();
    this.unsubSettings = null;
    this.ro.disconnect();
    window.visualViewport?.removeEventListener("resize", this.onViewport);
    window.removeEventListener("orientationchange", this.onViewport);
    document.removeEventListener("visibilitychange", this.onVis);
    this.input.detach();
    this.audio.dispose();
    this.world.dispose();
    if (window.__rushline === this) delete window.__rushline;
    if (window.__controlsTest) delete window.__controlsTest;
  }
}

