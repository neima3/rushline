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
  pad: PadInfo = { connected: false, id: "", xbox: false, active: false };
  private lastPadUse = 0;
  private edgePrev = {
    respawn: false,
    restart: false,
    pause: false,
    camera: false,
    confirm: false,
    back: false,
  };
  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onBlur: () => void;
  private onPad: () => void;

  constructor() {
    this.onKeyDown = (e) => {
      if (GAME_CODES.has(e.code)) e.preventDefault();
      this.keys.add(e.code);
    };
    this.onKeyUp = (e) => {
      this.keys.delete(e.code);
    };
    this.onBlur = () => this.keys.clear();
    this.onPad = () => {
      void navigator.getGamepads?.();
    };
  }

  attach() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onBlur);
    window.addEventListener("gamepadconnected", this.onPad);
    window.addEventListener("gamepaddisconnected", this.onPad);
    window.addEventListener("pointerdown", this.onPad);
  }

  detach() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onBlur);
    window.removeEventListener("gamepadconnected", this.onPad);
    window.removeEventListener("gamepaddisconnected", this.onPad);
    window.removeEventListener("pointerdown", this.onPad);
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

    if (this.autoThrottle && throttle < 0.05 && brake < 0.05) throttle = 1;

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

    const respawn = respawnNow && !this.edgePrev.respawn;
    const restart = restartNow && !this.edgePrev.restart;
    const pause = pauseNow && !this.edgePrev.pause;
    const camera = cameraNow && !this.edgePrev.camera;
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
