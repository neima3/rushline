import type { TrackAssist } from "./settings";
import type { Medal, TrackId } from "./types";

export type { TrackAssist };

/** Multipliers on the shipped phone (Medium) racing-line assists. */
export type TrackAssistScale = {
  heading: number;
  plant: number;
  curbPull: number;
  curbHeading: number;
};

export function trackAssistScale(level: TrackAssist = "medium"): TrackAssistScale {
  switch (level) {
    case "off":
      return { heading: 0, plant: 0, curbPull: 0, curbHeading: 0 };
    case "low":
      return { heading: 0.4, plant: 0.35, curbPull: 0.4, curbHeading: 0.35 };
    case "high":
      return { heading: 1.5, plant: 1.65, curbPull: 1.55, curbHeading: 1.45 };
    default:
      return { heading: 1, plant: 1, curbPull: 1, curbHeading: 1 };
  }
}

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

/** Shared steer curve. Deadzone kept; mid-lock a hair more linear. */
export function steerCurve(x: number) {
  const s = Math.sign(x);
  const a = Math.abs(x);
  if (a < 0.06) return 0;
  return s * (a * a * 0.22 + a * 0.78);
}

/**
 * Heading return. Release snaps the nose back; light steer bleeds residual
 * yaw so the car does not keep sliding after a thumb twitch.
 */
export function headingAlign(steerAbs: number, drifting: boolean, assist: TrackAssist = "medium"): number {
  const k = trackAssistScale(assist).heading;
  if (k <= 0) return 0;
  if (drifting) return 0.26 * k;
  if (steerAbs < 0.08) return 8.4 * k;
  if (steerAbs < 0.22) return 1.35 * k;
  return 0.12 * k;
}

/**
 * Always-on straighten when Track Assist is Off. Medium/High already snap
 * via headingAlign — do not stack, so the shipped phone line stays put.
 */
export function residualAlign(steerAbs: number, drifting: boolean, assist: TrackAssist = "medium"): number {
  if (trackAssistScale(assist).heading > 0) return 0;
  if (drifting) return 0.1;
  if (steerAbs < 0.08) return 3.4;
  if (steerAbs < 0.22) return 0.7;
  return 0.06;
}

export function headingReturn(steerAbs: number, drifting: boolean, assist: TrackAssist = "medium"): number {
  return residualAlign(steerAbs, drifting, assist) + headingAlign(steerAbs, drifting, assist);
}

/** Chase yaw settle. Idle (released steer) damps residual swing; steering lags. */
export function camFwdRate(steerAbs: number, headingAbs: number, airborne: boolean): number {
  if (airborne) return 3.4;
  if (steerAbs < 0.08 && headingAbs < 0.16) return 11.2;
  if (steerAbs < 0.08) return 8.6;
  return 6.6;
}

export function camFollowRate(airborne: boolean, hood: boolean, boost: number): number {
  if (hood) return 14;
  return (airborne ? 8.8 : 11.2) + (boost > 0.05 ? 1.8 : 0);
}

export function camLookAhead(speed: number, boost: number, airborne: boolean): number {
  return 12 + speed * 0.12 + (boost > 0.05 ? 2.6 : 0) - (airborne ? 1.15 : 0);
}

export function camFovTarget(baseFov: number, speed: number, boost: number, landJuice: number): number {
  const kick = (boost > 0 ? 4.6 : 0) + landJuice * -2.1;
  return clamp(baseFov - 4 + speed * 0.15 + kick, baseFov - 6, baseFov + 9);
}

export function camBoostPull(boost: number): number {
  return boost > 0.05 ? 0.48 + boost * 0.22 : 0;
}

export function camLandDrop(landJuice: number): number {
  return landJuice * 0.58;
}

/** Ghost gap in ms. Positive = ghost ahead (you are behind). */
export function ghostSplitMs(ghostS: number, playerS: number, speed: number, length: number, closed: boolean): number {
  let ds = ghostS - playerS;
  if (closed) {
    const L = length || 1;
    ds = ((ds % L) + L) % L;
    if (ds > L * 0.5) ds -= L;
  }
  return (ds / Math.max(10, Math.abs(speed))) * 1000;
}

export function driftSteerThreshold(slideHeld: boolean): number {
  return slideHeld ? 0.26 : 1;
}

/** After a plant, bleed steer so the nose does not flick off the ribbon. */
export function landSteerScale(landLock: number): number {
  if (landLock <= 0) return 1;
  return 0.52 + 0.48 * (1 - Math.min(1, landLock / 0.2));
}

/** Air yaw — a bit more than ground so you can line up Ridge / Helix landings. */
export function airTurnRate(): number {
  return 2.12;
}

/** Trackmania-style air pitch: throttle dives, brake lifts. */
export function airPitchAccel(throttle: number, brake: number): number {
  return Math.max(0, throttle) * 10.5 - Math.max(0, brake) * 12;
}

/** Speed keep on landing. Magnet used to dump ~28%; keep the run alive. */
export function landSpeedKeep(impact: number, magnet: boolean): number {
  if (magnet) return 0.94;
  return 0.992 - Math.min(0.07, Math.max(0, impact) * 0.0055);
}

/** Near-miss settle height. Old 2.1 m teleport felt like a rubber band. */
export function magnetLandHeight(): number {
  return 0.9;
}

export function canLandWindow(): { min: number; max: number } {
  return { min: -0.28, max: 1.02 };
}

export function landLockTime(impact: number, magnet: boolean): number {
  if (magnet) return 0.16;
  return 0.15 + Math.min(0.08, Math.max(0, impact) * 0.006);
}

export function boostPadPunch(): number {
  return 5;
}

/** Spread the pad hit over a couple of frames so squat / burst match the speed. */
export function boostPunchWindow(): number {
  return 0.05;
}

export function medalPaceLabel(medal: Medal | null): string {
  if (medal === "author") return "AUTH";
  if (medal === "gold") return "GOLD";
  if (medal === "silver") return "SILV";
  if (medal === "bronze") return "BRNZ";
  return "OUT";
}

/** Compact remain for the HUD chip — 6.2, not 0:06.200. */
export function formatPaceRemain(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const sec = ms / 1000;
  if (sec >= 60) {
    const m = Math.floor(sec / 60);
    const s = sec - m * 60;
    return `${m}:${s.toFixed(1).padStart(4, "0")}`;
  }
  return sec.toFixed(1);
}

export function stayPlanted(trackId: TrackId, s: number, assist: TrackAssist = "medium"): boolean {
  if (trackAssistScale(assist).plant <= 0) return false;
  return trackId === "canyon" && s < CANYON_PLANT_S;
}

export function openingLandLock(trackId: TrackId, assist: TrackAssist = "medium"): number {
  if (trackId !== "canyon") return 0;
  return 1.85 * trackAssistScale(assist).plant;
}

export function openingHeadingBleed(
  trackId: TrackId,
  s: number,
  steerAbs: number,
  drifting: boolean,
  assist: TrackAssist = "medium",
): number {
  const k = trackAssistScale(assist).heading;
  if (k <= 0 || drifting) return 0;
  if (trackId === "canyon" && s < CANYON_PLANT_S && steerAbs < 0.28) return 3.6 * k;
  if (s < 72 && steerAbs < 0.22) return 2.2 * k;
  return 0;
}

/** Nudge Ridge opening back to the racing line unless the player is steering. */
export function plantLateral(
  n: number,
  trackId: TrackId,
  s: number,
  steerAbs: number,
  dt: number,
  assist: TrackAssist = "medium",
): number {
  if (trackId !== "canyon" || s >= 110 || steerAbs > 0.2) return n;
  const k = trackAssistScale(assist).plant;
  if (k <= 0) return n;
  return n * (1 - Math.min(1, 1.9 * k * dt));
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
  assist?: TrackAssist;
}): { n: number; heading: number; hit: boolean; early: boolean } {
  if (input.trackId === "helix") {
    return { n: input.n, heading: input.heading, hit: false, early: false };
  }
  const scale = trackAssistScale(input.assist ?? "medium");
  if (scale.curbPull <= 0 && scale.curbHeading <= 0) {
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
  const pull = Math.min(over + 0.06, early ? 0.48 : 0.24) * scale.curbPull;
  const sign = Math.sign(input.n) || 1;
  let n = input.n - sign * pull;
  if (Math.abs(n) > wall) n = sign * (wall - 0.05);
  let heading = input.heading + sign * (early ? 0.2 : 0.1) * scale.curbHeading;
  if (early) heading *= 1 - 0.22 * scale.curbHeading;
  return { n, heading, hit: true, early };
}

export function blendHold(speed: number, trip: number, cruise: number, hold: number, span = 5): number {
  if (speed <= trip) return cruise;
  const t = smoothstep((speed - trip) / span);
  return cruise + (hold - cruise) * t;
}
