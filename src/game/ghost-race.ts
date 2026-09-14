import type { GhostLead, GhostPassKind } from "./types";

export type { GhostPassKind };

export type DecisiveLead = "ahead" | "behind";

/** First 280 ms after GO — ghost fades in instead of sitting on the grid car. */
export const GHOST_LIGHTS_FADE_MS = 280;

export const GHOST_PASS_HOLD_MS = 1180;

/** Along-track gap. Positive = ghost ahead. Wraps a closed ribbon. */
export function alongDelta(ghostS: number, playerS: number, length: number, closed: boolean): number {
  let ds = ghostS - playerS;
  if (closed) {
    const L = Math.max(1, length);
    ds = ((ds % L) + L) % L;
    if (ds > L * 0.5) ds -= L;
  }
  return ds;
}

/**
 * TM overlap fade. Neck-and-neck clips the road; drop toward ~0.18 so the
 * racing line stays readable. Far rivals stay at full opacity.
 */
export function ghostProximityMul(ds: number, dn: number): number {
  const along = Math.abs(ds);
  const lat = Math.abs(dn);
  if (along > 14 || lat > 3.4) return 1;
  const a = 1 - Math.max(0, Math.min(1, along / 14));
  const b = 1 - Math.max(0, Math.min(1, lat / 3.4));
  const close = a * b;
  return 1 - close * 0.82;
}

/** Hidden through lights-out, then a short fade-in on GO. */
export function ghostLightsOutMul(countdownS: number | null, raceTimeMs: number): number {
  if (countdownS != null && countdownS > 0) return 0;
  if (!Number.isFinite(raceTimeMs) || raceTimeMs <= 0) return 0;
  if (raceTimeMs >= GHOST_LIGHTS_FADE_MS) return 1;
  return raceTimeMs / GHOST_LIGHTS_FADE_MS;
}

export function ghostLiveOpacity(base: number, proximity: number, lightsOut: number): number {
  const b = Number.isFinite(base) ? base : 0;
  const p = Number.isFinite(proximity) ? proximity : 1;
  const l = Number.isFinite(lightsOut) ? lightsOut : 1;
  return Math.max(0, Math.min(1, b * p * l));
}

/**
 * Toast only when the lead actually flips. First lock (even → behind at
 * lights-out) is silent — that is the author line pulling away, not a pass.
 */
export function ghostPassKind(lastDecisive: DecisiveLead | null, next: GhostLead): GhostPassKind | null {
  if (next !== "ahead" && next !== "behind") return null;
  if (lastDecisive == null) return null;
  if (lastDecisive === "behind" && next === "ahead") return "gained";
  if (lastDecisive === "ahead" && next === "behind") return "lost";
  return null;
}

export function nextDecisiveLead(prev: DecisiveLead | null, lead: GhostLead): DecisiveLead | null {
  if (lead === "ahead" || lead === "behind") return lead;
  return prev;
}

export function ghostPassLabel(kind: GhostPassKind): string {
  return kind === "gained" ? "PASSED" : "OVERTAKEN";
}

export function ghostPassHoldMs(): number {
  return GHOST_PASS_HOLD_MS;
}
