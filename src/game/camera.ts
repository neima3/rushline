import type { CameraMode } from "./types";

export const CAMERA_MODES = ["chase", "far", "hood", "cockpit"] as const;

export const CAMERA_LABELS: Record<CameraMode, string> = {
  chase: "Chase",
  far: "Far",
  hood: "Hood",
  cockpit: "Cabin",
};

export function isCameraMode(v: unknown): v is CameraMode {
  return v === "chase" || v === "far" || v === "hood" || v === "cockpit";
}

export function nextCamera(mode: CameraMode): CameraMode {
  const i = CAMERA_MODES.indexOf(mode);
  return CAMERA_MODES[(i < 0 ? 0 : i + 1) % CAMERA_MODES.length]!;
}

export function cameraLabel(mode: CameraMode): string {
  return CAMERA_LABELS[mode] ?? CAMERA_LABELS.chase;
}

export function isCloseCam(mode: CameraMode): boolean {
  return mode === "hood" || mode === "cockpit";
}

export function isChaseCam(mode: CameraMode): boolean {
  return mode === "chase" || mode === "far";
}

/** Hold R / Y this long to restart the run instead of sitting on last CP. */
export const RESTART_HOLD_MS = 550;

export type RespawnHold = {
  startedAt: number;
  restartFired: boolean;
};

export function emptyRespawnHold(): RespawnHold {
  return { startedAt: 0, restartFired: false };
}

/**
 * Tap R/Y still edges as last-CP respawn. Crossing the hold threshold
 * fires a one-shot full restart without waiting for release.
 */
export function stepRespawnHold(
  held: boolean,
  now: number,
  prev: RespawnHold,
  threshold = RESTART_HOLD_MS,
): { next: RespawnHold; fireRestart: boolean } {
  if (!held) return { next: emptyRespawnHold(), fireRestart: false };
  const startedAt = prev.startedAt > 0 ? prev.startedAt : now;
  const due = !prev.restartFired && now - startedAt >= threshold;
  return {
    next: { startedAt, restartFired: prev.restartFired || due },
    fireRestart: due,
  };
}

export type CamOffsets = {
  dist: number;
  lift: number;
  look: number;
  lookY: number;
  hideCar: boolean;
};

/** Snap-frame offsets. Far is a longer chase; cabin sits in the glass. */
export function camSnapOffsets(
  mode: CameraMode,
  helix: boolean,
  portrait: boolean,
  chaseDistance: number,
): CamOffsets {
  if (mode === "cockpit") {
    return { dist: 0.16, lift: portrait ? 0.8 : 0.7, look: 11, lookY: 0.22, hideCar: true };
  }
  if (mode === "hood") {
    return { dist: 0.52, lift: portrait ? 1.4 : 1.18, look: 12, lookY: 0.7, hideCar: false };
  }
  const far = mode === "far";
  const base = (helix ? 4.6 : 6.8) + (portrait ? 0.35 : 0);
  const dist = base * chaseDistance * (far ? 1.58 : 1);
  const lift = (portrait ? (helix ? 4.35 : 3.7) : helix ? 3.8 : 2.55) + (far ? 1.45 : 0);
  return { dist, lift, look: far ? 14 : 12, lookY: 0.7, hideCar: false };
}

export function camLiveFollow(mode: CameraMode, airborne: boolean, boost: number): number {
  if (mode === "cockpit") return 16;
  if (mode === "hood") return 14;
  const far = mode === "far";
  return (airborne ? 8.8 : far ? 9.4 : 11.2) + (boost > 0.05 ? 1.8 : 0);
}

export function camLiveLook(mode: CameraMode, speed: number, boost: number, airborne: boolean): number {
  const base = 12 + speed * 0.12 + (boost > 0.05 ? 2.6 : 0) - (airborne ? 1.15 : 0);
  if (mode === "far") return base * 1.18;
  if (mode === "cockpit") return 11 + speed * 0.08 + (boost > 0.05 ? 1.4 : 0);
  if (mode === "hood") return 16;
  return base;
}
