/** Survives React remounts of the touch respawn button (hold restart → countdown). */

export type TouchRespawnGesture = {
  pointerId: number;
  restartFired: boolean;
};

let active: TouchRespawnGesture | null = null;

export function touchRespawnPointerDown(pointerId: number): void {
  if (active?.pointerId === pointerId) return;
  active = { pointerId, restartFired: false };
}

export function touchRespawnHoldRestart(pointerId: number): void {
  if (!active || active.pointerId !== pointerId) return;
  active.restartFired = true;
}

export function touchRespawnPointerUp(pointerId: number): "respawn" | "none" {
  const g = active;
  if (!g || g.pointerId !== pointerId) {
    return "none";
  }
  active = null;
  return g.restartFired ? "none" : "respawn";
}

/** True while a hold-restart fired and the finger is still down (blocks stray respawn()). */
export function touchRespawnSuppressed(): boolean {
  return active?.restartFired === true;
}

export function resetTouchRespawnGesture(): void {
  active = null;
}

/** Test-only */
export function peekTouchRespawnGesture(): TouchRespawnGesture | null {
  return active;
}
