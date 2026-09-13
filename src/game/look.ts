import type { SurfaceKind, ThemeId } from "./types";

/** Albedo multipliers on the ribbon. Stadium stays charcoal so High-quality
 *  day lights (#19/#21) do not wash the midtones into the grass. */
export const ROAD_TINT: Record<ThemeId, { r: number; g: number; b: number }> = {
  stadium: { r: 0.68, g: 0.69, b: 0.72 },
  canyon: { r: 0.24, g: 0.21, b: 0.18 },
  night: { r: 0.3, g: 0.32, b: 0.44 },
  alpine: { r: 0.58, g: 0.64, b: 0.74 },
  works: { r: 0.26, g: 0.24, b: 0.22 },
  mesa: { r: 0.46, g: 0.34, b: 0.22 },
  grove: { r: 0.2, g: 0.26, b: 0.22 },
  ember: { r: 0.42, g: 0.2, b: 0.16 },
  storm: { r: 0.28, g: 0.32, b: 0.36 },
};

/** Canvas asphalt base RGB — stadium midtones stay below washed gray (~158). */
export const ASPHALT_BASE: Record<ThemeId, [number, number, number]> = {
  stadium: [96, 98, 106],
  canyon: [44, 38, 34],
  night: [22, 24, 36],
  alpine: [78, 88, 104],
  works: [36, 34, 32],
  mesa: [78, 58, 38],
  grove: [22, 28, 26],
  ember: [86, 38, 28],
  storm: [32, 38, 46],
};

export function roadCrown(theme: ThemeId) {
  if (theme === "stadium") return { edge: 1.14, mid: 0.8 };
  if (theme === "canyon") return { edge: 1.1, mid: 0.8 };
  if (theme === "alpine") return { edge: 1.12, mid: 0.82 };
  if (theme === "works") return { edge: 1.1, mid: 0.78 };
  if (theme === "mesa") return { edge: 1.12, mid: 0.76 };
  if (theme === "grove") return { edge: 1.06, mid: 0.82 };
  if (theme === "ember") return { edge: 1.14, mid: 0.74 };
  if (theme === "storm") return { edge: 1.08, mid: 0.8 };
  return { edge: 1.08, mid: 0.84 };
}

/** Large-scale ribbon tints that still read at speed. Plastic leaves stadium charcoal alone. */
export const SURFACE_ARCHETYPE: Record<SurfaceKind, { r: number; g: number; b: number }> = {
  plastic: { r: 0.68, g: 0.69, b: 0.72 },
  dirt: { r: 0.46, g: 0.34, b: 0.22 },
  ice: { r: 0.74, g: 0.84, b: 0.94 },
  tech: { r: 0.3, g: 0.32, b: 0.34 },
};

export function themeDefaultSurface(theme: ThemeId): SurfaceKind {
  if (theme === "canyon" || theme === "mesa" || theme === "grove" || theme === "ember") return "dirt";
  if (theme === "alpine") return "ice";
  if (theme === "night" || theme === "works") return "tech";
  return "plastic";
}

export function roadSurfaceTint(theme: ThemeId, surface: SurfaceKind): { r: number; g: number; b: number } {
  const base = ROAD_TINT[theme];
  if (surface === themeDefaultSurface(theme)) return base;
  const arch = SURFACE_ARCHETYPE[surface];
  return {
    r: base.r * 0.42 + arch.r * 0.58,
    g: base.g * 0.42 + arch.g * 0.58,
    b: base.b * 0.42 + arch.b * 0.58,
  };
}

export function surfaceShowsDash(surface: SurfaceKind): boolean {
  return surface !== "dirt";
}

export function surfaceDashColor(surface: SurfaceKind): { r: number; g: number; b: number } {
  if (surface === "ice") return { r: 0.86, g: 0.94, b: 1 };
  if (surface === "tech") return { r: 0.72, g: 0.96, b: 0.94 };
  return { r: 0.95, g: 0.95, b: 0.92 };
}

/** Along-track bands so ice sheen / dirt ruts / tech panels read in a chase cam. */
export function surfaceBand(surface: SurfaceKind, s: number): number {
  if (surface === "ice") return 0.07 * Math.sin(s * 0.28);
  if (surface === "dirt") return -0.05 + 0.07 * Math.sin(s * 0.72);
  if (surface === "tech") return (Math.floor(s / 5.5) % 2 === 0 ? 0.055 : -0.02);
  return 0;
}
