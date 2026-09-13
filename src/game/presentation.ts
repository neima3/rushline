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
  envMesa: 1.62,
  envGrove: 1.38,
  envEmber: 1.48,
  envStorm: 1.52,
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
  works: { vignette: 0.24, contrast: 1.065, saturation: 1.06, tint: 0xffe4c8 },
  mesa: { vignette: 0.22, contrast: 1.06, saturation: 1.12, tint: 0xfff0c4 },
  grove: { vignette: 0.28, contrast: 1.06, saturation: 0.98, tint: 0xd8f4e4 },
  ember: { vignette: 0.26, contrast: 1.075, saturation: 1.14, tint: 0xffd8b0 },
  storm: { vignette: 0.3, contrast: 1.07, saturation: 0.96, tint: 0xc8dcec },
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
  works: { horizon: 0xff8a48, zenith: 0x2a3040, haze: 0.42, sunGlow: 0.18 },
  mesa: { horizon: 0xffd070, zenith: 0xffe8b4, haze: 0.46, sunGlow: 0.28 },
  grove: { horizon: 0x2e5a42, zenith: 0x14281c, haze: 0.5, sunGlow: 0.09 },
  ember: { horizon: 0xff7040, zenith: 0x3a1420, haze: 0.54, sunGlow: 0.24 },
  storm: { horizon: 0x6a8498, zenith: 0x1a2430, haze: 0.56, sunGlow: 0.06 },
};

export const GATE_LOOK = {
  startPost: 0xf4f4f2,
  startEmissive: 0xc4a574,
  cpDay: 0xdde8f6,
  cpNight: 0x7ec8ff,
  cpEmissiveDay: 0x2a6ad0,
  cpEmissiveNight: 0x3de8ff,
} as const;
