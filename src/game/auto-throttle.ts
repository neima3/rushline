import type { TrackId } from "./types";

/** First Ridge curve ends ~110; keep auto-throttle tame through that settle. */
const CANYON_SETTLE_S = 120;
const CANYON_BLEND_S = 40;
const OPENING_THROTTLE = 0.38;
const OPENING_HOLD = 0.14;
const OPENING_SPEED = 17;
const TOUCH_CRUISE = 0.5;
const TOUCH_LATE_SPEED = 24;

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
