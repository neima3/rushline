export const SETTINGS_KEY = "rushline-settings-v1";

export type Quality = "low" | "medium" | "high";

export const TRACK_ASSIST_LEVELS = ["off", "low", "medium", "high"] as const;
export type TrackAssist = (typeof TRACK_ASSIST_LEVELS)[number];

export type Settings = {
  quality: Quality;
  shadows: boolean;
  bloom: boolean;
  motionBlur: boolean;
  showFps: boolean;
  master: number;
  sfx: number;
  music: number;
  chaseDistance: number;
  fov: number;
  cameraShake: number;
  touchSteerSensitivity: number;
  trackAssist: TrackAssist;
  autoThrottle: boolean;
  invertSteer: boolean;
  showSpeed: boolean;
  showMinimap: boolean;
  ghostOpacity: number;
};

export type QualityProfile = {
  shadows: boolean;
  bloom: boolean;
  motionBlur: boolean;
  shadowMap: number;
  particleDensity: number;
  dprCap: number;
  fogNearMul: number;
  fogFarMul: number;
  cameraFar: number;
};

const QUALITY: Record<Quality, QualityProfile> = {
  low: {
    shadows: false,
    bloom: false,
    motionBlur: false,
    shadowMap: 512,
    particleDensity: 0.22,
    dprCap: 1,
    fogNearMul: 0.52,
    fogFarMul: 0.5,
    cameraFar: 280,
  },
  medium: {
    shadows: true,
    bloom: false,
    motionBlur: false,
    shadowMap: 1024,
    particleDensity: 0.55,
    dprCap: 1.5,
    fogNearMul: 0.78,
    fogFarMul: 0.72,
    cameraFar: 520,
  },
  high: {
    shadows: true,
    bloom: true,
    motionBlur: false,
    shadowMap: 1536,
    particleDensity: 1,
    dprCap: 2,
    fogNearMul: 1,
    fogFarMul: 1,
    cameraFar: 900,
  },
};

export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768;
}

export function qualityProfile(q: Quality): QualityProfile {
  return QUALITY[q];
}

export function defaultSettings(touch = false): Settings {
  const quality: Quality = touch ? "medium" : "high";
  const q = QUALITY[quality];
  return {
    quality,
    shadows: q.shadows,
    bloom: q.bloom,
    motionBlur: q.motionBlur,
    showFps: false,
    master: 0.8,
    sfx: 0.9,
    music: 0.42,
    chaseDistance: 1,
    fov: 58,
    cameraShake: 1,
    touchSteerSensitivity: 1,
    trackAssist: touch ? "medium" : "off",
    autoThrottle: touch,
    invertSteer: false,
    showSpeed: true,
    showMinimap: true,
    ghostOpacity: 0.46,
  };
}

export function applyQuality(s: Settings, quality: Quality): Settings {
  const q = QUALITY[quality];
  return {
    ...s,
    quality,
    shadows: q.shadows,
    bloom: q.bloom,
    motionBlur: q.motionBlur,
  };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function num(v: unknown, fallback: number, lo: number, hi: number) {
  return typeof v === "number" && Number.isFinite(v) ? clamp(v, lo, hi) : fallback;
}

function bool(v: unknown, fallback: boolean) {
  return typeof v === "boolean" ? v : fallback;
}

export function isTrackAssist(v: unknown): v is TrackAssist {
  return v === "off" || v === "low" || v === "medium" || v === "high";
}

export function parseSettings(raw: unknown, touch = false): Settings {
  const base = defaultSettings(touch);
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const quality: Quality = o.quality === "low" || o.quality === "medium" || o.quality === "high" ? o.quality : base.quality;
  return {
    quality,
    shadows: bool(o.shadows, QUALITY[quality].shadows),
    bloom: bool(o.bloom, QUALITY[quality].bloom),
    motionBlur: bool(o.motionBlur, QUALITY[quality].motionBlur),
    showFps: bool(o.showFps, base.showFps),
    master: num(o.master, base.master, 0, 1),
    sfx: num(o.sfx, base.sfx, 0, 1),
    music: num(o.music, base.music, 0, 1),
    chaseDistance: num(o.chaseDistance, base.chaseDistance, 0.7, 1.45),
    fov: num(o.fov, base.fov, 50, 78),
    cameraShake: num(o.cameraShake, base.cameraShake, 0, 1.5),
    touchSteerSensitivity: num(o.touchSteerSensitivity, base.touchSteerSensitivity, 0.45, 2),
    trackAssist: isTrackAssist(o.trackAssist) ? o.trackAssist : base.trackAssist,
    autoThrottle: bool(o.autoThrottle, base.autoThrottle),
    invertSteer: bool(o.invertSteer, base.invertSteer),
    showSpeed: bool(o.showSpeed, base.showSpeed),
    showMinimap: bool(o.showMinimap, base.showMinimap),
    ghostOpacity: num(o.ghostOpacity, base.ghostOpacity, 0, 1),
  };
}

export function loadSettings(touch = isTouchDevice()): Settings {
  if (typeof window === "undefined") return defaultSettings(touch);
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      const fresh = defaultSettings(touch);
      persistSettings(fresh);
      return fresh;
    }
    return parseSettings(JSON.parse(raw), touch);
  } catch {
    return defaultSettings(touch);
  }
}

export function persistSettings(s: Settings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* quota */
  }
}

export function applySteerSettings(
  keyboardSteer: number,
  padSteer: number,
  touchSteer: number,
  opts: { sensitivity: number; invert: boolean },
): number {
  let steer = keyboardSteer + padSteer + touchSteer * opts.sensitivity;
  steer = Math.max(-1, Math.min(1, steer));
  return opts.invert ? -steer : steer;
}
