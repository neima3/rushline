import type { TrackId } from "./types";

/** First Ridge curve ends ~110; keep auto-throttle tame through that settle. */
const CANYON_SETTLE_S = 120;
const CANYON_BLEND_S = 40;
const OPENING_THROTTLE = 0.38;
const OPENING_HOLD = 0.14;
const OPENING_SPEED = 17;
const TOUCH_CRUISE = 0.5;
const TOUCH_LATE_SPEED = 24;

export const BRAKE_LATCH_MS = 340;

/** iOS Safari fires these when the canvas takes focus or a scroll heuristic runs. */
export function isSpuriousHoldEnd(type: string): boolean {
  return type === "pointercancel" || type === "touchcancel" || type === "lostpointercapture";
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
