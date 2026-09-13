/** Countdown length. Wall-clock, not physics steps — Start must tick without a canvas click. */
export const COUNTDOWN_S = 2.4;

/** Race HUD time. `startedAt` is performance.now() at GO / resume. */
export function wallClockMs(hold: number, startedAt: number, now: number) {
  if (!(startedAt > 0)) return Math.max(0, hold);
  return hold + Math.max(0, now - startedAt);
}

export function countdownRemaining(startedAt: number, now: number, duration = COUNTDOWN_S) {
  return duration - (now - startedAt) / 1000;
}

export function countdownPausedAt(now: number, remaining: number, duration = COUNTDOWN_S) {
  return now - (duration - remaining) * 1000;
}
