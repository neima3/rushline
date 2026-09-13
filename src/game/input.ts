import type { Actions, PadInfo } from "./types";
import { padInfoFrom, padInUse, pollPads, rumblePads, type PadHotPlug } from "./gamepad";
import { resolveSampleDrive } from "./auto-throttle";
import { steerFilter } from "./feel";
import { applySteerSettings } from "./settings";

const GAME_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyR",
  "KeyC",
  "KeyM",
  "Space",
  "ShiftLeft",
  "ShiftRight",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Enter",
  "Backspace",
  "Escape",
  "KeyP",
]);

export class Input {
  keys = new Set<string>();
  injected: string[] | null = null;
  touchSteer = 0;
  touchThrottle = 0;
  touchBrake = 0;
  touchSlide = 0;
  autoThrottle = false;
  touchMode = false;
  touchSteerSensitivity = 1;
  invertSteer = false;
  /** Throttle from keys / pad / touch before auto-throttle fills in. */
  manualThrottle = 0;
  pad: PadInfo = { connected: false, id: "", xbox: false, active: false };
  private lastPadUse = 0;
  onPauseHotkey: (() => void) | null = null;
  onCameraHotkey: (() => void) | null = null;
  onPadChange: ((info: PadInfo, reason: PadHotPlug) => void) | null = null;
  private queued = { pause: false, camera: false, respawn: false };
  private brakeLatchUntil = 0;
  private edgePrev = {
    respawn: false,
    restart: false,
    pause: false,
    camera: false,
    confirm: false,
    back: false,
  };
  private surface: HTMLElement | null = null;
  private lastKeyStamp = -1;
  private filtSteer = 0;
  private lastSampleAt = 0;
  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onBlur: () => void;
  private onPad: (e?: Event) => void;
  private onPointer: (e: PointerEvent) => void;

  constructor() {
    this.onKeyDown = (e) => {
      if (e.timeStamp && e.timeStamp === this.lastKeyStamp) return;
      this.lastKeyStamp = e.timeStamp || this.lastKeyStamp;
      const esc = e.code === "Escape" || e.key === "Escape";
      if (GAME_CODES.has(e.code) || esc) {
        e.preventDefault();
        this.keys.add(e.code);
        if (e.repeat) return;
        if (esc || e.code === "KeyP") {
          if (this.onPauseHotkey) {
            this.onPauseHotkey();
            this.edgePrev.pause = true;
          } else {
            this.queued.pause = true;
          }
        }
        if (e.code === "KeyC") {
          if (this.onCameraHotkey) {
            this.onCameraHotkey();
            this.edgePrev.camera = true;
          } else {
            this.queued.camera = true;
          }
        }
        if (e.code === "KeyR") this.queued.respawn = true;
      }
    };
    this.onKeyUp = (e) => {
      this.keys.delete(e.code);
    };
    this.onBlur = () => this.keys.clear();
    this.onPad = (e?: Event) => {
      void navigator.getGamepads?.();
      const reason: PadHotPlug =
        e?.type === "gamepadconnected" ? "connect" : e?.type === "gamepaddisconnected" ? "disconnect" : "poll";
      this.refreshPad(reason);
    };
    this.onPointer = (e: PointerEvent) => {
      const t = e.target;
      if (t === this.surface) this.focusSurface();
      this.onPad();
    };
  }

  attach(surface?: HTMLElement) {
    this.surface = surface ?? null;
    if (typeof window === "undefined") return;
    const opts = { capture: true };
    // One window listener only — canvas + document copies of the same handler
    // toggle pause/camera twice when the play surface is focused.
    window.addEventListener("keydown", this.onKeyDown, opts);
    window.addEventListener("keyup", this.onKeyUp, opts);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("gamepadconnected", this.onPad);
    window.addEventListener("gamepaddisconnected", this.onPad);
    window.addEventListener("pointerdown", this.onPad);
    surface?.addEventListener("pointerdown", this.onPointer);
  }

  detach() {
    if (typeof window === "undefined") {
      this.surface = null;
      return;
    }
    const opts = { capture: true };
    window.removeEventListener("keydown", this.onKeyDown, opts);
    window.removeEventListener("keyup", this.onKeyUp, opts);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("gamepadconnected", this.onPad);
    window.removeEventListener("gamepaddisconnected", this.onPad);
    window.removeEventListener("pointerdown", this.onPad);
    this.surface?.removeEventListener("pointerdown", this.onPointer);
    this.surface = null;
  }

  focusSurface() {
    const el = this.surface;
    if (!el) return;
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
  }

  setKeys(codes: string[]) {
    this.injected = codes;
  }

  rumble(kind: "boost" | "crash" | "turbo" | "land" | "finish") {
    rumblePads(kind);
  }

  refreshPad(reason: PadHotPlug = "poll") {
    const gp = pollPads();
    if (gp && padInUse(gp)) this.lastPadUse = performance.now();
    if (reason === "connect" && gp) this.lastPadUse = performance.now();
    const active = gp != null && (reason === "connect" || performance.now() - this.lastPadUse < 2500);
    const next = padInfoFrom(gp, active);
    const changed = next.connected !== this.pad.connected || next.id !== this.pad.id || next.active !== this.pad.active;
    this.pad = next;
    if (changed || reason === "connect" || reason === "disconnect") {
      this.onPadChange?.(next, reason);
    }
  }

  private down(code: string) {
    if (this.injected?.includes(code)) return true;
    return this.keys.has(code);
  }

  sample(): Actions {
    let kbSteer = 0;
    if (this.down("KeyA") || this.down("ArrowLeft")) kbSteer += 1;
    if (this.down("KeyD") || this.down("ArrowRight")) kbSteer -= 1;

    let throttle = 0;
    let brake = 0;
    if (this.down("KeyW") || this.down("ArrowUp")) throttle = 1;
    if (this.down("KeyS") || this.down("ArrowDown")) brake = 1;

    const gp = pollPads();
    let confirmNow = this.down("Enter");
    let backNow = this.down("Backspace");
    let menuY = 0;
    if (this.down("ArrowUp") || this.down("KeyW")) menuY -= 1;
    if (this.down("ArrowDown") || this.down("KeyS")) menuY += 1;
    let padSteer = 0;

    if (gp) {
      if (padInUse(gp)) this.lastPadUse = performance.now();
      padSteer = gp.steer;
      throttle = Math.max(throttle, gp.throttle);
      if (gp.a) throttle = Math.max(throttle, 1);
      brake = Math.max(brake, gp.brake);
      if (gp.b) brake = Math.max(brake, 1);
      confirmNow = confirmNow || gp.a;
      backNow = backNow || gp.b;
      if (gp.dpadY) menuY = gp.dpadY;
    }

    const active = gp != null && performance.now() - this.lastPadUse < 4000;
    this.pad = padInfoFrom(gp, active);

    const drive = resolveSampleDrive({
      throttle,
      brake,
      touchThrottle: this.touchThrottle,
      touchBrake: this.touchBrake,
      autoThrottle: this.autoThrottle,
      touchMode: this.touchMode,
      now: performance.now(),
      latchUntil: this.brakeLatchUntil,
    });
    this.brakeLatchUntil = drive.latchUntil;
    this.manualThrottle = drive.manualThrottle;
    if (this.touchBrake > 0.05) this.touchThrottle = 0;
    throttle = drive.throttle;
    brake = drive.brake;

    let steer = applySteerSettings(kbSteer, padSteer, this.touchSteer, {
      sensitivity: this.touchSteerSensitivity,
      invert: this.invertSteer,
    });
    const now = performance.now();
    const dt = this.lastSampleAt ? Math.min(0.05, (now - this.lastSampleAt) / 1000) : 1 / 60;
    this.lastSampleAt = now;
    const analog = Math.abs(this.touchSteer) > 0.02 || Boolean(gp && Math.abs(gp.steer) > 0.08);
    steer = steerFilter(this.filtSteer, steer, dt, analog);
    this.filtSteer = steer;

    const slideHeld =
      this.down("Space") ||
      this.down("ShiftLeft") ||
      this.down("ShiftRight") ||
      Boolean(gp?.slide) ||
      this.touchSlide > 0.5;

    const respawnNow = this.down("KeyR") || Boolean(gp?.y);
    const restartNow = this.down("Enter") || this.down("Backspace");
    const pauseNow = this.down("Escape") || this.down("KeyP") || Boolean(gp?.start);
    const cameraNow = this.down("KeyC") || Boolean(gp?.rb) || Boolean(gp?.view);

    const respawn = this.queued.respawn || (respawnNow && !this.edgePrev.respawn);
    const restart = restartNow && !this.edgePrev.restart;
    const pause = this.queued.pause || (pauseNow && !this.edgePrev.pause);
    const camera = this.queued.camera || (cameraNow && !this.edgePrev.camera);
    this.queued.pause = false;
    this.queued.camera = false;
    this.queued.respawn = false;
    const confirm = confirmNow && !this.edgePrev.confirm;
    const back = backNow && !this.edgePrev.back;
    this.edgePrev = {
      respawn: respawnNow,
      restart: restartNow,
      pause: pauseNow,
      camera: cameraNow,
      confirm: confirmNow,
      back: backNow,
    };

    return {
      throttle,
      brake,
      steer,
      slide: slideHeld ? 1 : 0,
      respawn,
      restart,
      pause,
      camera,
      confirm,
      back,
      menuY,
    };
  }
}
