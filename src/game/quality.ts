/** Graphics quality knobs — scene contract for Settings PR #17.
 *
 * Options UI is Settings-only. This module does not render a panel.
 *
 * Store key: `rushline-settings-v1`
 * Fields we read: `quality`, `shadows`, `bloom`
 * Tier cost we apply: `particleDensity`, `dprCap`, `fogNearMul`, `fogFarMul`, `shadowMap`
 *
 * Scene API (`Game` / `World`):
 *   applySettings(s)          full Settings-shaped slice
 *   setQuality / setShadows / setBloom
 *   setFogEnabled / setFogDensity(nearMul, farMul?)
 *   setPixelRatioCap
 *   getGraphics()             shadows, bloom, dprCap, fogEnabled, fogNearMul/Far, fogNear/Far
 *
 * Helix Night fog stays near 88 / far 460 — never tighten.
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

/** Duck-typed slice of Settings PR #17 `Settings` + `qualityProfile`. */
export type GraphicsKnobs = {
  quality: QualityTier;
  shadows: boolean;
  bloom: boolean;
  particleDensity?: number;
  dprCap?: number;
  fogNearMul?: number;
  fogFarMul?: number;
  cameraFar?: number;
  fogEnabled?: boolean;
};

export const SETTINGS_KEY = "rushline-settings-v1";
export const NIGHT_FOG = { near: 88, far: 460 } as const;
export const DAY_FOG = { near: 80, far: 440 } as const;

/** Settings #17 tier cost — particles / DPR / day fog scale. Night fog ignores muls. */
export const SETTINGS_TIER_COST: Record<
  QualityTier,
  { particleDensity: number; dprCap: number; fogNearMul: number; fogFarMul: number; shadowMap: number; cameraFar: number }
> = {
  low: { particleDensity: 0.22, dprCap: 1, fogNearMul: 0.52, fogFarMul: 0.5, shadowMap: 512, cameraFar: 280 },
  medium: { particleDensity: 0.55, dprCap: 1.5, fogNearMul: 0.78, fogFarMul: 0.72, shadowMap: 1024, cameraFar: 520 },
  high: { particleDensity: 1, dprCap: 2, fogNearMul: 1, fogFarMul: 1, shadowMap: 1536, cameraFar: 900 },
};

/** Mirrors Settings #17 `qualityProfile` for shadows / bloom / particles / DPR. */
export const QUALITY_PRESETS: Record<QualityTier, QualityProfile> = {
  low: {
    tier: "low",
    sparkScale: 0.22,
    smokeScale: 0.22,
    shadowMap: 512,
    shadows: false,
    bloom: false,
    bloomStrength: 0,
    bloomRadius: 0.2,
    bloomThreshold: 0.95,
    pixelRatioCap: 1,
    environment: false,
    nightFills: false,
  },
  medium: {
    tier: "medium",
    sparkScale: 0.55,
    smokeScale: 0.55,
    shadowMap: 1024,
    shadows: true,
    bloom: false,
    bloomStrength: 0.12,
    bloomRadius: 0.28,
    bloomThreshold: 0.9,
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
    bloomStrength: 0.16,
    bloomRadius: 0.3,
    bloomThreshold: 0.88,
    pixelRatioCap: 2,
    environment: true,
    nightFills: true,
  },
};

/** Force a tier in preview. Leave `null` for saved / auto. */
export const QUALITY_OVERRIDE: QualityTier | null = null;

const QUALITY_KEY = "rushline-quality";

function asTier(v: unknown): QualityTier | null {
  return v === "low" || v === "medium" || v === "high" ? v : null;
}

/** Helix Night stays 88/460. Day themes may scale. Disable pushes day fog out, not night. */
export function fogWindow(
  theme: "stadium" | "canyon" | "night",
  knobs?: Pick<GraphicsKnobs, "fogNearMul" | "fogFarMul" | "fogEnabled">,
) {
  if (theme === "night") return { near: NIGHT_FOG.near, far: NIGHT_FOG.far };
  if (knobs?.fogEnabled === false) return { near: 2000, far: 4000 };
  return {
    near: DAY_FOG.near * (knobs?.fogNearMul ?? 1),
    far: DAY_FOG.far * (knobs?.fogFarMul ?? 1),
  };
}

export type ThemeLightLevels = {
  sun: number;
  hemi: number;
  exposure: number;
  env: number;
  bloomMul: number;
  bloomThreshold: number;
};

/**
 * Per-theme light / bloom. Green Circuit (stadium) pulls Medium/High so
 * asphalt + car stay readable (#19/#21). Ridge dusk is a hair lower than
 * the old #16 punch so it shares an exposure range with Circuit High.
 * Helix Night sun/hemi/exposure + 88/460 fog stay locked.
 * High Circuit env stays 0.08 — sky IBL may replace the studio room.
 */
export function themeLightLevels(
  theme: "stadium" | "canyon" | "night",
  quality: Pick<QualityProfile, "tier" | "environment" | "bloomThreshold">,
): ThemeLightLevels {
  if (theme === "night") {
    return {
      sun: 0.95,
      hemi: 1.32,
      exposure: 1.24,
      env: 0.28,
      bloomMul: 1,
      bloomThreshold: Math.min(quality.bloomThreshold, 0.8),
    };
  }
  if (theme === "canyon") {
    // Dusk stays warm, but sits closer to pulled Circuit High so the three
    // themes share one exposure range instead of Ridge blowing out.
    return {
      sun: 1.44,
      hemi: 0.76,
      exposure: 1.0,
      env: quality.environment ? 0.32 : 0,
      bloomMul: 0.48,
      bloomThreshold: Math.max(quality.bloomThreshold, 0.92),
    };
  }
  const high = quality.tier === "high";
  const med = quality.tier === "medium";
  return {
    sun: high ? 1.08 : med ? 1.22 : 1.36,
    hemi: high ? 0.52 : med ? 0.64 : 0.74,
    exposure: high ? 0.86 : med ? 0.94 : 1.02,
    env: quality.environment ? (high ? 0.08 : 0.12) : 0,
    bloomMul: high ? 0.16 : 0.32,
    bloomThreshold: Math.max(quality.bloomThreshold, high ? 0.96 : 0.93),
  };
}

export function readSettingsGraphics(): GraphicsKnobs | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Record<string, unknown>;
    const quality = asTier(o.quality);
    if (!quality) return null;
    const cost = SETTINGS_TIER_COST[quality];
    return {
      quality,
      shadows: typeof o.shadows === "boolean" ? o.shadows : QUALITY_PRESETS[quality].shadows,
      bloom: typeof o.bloom === "boolean" ? o.bloom : QUALITY_PRESETS[quality].bloom,
      particleDensity: cost.particleDensity,
      dprCap: cost.dprCap,
      fogNearMul: cost.fogNearMul,
      fogFarMul: cost.fogFarMul,
      cameraFar: cost.cameraFar,
    };
  } catch {
    return null;
  }
}

export function readSavedQuality(): QualityTier | null {
  if (QUALITY_OVERRIDE) return QUALITY_OVERRIDE;
  const fromSettings = readSettingsGraphics();
  if (fromSettings) return fromSettings.quality;
  if (typeof localStorage === "undefined") return null;
  try {
    return asTier(localStorage.getItem(QUALITY_KEY));
  } catch {
    return null;
  }
}

export function writeSavedQuality(tier: QualityTier) {
  try {
    localStorage.setItem(QUALITY_KEY, tier);
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const o = JSON.parse(raw) as Record<string, unknown>;
      o.quality = tier;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(o));
    }
  } catch {
    /* quota */
  }
}

export function cycleQuality(tier: QualityTier): QualityTier {
  return tier === "low" ? "medium" : tier === "medium" ? "high" : "low";
}

export function detectQuality(): QualityTier {
  if (QUALITY_OVERRIDE) return QUALITY_OVERRIDE;
  const saved = readSavedQuality();
  if (saved) return saved;
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

export function applyGraphicsKnobs(base: QualityProfile, knobs: GraphicsKnobs): QualityProfile {
  const density = knobs.particleDensity;
  return {
    ...base,
    tier: knobs.quality,
    shadows: knobs.shadows,
    bloom: knobs.bloom,
    sparkScale: density ?? base.sparkScale,
    smokeScale: density ?? base.smokeScale,
    pixelRatioCap: knobs.dprCap ?? base.pixelRatioCap,
    shadowMap: SETTINGS_TIER_COST[knobs.quality].shadowMap,
    nightFills: knobs.quality !== "low",
    environment: knobs.quality !== "low" && knobs.bloom,
  };
}

export function resolveQuality(tier?: QualityTier | null): QualityProfile {
  const knobs = typeof localStorage !== "undefined" ? readSettingsGraphics() : null;
  const t = tier ?? knobs?.quality ?? detectQuality();
  const base = QUALITY_PRESETS[t];
  if (knobs) return applyGraphicsKnobs(base, knobs);
  return base;
}

/** Visual curb contact — car is clamped ~0.72m inside the ribbon edge. */
export function isOnCurb(n: number, width: number, airborne: boolean) {
  if (airborne) return false;
  return Math.abs(n) > width * 0.5 - 1.05;
}
