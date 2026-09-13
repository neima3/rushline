import type { ThemeId } from "./types";

/** Circuit High locks from #19/#21 — this pass must not rewrite them. */
export const CIRCUIT_HIGH_LOCK = {
  sun: 1.08,
  hemi: 0.52,
  exposure: 0.86,
  env: 0.08,
  bloomMul: 0.16,
} as const;

export const HELIX_FOG_LOCK = { near: 88, far: 460 } as const;

/** Car-local paint. Scene env stays 0.08; the body multiplies IBL back up. */
export const CAR_PAINT = {
  roughness: 0.1,
  metalness: 0.5,
  clearcoat: 0.94,
  clearcoatRoughness: 0.04,
  sheen: 0.58,
  sheenRoughness: 0.28,
  iridescence: 0.14,
  envDay: 3.7,
  envCanyon: 1.38,
  envNight: 1.46,
} as const;

/**
 * Midtone-preserving grade. Contrast/sat are applied away from 0.5 luma so
 * Circuit High asphalt does not wash. Vignette is edge-only.
 */
export type GradeLook = {
  vignette: number;
  contrast: number;
  saturation: number;
  tint: number;
};

export const GRADE: Record<ThemeId, GradeLook> = {
  stadium: { vignette: 0.16, contrast: 1.045, saturation: 1.02, tint: 0xffffff },
  canyon: { vignette: 0.26, contrast: 1.07, saturation: 1.08, tint: 0xfff1e4 },
  night: { vignette: 0.3, contrast: 1.08, saturation: 1.1, tint: 0xf2e8ff },
  alpine: { vignette: 0.2, contrast: 1.05, saturation: 0.98, tint: 0xe8f4ff },
};

export type SkyLook = {
  horizon: number;
  zenith: number;
  haze: number;
  sunGlow: number;
};

export const SKY_LOOK: Record<ThemeId, SkyLook> = {
  stadium: { horizon: 0xc8dced, zenith: 0xe8f2fb, haze: 0.22, sunGlow: 0.07 },
  canyon: { horizon: 0xffa060, zenith: 0xffc8a0, haze: 0.52, sunGlow: 0.2 },
  night: { horizon: 0x4a3878, zenith: 0x1a1438, haze: 0.34, sunGlow: 0.05 },
  alpine: { horizon: 0xd4e6f4, zenith: 0xf4f8fc, haze: 0.36, sunGlow: 0.11 },
};

export const GATE_LOOK = {
  startPost: 0xf4f4f2,
  startEmissive: 0xc4a574,
  cpDay: 0xdde8f6,
  cpNight: 0x7ec8ff,
  cpEmissiveDay: 0x2a6ad0,
  cpEmissiveNight: 0x3de8ff,
} as const;
