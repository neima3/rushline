/**
 * Deterministic remount/hold models for unit tests (pre-fix vs module-backed).
 */

import { RESTART_HOLD_MS } from "./camera.ts";
import {
  resetTouchRespawnGesture,
  touchRespawnHoldRestart,
  touchRespawnPointerDown,
  touchRespawnPointerRelease,
  touchRespawnPointerUp,
} from "./touch-respawn-gesture.ts";

export type GestureSimResult = { restarts: number; respawns: number };

type LegacyMount = { restartFired: boolean; timerDue: number | null };

/**
 * Pre-fix component-only state: remount drops restartFired and always arms a new hold timer.
 */
export function simulateLegacyComponentHold(
  holdMs: number,
  remountAtMs: number,
  releaseAtMs: number,
): GestureSimResult {
  let restarts = 0;
  let respawns = 0;
  let mount: LegacyMount = { restartFired: false, timerDue: holdMs };

  const times = [0, holdMs, remountAtMs, remountAtMs + holdMs, releaseAtMs]
    .filter((t) => t <= releaseAtMs)
    .sort((a, b) => a - b);
  const tick = (t: number) => {
    if (mount.timerDue != null && t >= mount.timerDue) {
      mount.restartFired = true;
      restarts += 1;
      mount.timerDue = null;
    }
    if (t === remountAtMs) {
      mount = { restartFired: false, timerDue: t + holdMs };
    }
    if (t === releaseAtMs && !mount.restartFired) respawns += 1;
  };

  for (const t of times) tick(t);
  return { restarts, respawns };
}

/** Module-backed button: duplicate pointerdown does not arm another timer. */
export function simulateModuleRemountHold(
  pointerId: number,
  holdMs: number,
  remountAtMs: number,
  releaseAtMs: number,
): GestureSimResult {
  resetTouchRespawnGesture();
  let restarts = 0;
  let respawns = 0;
  let timerDue: number | null = holdMs;

  const onDown = (t: number) => {
    if (touchRespawnPointerDown(pointerId) === "duplicate") return;
    timerDue = t + holdMs;
  };

  const times = [0, holdMs, remountAtMs, remountAtMs + holdMs, releaseAtMs]
    .filter((t) => t <= releaseAtMs)
    .sort((a, b) => a - b);
  const tick = (t: number) => {
    if (t === 0) onDown(0);
    if (timerDue != null && t >= timerDue) {
      touchRespawnHoldRestart(pointerId);
      restarts += 1;
      timerDue = null;
    }
    if (t === remountAtMs) onDown(t);
    if (t === releaseAtMs) {
      if (touchRespawnPointerUp(pointerId) === "respawn") respawns += 1;
    }
  };

  for (const t of times) tick(t);
  return { restarts, respawns };
}

export function simulateModuleTap(pointerId: number): GestureSimResult {
  resetTouchRespawnGesture();
  let respawns = 0;
  if (touchRespawnPointerDown(pointerId) === "new") {
    if (touchRespawnPointerUp(pointerId) === "respawn") respawns += 1;
  }
  return { restarts: 0, respawns };
}

/** Hold restart, orphan window release (stuck suppression), then a fresh tap. */
export function simulateStuckThenTap(pointerId: number): GestureSimResult {
  resetTouchRespawnGesture();
  touchRespawnPointerDown(pointerId);
  touchRespawnHoldRestart(pointerId);
  touchRespawnPointerRelease(pointerId);
  return simulateModuleTap(pointerId);
}

export const DEFAULT_HOLD_MS = RESTART_HOLD_MS;
