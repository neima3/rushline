/** Graphics quality preset.
 *
 * Settings PR: persist a user tier and call `Game.setQuality(tier)` /
 * `World.setQuality(tier)`. Until that lands, `QUALITY_OVERRIDE` is the
 * single hook — leave `null` for auto (High on desktop, Medium on
 * coarse/narrow, Low when the UA asks to save data).
 */
export type QualityTier = "low" | "medium" | "high";

export type QualityProfile = {
  tier: QualityTier;
  /** 0–1 multiplier for spark / trail spawn counts. */
  sparkScale: number;
  /** 0–1 multiplier for tire-smoke spawn counts. */
  smokeScale: number;
  shadowMap: number;
  shadows: boolean;
  bloom: boolean;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  pixelRatioCap: number;
  environment: boolean;
  nightFills: boolean;
};

export const QUALITY_PRESETS: Record<QualityTier, QualityProfile> = {
  low: {
    tier: "low",
    sparkScale: 0.32,
    smokeScale: 0.22,
    shadowMap: 512,
    shadows: false,
    bloom: false,
    bloomStrength: 0,
    bloomRadius: 0.2,
    bloomThreshold: 0.95,
    pixelRatioCap: 1.2,
    environment: false,
    nightFills: false,
  },
  medium: {
    tier: "medium",
    sparkScale: 0.62,
    smokeScale: 0.55,
    shadowMap: 1024,
    shadows: true,
    bloom: true,
    bloomStrength: 0.16,
    bloomRadius: 0.32,
    bloomThreshold: 0.86,
    pixelRatioCap: 1.5,
    environment: true,
    nightFills: true,
  },
  high: {
    tier: "high",
    sparkScale: 1,
    smokeScale: 1,
    shadowMap: 1536,
    shadows: true,
    bloom: true,
    bloomStrength: 0.24,
    bloomRadius: 0.4,
    bloomThreshold: 0.8,
    pixelRatioCap: 2,
    environment: true,
    nightFills: true,
  },
};

/** Settings PR: set to `"low" | "medium" | "high"` to force a tier. */
export const QUALITY_OVERRIDE: QualityTier | null = null;

export function detectQuality(): QualityTier {
  if (QUALITY_OVERRIDE) return QUALITY_OVERRIDE;
  if (typeof window === "undefined" || typeof navigator === "undefined") return "high";
  const saveData = "connection" in navigator && (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  if (saveData) return "low";
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.innerWidth < 720;
  const cores = navigator.hardwareConcurrency || 8;
  if ((coarse || narrow) && cores <= 4) return "low";
  if (coarse || narrow) return "medium";
  return "high";
}

export function resolveQuality(tier?: QualityTier | null): QualityProfile {
  return QUALITY_PRESETS[tier ?? detectQuality()];
}

/** Visual curb contact — car is clamped ~0.72m inside the ribbon edge. */
export function isOnCurb(n: number, width: number, airborne: boolean) {
  if (airborne) return false;
  return Math.abs(n) > width * 0.5 - 1.05;
}
