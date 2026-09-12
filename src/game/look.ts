import type { ThemeId } from "./types";

/** Albedo multipliers on the ribbon. Stadium stays charcoal so High-quality
 *  day lights (#19/#21) do not wash the midtones into the grass. */
export const ROAD_TINT: Record<ThemeId, { r: number; g: number; b: number }> = {
  stadium: { r: 0.56, g: 0.57, b: 0.6 },
  canyon: { r: 0.22, g: 0.19, b: 0.17 },
  night: { r: 0.3, g: 0.32, b: 0.44 },
};

/** Canvas asphalt base RGB — stadium midtones stay below washed gray (~158). */
export const ASPHALT_BASE: Record<ThemeId, [number, number, number]> = {
  stadium: [78, 80, 86],
  canyon: [40, 34, 30],
  night: [22, 24, 36],
};

export function roadCrown(theme: ThemeId) {
  if (theme === "stadium") return { edge: 1.16, mid: 0.74 };
  if (theme === "canyon") return { edge: 1.1, mid: 0.8 };
  return { edge: 1.08, mid: 0.84 };
}
