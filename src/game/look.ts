import type { ThemeId } from "./types";

/** Albedo multipliers on the ribbon. Stadium stays charcoal so High-quality
 *  day lights (#19/#21) do not wash the midtones into the grass. */
export const ROAD_TINT: Record<ThemeId, { r: number; g: number; b: number }> = {
  stadium: { r: 0.68, g: 0.69, b: 0.72 },
  canyon: { r: 0.24, g: 0.21, b: 0.18 },
  night: { r: 0.3, g: 0.32, b: 0.44 },
  alpine: { r: 0.58, g: 0.64, b: 0.74 },
};

/** Canvas asphalt base RGB — stadium midtones stay below washed gray (~158). */
export const ASPHALT_BASE: Record<ThemeId, [number, number, number]> = {
  stadium: [96, 98, 106],
  canyon: [44, 38, 34],
  night: [22, 24, 36],
  alpine: [78, 88, 104],
};

export function roadCrown(theme: ThemeId) {
  if (theme === "stadium") return { edge: 1.14, mid: 0.8 };
  if (theme === "canyon") return { edge: 1.1, mid: 0.8 };
  if (theme === "alpine") return { edge: 1.12, mid: 0.82 };
  return { edge: 1.08, mid: 0.84 };
}
