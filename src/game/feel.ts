import type { TrackId } from "./types";

/** First Ridge curve ends ~110; stay planted through that settle. */
export const CANYON_PLANT_S = 120;
export const TOUCH_STEER_DEADZONE = 0.12;
export const BRAKE_HIT_SLOP = 16;
export const PAD_HIT_SLOP = 8;
export const CIRCUIT_CURB_S = 240;

export function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function smoothstep(t: number) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/**
 * Touch-pad steer: ignore the inner 12% so a resting thumb does not yaw,
 * then remap the rest so full lock is still reachable.
 */
export function shapeTouchSteer(raw: number): number {
  const x = clamp(raw, -1, 1);
  const a = Math.abs(x);
  if (a <= TOUCH_STEER_DEADZONE) return 0;
  const t = (a - TOUCH_STEER_DEADZONE) / (1 - TOUCH_STEER_DEADZONE);
  const shaped = t * t * 0.18 + t * 0.82;
  return Math.sign(x) * clamp(shaped, 0, 1);
}

/** Shared steer curve. Slightly larger deadzone than the old 0.04 analog slop. */
export function steerCurve(x: number) {
  const s = Math.sign(x);
  const a = Math.abs(x);
  if (a < 0.06) return 0;
  return s * (a * a * 0.28 + a * 0.72);
}

/**
 * Heading return. Release snaps the nose back; light steer bleeds residual
 * yaw so the car does not keep sliding after a thumb twitch.
 */
export function headingAlign(steerAbs: number, drifting: boolean): number {
  if (drifting) return 0.26;
  if (steerAbs < 0.08) return 8.4;
  if (steerAbs < 0.22) return 1.35;
  return 0.12;
}

export function driftSteerThreshold(slideHeld: boolean): number {
  return slideHeld ? 0.26 : 1;
}

export function stayPlanted(trackId: TrackId, s: number): boolean {
  return trackId === "canyon" && s < CANYON_PLANT_S;
}

export function openingLandLock(trackId: TrackId): number {
  return trackId === "canyon" ? 1.85 : 0;
}

export function openingHeadingBleed(trackId: TrackId, s: number, steerAbs: number, drifting: boolean): number {
  if (drifting) return 0;
  if (trackId === "canyon" && s < CANYON_PLANT_S && steerAbs < 0.28) return 3.6;
  if (s < 72 && steerAbs < 0.22) return 2.2;
  return 0;
}

/** Nudge Ridge opening back to the racing line unless the player is steering. */
export function plantLateral(n: number, trackId: TrackId, s: number, steerAbs: number, dt: number): number {
  if (trackId !== "canyon" || s >= 110 || steerAbs > 0.2) return n;
  return n * (1 - Math.min(1, 1.9 * dt));
}

/**
 * Circuit (and other flats): snap off the curb before the hard wall so an
 * early wide line does not launch off the asphalt. Helix is untouched.
 */
export function curbSnap(input: {
  n: number;
  heading: number;
  width: number;
  trackId: TrackId;
  s: number;
}): { n: number; heading: number; hit: boolean; early: boolean } {
  if (input.trackId === "helix") {
    return { n: input.n, heading: input.heading, hit: false, early: false };
  }
  const asphalt = input.width * 0.5 - 1.18;
  const wall = input.width * 0.5 - 0.62;
  const abs = Math.abs(input.n);
  if (abs <= asphalt) {
    return { n: input.n, heading: input.heading, hit: false, early: false };
  }
  const early = input.trackId === "circuit" && input.s < CIRCUIT_CURB_S;
  const over = abs - asphalt;
  const pull = Math.min(over + 0.06, early ? 0.48 : 0.24);
  const sign = Math.sign(input.n) || 1;
  let n = input.n - sign * pull;
  if (Math.abs(n) > wall) n = sign * (wall - 0.05);
  let heading = input.heading + sign * (early ? 0.2 : 0.1);
  if (early) heading *= 0.78;
  return { n, heading, hit: true, early };
}

export function blendHold(speed: number, trip: number, cruise: number, hold: number, span = 5): number {
  if (speed <= trip) return cruise;
  const t = smoothstep((speed - trip) / span);
  return cruise + (hold - cruise) * t;
}
