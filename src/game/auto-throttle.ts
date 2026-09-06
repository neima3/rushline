import type { TrackId } from "./types";

/** First Ridge curve ends ~110; keep auto-throttle tame through that settle. */
const CANYON_SETTLE_S = 120;
const CANYON_BLEND_S = 40;
const OPENING_THROTTLE = 0.38;
const OPENING_HOLD = 0.14;
const OPENING_SPEED = 17;
const TOUCH_CRUISE = 0.5;
const TOUCH_LATE_SPEED = 24;

export const BRAKE_LATCH_MS = 520;
export const HOLD_CANCEL_GRACE_MS = 480;

/** iOS Safari fires these when the canvas takes focus or a scroll heuristic runs. */
export function isSpuriousHoldEnd(type: string): boolean {
  return type === "pointercancel" || type === "touchcancel" || type === "lostpointercapture";
}

/**
 * HoldButton stays latched until a confirmed finger-up. A solitary
 * `pointerup` is never that confirmation on touch — iOS Safari and Chrome
 * device-mode fire it (often with cancelUntil===0, no prior cancel) while
 * the finger is still down. Auto-throttle then refills to cruise (~62 km/h)
 * and Accel "PASS" is smoke, not a Manual Accel hold.
 *
 * Confirmed lift: zero remaining touches, grace armed and expired, and
 * either `touchend` or a mouse `pointerup`. Never release on pointercancel /
 * lostpointercapture / touchcancel / touch pointerup.
 */
export function shouldReleaseHold(
  type: string,
  now: number,
  cancelUntil: number,
  remainingTouches = 0,
  pointerType?: string,
  buttons = 0,
): boolean {
  if (isSpuriousHoldEnd(type)) return false;
  if (remainingTouches > 0) return false;
  if (buttons > 0) return false;
  // Unarmed: ghost pointerup with no prior cancel must not clear the latch.
  if (cancelUntil <= 0) return false;
  if (now < cancelUntil) return false;
  if (type === "touchend") return true;
  // Ignore every touch/pen pointerup for the active id — ghost or late.
  return type === "pointerup" && pointerType === "mouse";
}

export type HoldLatch = { held: boolean; cancelUntil: number; downId?: number | null };

export type HoldEvent = {
  type: string;
  now: number;
  remainingTouches?: number;
  pointerType?: string;
  pointerId?: number;
  buttons?: number;
};

/**
 * TouchPad HoldButton state machine. Pointerdown / touchstart latch the hold
 * and arm grace. Cancel storms and touch pointerup are ignored. A mouse up
 * or touchend after grace with no fingers ends it.
 */
export function reduceHold(state: HoldLatch, event: HoldEvent): HoldLatch {
  if (event.type === "pointerdown" || event.type === "touchstart") {
    return {
      held: true,
      cancelUntil: event.now + HOLD_CANCEL_GRACE_MS,
      downId: event.pointerId ?? state.downId ?? null,
    };
  }
  if (isSpuriousHoldEnd(event.type)) {
    return {
      held: state.held,
      cancelUntil: Math.max(state.cancelUntil, event.now + HOLD_CANCEL_GRACE_MS),
      downId: state.downId,
    };
  }
  if (
    state.held &&
    shouldReleaseHold(
      event.type,
      event.now,
      state.cancelUntil,
      event.remainingTouches ?? 0,
      event.pointerType,
      event.buttons ?? 0,
    )
  ) {
    return { held: false, cancelUntil: 0, downId: null };
  }
  return state;
}

/**
 * Game-loop override: latched touch brake beats auto-throttle for the whole
 * press. Same function the race loop uses so tests hit the real wiring.
 */
export function applyTouchDrive(input: {
  throttle: number;
  brake: number;
  touchBrake: number;
  autoThrottle: boolean;
  manualThrottle: number;
  cap: number;
}): { throttle: number; brake: number } {
  if (input.touchBrake > 0.05) {
    return { throttle: 0, brake: 1 };
  }
  let throttle = input.throttle;
  const brake = input.brake;
  if (input.autoThrottle && input.manualThrottle < 0.05 && brake < 0.05) {
    throttle = Math.min(throttle, input.cap);
  }
  return { throttle, brake };
}

/** Mirrors `CarSim.stepGround` longitudinal so tests can prove speed falls. */
export function stepLongitudinalSpeed(speed: number, throttle: number, brake: number, dt: number): number {
  const accel = 28;
  const brakeForce = 40;
  const reverse = 16;
  const drag = throttle > 0.1 ? 0.26 : 0.74;
  let next = speed;
  if (throttle > 0) next += accel * throttle * dt;
  if (brake > 0) {
    if (next > 0.4) next -= brakeForce * brake * dt;
    else next -= reverse * brake * dt;
  }
  next *= 1 - drag * dt;
  return next;
}

/** Touch brake must slow to a stop, not dump the car into reverse from a crawl. */
export function clampTouchSpeed(speed: number, touchMode: boolean): number {
  if (touchMode && speed < 0) return 0;
  return speed;
}

export function autoThrottleCap(opts: {
  trackId: TrackId;
  s: number;
  speed: number;
  firstCp: number;
  touchMode: boolean;
  countdown: boolean;
}): number {
  if (opts.countdown) return 0;

  if (opts.trackId === "canyon") {
    if (opts.s < CANYON_SETTLE_S) {
      return opts.speed > OPENING_SPEED ? OPENING_HOLD : OPENING_THROTTLE;
    }
    const full = opts.touchMode ? TOUCH_CRUISE : 1;
    const t = Math.min(1, (opts.s - CANYON_SETTLE_S) / CANYON_BLEND_S);
    return OPENING_THROTTLE + (full - OPENING_THROTTLE) * t;
  }

  if (!opts.touchMode) return 1;

  const early = opts.s < opts.firstCp;
  if (opts.speed > (early ? OPENING_SPEED : TOUCH_LATE_SPEED)) return OPENING_HOLD;
  return early ? OPENING_THROTTLE : TOUCH_CRUISE;
}

/** Hold brake long enough that a Safari pointercancel blip cannot re-arm auto-throttle. */
export function latchBrake(
  now: number,
  brake: number,
  latchUntil: number,
  holdMs = BRAKE_LATCH_MS,
): { brake: number; cutThrottle: boolean; latchUntil: number } {
  let until = latchUntil;
  if (brake > 0.05) until = now + holdMs;
  if (now < until) return { brake: Math.max(brake, 1), cutThrottle: true, latchUntil: until };
  return { brake, cutThrottle: false, latchUntil: until };
}
