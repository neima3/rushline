import type { GhostFrame } from "./types";

/** Desktop tape: ~8s at ~30 Hz. */
export const REWIND_WINDOW_MS = 8000;
export const REWIND_RECORD_MS = 32;
export const REWIND_MAX_FRAMES = 250;

/** Touch tape: shorter window, fewer frames, same feel. */
export const REWIND_TOUCH_WINDOW_MS = 6000;
export const REWIND_TOUCH_RECORD_MS = 40;
export const REWIND_TOUCH_MAX_FRAMES = 150;

/** Hold playback speed vs realtime. */
export const REWIND_RATE = 2.75;

export const REWIND_MIN_SPAN_MS = 80;

export type RewindLimits = {
  windowMs: number;
  recordMs: number;
  maxFrames: number;
};

export type RewindCar = {
  s: number;
  n: number;
  heading: number;
  speed: number;
  airborne: boolean;
  vx: number;
  vy: number;
  vz: number;
  px: number;
  py: number;
  pz: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  yaw: number;
  boost: number;
  slideAmt: number;
  driftCharge: number;
  lastCp: number;
  lap: number;
  finished: boolean;
  wrongWay: number;
  fx: number;
  fy: number;
  fz: number;
  ux: number;
  uy: number;
  uz: number;
  wallHit: number;
  wasSlide: boolean;
  slideLatched: boolean;
  airTime: number;
  landLock: number;
  airBlend: number;
  recoverLock: number;
  boostPunch: number;
};

export type RewindFrame = {
  t: number;
  car: RewindCar;
};

export function rewindLimits(touch = false): RewindLimits {
  return touch
    ? { windowMs: REWIND_TOUCH_WINDOW_MS, recordMs: REWIND_TOUCH_RECORD_MS, maxFrames: REWIND_TOUCH_MAX_FRAMES }
    : { windowMs: REWIND_WINDOW_MS, recordMs: REWIND_RECORD_MS, maxFrames: REWIND_MAX_FRAMES };
}

export function cloneRewindCar(car: RewindCar): RewindCar {
  return { ...car };
}

export function nextRewindTime(currentT: number, dt: number, oldestT: number, rate = REWIND_RATE): number {
  if (!Number.isFinite(currentT) || !Number.isFinite(dt)) return Math.max(0, oldestT);
  const next = currentT - Math.max(0, dt) * rate * 1000;
  return Math.max(0, oldestT, next);
}

/** Pin the wall clock so HUD time stays at the restored stamp after release. */
export function pinRaceClock(restoredMs: number, now: number) {
  const hold = Math.max(0, Number.isFinite(restoredMs) ? restoredMs : 0);
  return { hold, startedAt: now };
}

/**
 * TM training / time-attack rule: rewind never wipes a standing PB.
 * Only a finished time after rewind can replace it.
 */
export function finishCountsAsPb(time: number, prevBest: number | null | undefined, _usedRewind = false): boolean {
  if (!Number.isFinite(time) || time <= 0) return false;
  return prevBest == null || time < prevBest;
}

export function trimByTime<T extends { t: number }>(frames: T[], t: number): T[] {
  if (frames.length === 0) return frames;
  let end = frames.length;
  while (end > 0 && frames[end - 1]!.t > t) end--;
  if (end === frames.length) return frames;
  return end === 0 ? [] : frames.slice(0, end);
}

export function trimRecording(frames: GhostFrame[], t: number): GhostFrame[] {
  return trimByTime(frames, t);
}

export function sampleTape(frames: RewindFrame[], t: number): RewindFrame | null {
  if (frames.length === 0) return null;
  if (t <= frames[0]!.t) return frames[0]!;
  if (t >= frames[frames.length - 1]!.t) return frames[frames.length - 1]!;
  let lo = 0;
  let hi = frames.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const ft = frames[mid]!.t;
    if (ft === t) return frames[mid]!;
    if (ft < t) lo = mid + 1;
    else hi = mid - 1;
  }
  return frames[Math.max(0, hi)] ?? null;
}

export class RewindTape {
  private frames: RewindFrame[] = [];
  private windowMs: number;
  private recordMs: number;
  private maxFrames: number;

  constructor(touch = false) {
    const lim = rewindLimits(touch);
    this.windowMs = lim.windowMs;
    this.recordMs = lim.recordMs;
    this.maxFrames = lim.maxFrames;
  }

  configure(touch: boolean) {
    const lim = rewindLimits(touch);
    this.windowMs = lim.windowMs;
    this.recordMs = lim.recordMs;
    this.maxFrames = lim.maxFrames;
    this.evict(this.newestT());
  }

  clear() {
    this.frames = [];
  }

  get length() {
    return this.frames.length;
  }

  newestT() {
    return this.frames.length ? this.frames[this.frames.length - 1]!.t : 0;
  }

  oldestT() {
    return this.frames.length ? this.frames[0]!.t : 0;
  }

  spanMs() {
    if (this.frames.length < 2) return 0;
    return this.frames[this.frames.length - 1]!.t - this.frames[0]!.t;
  }

  canRewind() {
    return this.frames.length >= 2 && this.spanMs() >= REWIND_MIN_SPAN_MS;
  }

  record(t: number, car: RewindCar) {
    if (!Number.isFinite(t) || t < 0) return;
    const last = this.frames[this.frames.length - 1];
    if (last) {
      if (t <= last.t) return;
      if (t - last.t < this.recordMs) return;
    }
    this.frames.push({ t, car: cloneRewindCar(car) });
    this.evict(t);
  }

  sample(t: number): RewindFrame | null {
    return sampleTape(this.frames, t);
  }

  truncateTo(t: number) {
    this.frames = trimByTime(this.frames, t);
  }

  private evict(nowT: number) {
    const cut = nowT - this.windowMs;
    let drop = 0;
    while (drop < this.frames.length && this.frames[drop]!.t < cut) drop++;
    const overflow = this.frames.length - drop - this.maxFrames;
    if (overflow > 0) drop += overflow;
    if (drop > 0) this.frames.splice(0, drop);
  }
}
