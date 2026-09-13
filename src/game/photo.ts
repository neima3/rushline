import type { GhostFrame, TrackId } from "./types";

export type PhotoOrbit = {
  yaw: number;
  pitch: number;
  zoom: number;
};

export type PhotoVec3 = { x: number; y: number; z: number };

export type PhotoPose = {
  cam: PhotoVec3;
  look: PhotoVec3;
};

export const PHOTO_PITCH_MIN = -0.08;
export const PHOTO_PITCH_MAX = 1.18;
export const PHOTO_ZOOM_MIN = 0.52;
export const PHOTO_ZOOM_MAX = 2.55;
export const PHOTO_YAW_RATE = 1.55;
export const PHOTO_PITCH_RATE = 0.95;
export const PHOTO_ZOOM_RATE = 0.85;
export const PHOTO_DRAG_YAW = 0.0054;
export const PHOTO_DRAG_PITCH = 0.0038;

export function defaultPhotoOrbit(): PhotoOrbit {
  return { yaw: 0, pitch: 0.36, zoom: 1 };
}

export function clampPhotoOrbit(orbit: PhotoOrbit): PhotoOrbit {
  let yaw = orbit.yaw;
  if (!Number.isFinite(yaw)) yaw = 0;
  while (yaw > Math.PI) yaw -= Math.PI * 2;
  while (yaw < -Math.PI) yaw += Math.PI * 2;
  return {
    yaw,
    pitch: clamp(orbit.pitch, PHOTO_PITCH_MIN, PHOTO_PITCH_MAX),
    zoom: clamp(orbit.zoom, PHOTO_ZOOM_MIN, PHOTO_ZOOM_MAX),
  };
}

export function nudgePhotoOrbit(orbit: PhotoOrbit, dyaw: number, dpitch: number, dzoom = 0): PhotoOrbit {
  return clampPhotoOrbit({
    yaw: orbit.yaw + (Number.isFinite(dyaw) ? dyaw : 0),
    pitch: orbit.pitch + (Number.isFinite(dpitch) ? dpitch : 0),
    zoom: orbit.zoom + (Number.isFinite(dzoom) ? dzoom : 0),
  });
}

/** Chase-style orbit. yaw=0 sits behind the car; +yaw orbits to the car's left. */
export function photoOrbitPose(
  target: PhotoVec3,
  forward: PhotoVec3,
  orbit: PhotoOrbit,
  chaseDistance = 1,
): PhotoPose {
  const o = clampPhotoOrbit(orbit);
  const fl = Math.hypot(forward.x, forward.z);
  const nx = fl > 1e-6 ? forward.x / fl : 0;
  const nz = fl > 1e-6 ? forward.z / fl : -1;
  const c = Math.cos(o.yaw);
  const s = Math.sin(o.yaw);
  const backX = -nx;
  const backZ = -nz;
  const rx = backX * c - backZ * s;
  const rz = backX * s + backZ * c;
  const horiz = Math.cos(o.pitch);
  const lift = Math.sin(o.pitch);
  const dist = (6.45 * clamp(chaseDistance, 0.7, 1.45)) * o.zoom;
  const lookY = target.y + 0.58;
  return {
    cam: {
      x: target.x + rx * dist * horiz,
      y: target.y + 1.15 + dist * lift,
      z: target.z + rz * dist * horiz,
    },
    look: { x: target.x, y: lookY, z: target.z },
  };
}

export function ghostScrubSpan(frames: GhostFrame[] | null | undefined): { start: number; end: number } | null {
  if (!frames || frames.length < 2) return null;
  const start = frames[0]!.t;
  const end = frames[frames.length - 1]!.t;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return { start, end };
}

export function ghostScrubTime(frames: GhostFrame[] | null | undefined, u: number): number | null {
  const span = ghostScrubSpan(frames);
  if (!span) return null;
  const t = clamp(u, 0, 1);
  return span.start + (span.end - span.start) * t;
}

export function stillFilename(trackId: TrackId | string, at = new Date()): string {
  const id = String(trackId || "track").replace(/[^a-z0-9_-]+/gi, "") || "track";
  const pad = (n: number) => n.toString().padStart(2, "0");
  const stamp = `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}-${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`;
  return `rushline-${id}-${stamp}.png`;
}

export function canvasToPngBlob(canvas: HTMLCanvasElement | null | undefined): Promise<Blob | null> {
  if (!canvas || typeof canvas.toBlob !== "function") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob && blob.size > 0 ? blob : null), "image/png");
    } catch {
      resolve(null);
    }
  });
}

export function downloadBlob(blob: Blob, filename: string): boolean {
  if (typeof document === "undefined" || typeof URL === "undefined") return false;
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    return true;
  } catch {
    return false;
  }
}

function clamp(n: number, lo: number, hi: number) {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
