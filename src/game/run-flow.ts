import { ghostRaceSplitMs, ghostTimeAtS } from "./feel.ts";
import type { GhostFrame } from "./types.ts";

/** Per-checkpoint toast: player clock vs PB ghost at the same track-s. Negative = faster than PB. */
export function cpPbSplitMs(
  playerTimeMs: number,
  pbGhost: GhostFrame[] | null | undefined,
  s: number,
  length: number,
  closed: boolean,
): number | null {
  const pbAt = ghostTimeAtS(pbGhost, s, length, closed);
  return ghostRaceSplitMs(playerTimeMs, pbAt);
}

export const RESPAWN_SPEED_MIN = 6;
export const RESPAWN_SPEED_MAX = 38;
export const RESPAWN_SPEED_KEEP = 0.78;

/** TM-style last-CP respawn: keep most pace, clamped — not a flat 9 m/s every time. */
export function respawnKeepSpeed(speed: number): number {
  if (!Number.isFinite(speed)) return 9;
  const mag = Math.abs(speed);
  const kept = mag * RESPAWN_SPEED_KEEP;
  const next = Math.min(RESPAWN_SPEED_MAX, Math.max(RESPAWN_SPEED_MIN, kept));
  return next * Math.sign(speed || 1);
}

/** Pace at respawn: last CP crossing speed; before CP1 the grid respawn is a full stop. */
export function respawnEntrySpeed(lastCp: number, cpCrossSpeed: number): number {
  if (lastCp < 0) return 0;
  if (!Number.isFinite(cpCrossSpeed) || cpCrossSpeed <= 0) return 9;
  return respawnKeepSpeed(cpCrossSpeed);
}

/** Live HUD split vs PB when the racing ghost is not the PB tape. */
export function livePbSplitMs(
  playerTimeMs: number,
  pbGhost: GhostFrame[] | null | undefined,
  s: number,
  length: number,
  closed: boolean,
  racingIsPb: boolean,
): number | null {
  if (racingIsPb) return null;
  return cpPbSplitMs(playerTimeMs, pbGhost, s, length, closed);
}
