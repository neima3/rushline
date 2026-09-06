import type { Actions, PadInfo } from "./types";
import { padInfoFrom, pollPads, rumblePads } from "./gamepad";

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
  /** Throttle from keys / pad / touch before auto-throttle fills in. */
  manualThrottle = 0;
  pad: PadInfo = { connected: false, id: "", xbox: false, active: false };
  private lastPadUse = 0;
  touchMode = false;
  onPauseHotkey: (() => void) | null = null;
  onCameraHotkey: (() => void) | null = null;
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
  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onBlur: () => void;
  private onPad: () => void;
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
    this.onPad = () => {
      void navigator.getGamepads?.();
    };
    this.onPointer = (e: PointerEvent) => {
      const t = e.target;
      if (t === this.surface) this.focusSurface();
      this.onPad();
    };
  }

  attach(surface?: HTMLElement) {
    const opts = { capture: true };
    this.surface = surface ?? null;
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

  private down(code: string) {
    if (this.injected?.includes(code)) return true;
    return this.keys.has(code);
  }

  sample(): Actions {
    let steer = 0;
    if (this.down("KeyA") || this.down("ArrowLeft")) steer += 1;
    if (this.down("KeyD") || this.down("ArrowRight")) steer -= 1;

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

    if (gp) {
      const used =
        Math.abs(gp.steer) > 0.08 ||
        gp.throttle > 0.08 ||
        gp.brake > 0.08 ||
        gp.slide ||
        gp.a ||
        gp.b ||
        gp.x ||
        gp.y ||
        gp.start ||
        gp.view ||
        gp.lb ||
        gp.rb ||
        gp.dpadX !== 0 ||
        gp.dpadY !== 0;
      if (used) this.lastPadUse = performance.now();
      steer += gp.steer;
      throttle = Math.max(throttle, gp.throttle);
      if (gp.a) throttle = Math.max(throttle, 1);
      brake = Math.max(brake, gp.brake);
      if (gp.b) brake = Math.max(brake, 1);
      confirmNow = confirmNow || gp.a;
      backNow = backNow || gp.b;
      if (gp.dpadY) menuY = gp.dpadY;
    }

    const active = gp != null && performance.now() - this.lastPadUse < 2500;
    this.pad = padInfoFrom(gp, active);

    steer += this.touchSteer;
    throttle = Math.max(throttle, this.touchThrottle);
    brake = Math.max(brake, this.touchBrake);
    this.manualThrottle = throttle;
    const now = performance.now();
    if (brake > 0.05) this.brakeLatchUntil = now + 340;
    if (now < this.brakeLatchUntil) {
      brake = Math.max(brake, 1);
      throttle = 0;
    } else if (this.autoThrottle && throttle < 0.05) {
      throttle = this.touchMode ? 0.5 : 1;
    }

    steer = Math.max(-1, Math.min(1, steer));

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
