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

/** Canvas albedo seed. Default-surface tracks keep their theme base; foreign
 *  plastic snaps to stadium charcoal so a mesa table / ridge start reads as asphalt. */
export function surfaceAlbedoBase(kind: SurfaceKind, theme: ThemeId): [number, number, number] {
  if (kind === themeDefaultSurface(theme)) return ASPHALT_BASE[theme];
  if (kind === "plastic") return ASPHALT_BASE.stadium;
  const arch = SURFACE_ARCHETYPE[kind];
  const base = ASPHALT_BASE[theme];
  return [
    Math.round(base[0] * 0.38 + arch.r * 255 * 0.62),
    Math.round(base[1] * 0.38 + arch.g * 255 * 0.62),
    Math.round(base[2] * 0.38 + arch.b * 255 * 0.62),
  ];
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

/** Specular / grit per Trackmania surface. Stadium plastic keeps Circuit High locks. */
export type SurfaceSpec = {
  roughness: number;
  metalness: number;
  emissive: number;
  emissiveIntensity: number;
};

export function surfaceSpec(theme: ThemeId, surface: SurfaceKind): SurfaceSpec {
  if (surface === "dirt") {
    return {
      roughness: theme === "mesa" || theme === "ember" ? 0.92 : 0.88,
      metalness: 0.03,
      emissive: theme === "ember" ? 0x281008 : theme === "mesa" ? 0x201808 : 0x000000,
      emissiveIntensity: theme === "ember" ? 0.08 : theme === "mesa" ? 0.04 : 0,
    };
  }
  if (surface === "ice") {
    return {
      roughness: 0.26,
      metalness: 0.36,
      emissive: theme === "alpine" ? 0x101820 : theme === "storm" ? 0x081018 : 0x102028,
      emissiveIntensity: theme === "alpine" ? 0.08 : theme === "storm" ? 0.12 : 0.06,
    };
  }
  if (surface === "tech") {
    return {
      roughness: 0.34,
      metalness: 0.3,
      emissive:
        theme === "night"
          ? 0x1c2438
          : theme === "works"
            ? 0x181410
            : theme === "grove"
              ? 0x081410
              : theme === "storm"
                ? 0x081018
                : 0x101418,
      emissiveIntensity:
        theme === "night" ? 0.34 : theme === "works" ? 0.16 : theme === "grove" ? 0.12 : theme === "storm" ? 0.16 : 0.08,
    };
  }
  return {
    roughness:
      theme === "night"
        ? 0.38
        : theme === "stadium"
          ? 0.52
          : theme === "alpine"
            ? 0.5
            : theme === "works"
              ? 0.44
              : theme === "mesa"
                ? 0.5
                : theme === "grove"
                  ? 0.48
                  : theme === "ember"
                    ? 0.5
                    : theme === "storm"
                      ? 0.42
                      : 0.5,
    metalness:
      theme === "night"
        ? 0.16
        : theme === "stadium"
          ? 0.08
          : theme === "alpine"
            ? 0.12
            : theme === "works"
              ? 0.2
              : theme === "mesa"
                ? 0.08
                : theme === "grove"
                  ? 0.1
                  : theme === "ember"
                    ? 0.08
                    : theme === "storm"
                      ? 0.18
                      : 0.08,
    emissive:
      theme === "night"
        ? 0x1c2438
        : theme === "alpine"
          ? 0x101820
          : theme === "works"
            ? 0x181410
            : theme === "mesa"
              ? 0x201808
              : theme === "grove"
                ? 0x081410
                : theme === "ember"
                  ? 0x281008
                  : theme === "storm"
                    ? 0x081018
                    : 0x000000,
    emissiveIntensity:
      theme === "night"
        ? 0.34
        : theme === "alpine"
          ? 0.06
          : theme === "works"
            ? 0.12
            : theme === "mesa"
              ? 0.06
              : theme === "grove"
                ? 0.16
                : theme === "ember"
                  ? 0.1
                  : theme === "storm"
                    ? 0.18
                    : 0,
  };
}

/** Roughness-map mid gray. Higher = dirtier / more matte. */
export function surfaceRoughnessMid(theme: ThemeId, surface: SurfaceKind): number {
  if (surface === "dirt") return 198;
  if (surface === "ice") return 78;
  if (surface === "tech") return 108;
  return theme === "stadium"
    ? 148
    : theme === "canyon"
      ? 168
      : theme === "alpine"
        ? 132
        : theme === "works"
          ? 118
          : theme === "mesa"
            ? 158
            : theme === "grove"
              ? 108
              : theme === "ember"
                ? 152
                : theme === "storm"
                  ? 112
                  : 96;
}

export type Rgb = { r: number; g: number; b: number };

/** Trackmania sausage curbs — high block vs low connector. Visual only. */
export function curbPeriod(theme: ThemeId): number {
  if (theme === "stadium") return 1.85;
  if (theme === "alpine") return 2;
  return 2.1;
}

export function curbBlockHigh(theme: ThemeId, s: number): boolean {
  return Math.floor(s / curbPeriod(theme)) % 2 === 0;
}

export function curbSidePainted(theme: ThemeId): boolean {
  return theme === "night" || theme === "works" || theme === "grove" || theme === "storm";
}

export function curbDims(theme: ThemeId, high: boolean) {
  const width =
    theme === "stadium"
      ? 0.78
      : theme === "canyon"
        ? 0.62
        : theme === "alpine"
          ? 0.7
          : theme === "works"
            ? 0.64
            : theme === "mesa"
              ? 0.66
              : theme === "grove"
                ? 0.58
                : theme === "ember"
                  ? 0.64
                  : theme === "storm"
                    ? 0.6
                    : 0.55;
  const height =
    theme === "stadium"
      ? 0.3
      : theme === "canyon"
        ? 0.16
        : theme === "alpine"
          ? 0.22
          : theme === "works"
            ? 0.18
            : theme === "mesa"
              ? 0.17
              : theme === "grove"
                ? 0.14
                : theme === "ember"
                  ? 0.16
                  : theme === "storm"
                    ? 0.15
                    : 0.13;
  const lift = theme === "stadium" ? 0.05 : theme === "alpine" ? 0.04 : theme === "works" ? 0.035 : theme === "mesa" ? 0.03 : theme === "ember" ? 0.032 : 0.025;
  return {
    width: high ? width : width * 0.7,
    height: high ? height : height * 0.34,
    lift: high ? lift : lift * 0.45,
  };
}

export function curbColor(theme: ThemeId, side: -1 | 1, high: boolean): Rgb {
  if (theme === "night") return side < 0 ? { r: 0.18, g: 0.96, b: 1 } : { r: 1, g: 0.22, b: 0.68 };
  if (theme === "works") return side < 0 ? { r: 0.12, g: 0.94, b: 0.86 } : { r: 1, g: 0.48, b: 0.08 };
  if (theme === "grove") return side < 0 ? { r: 0.42, g: 0.92, b: 0.58 } : { r: 0.86, g: 0.72, b: 0.28 };
  if (theme === "storm") return side < 0 ? { r: 0.28, g: 0.72, b: 0.92 } : { r: 0.86, g: 0.9, b: 0.96 };
  if (theme === "mesa") return high ? { r: 0.96, g: 0.42, b: 0.12 } : { r: 0.98, g: 0.86, b: 0.52 };
  if (theme === "ember") return high ? { r: 1, g: 0.28, b: 0.08 } : { r: 0.98, g: 0.62, b: 0.18 };
  if (high) {
    if (theme === "stadium") return { r: 1, g: 0.1, b: 0.06 };
    if (theme === "alpine") return { r: 0.42, g: 0.72, b: 0.94 };
    return { r: 0.98, g: 0.2, b: 0.1 };
  }
  if (theme === "stadium") return { r: 1, g: 1, b: 1 };
  if (theme === "alpine") return { r: 0.96, g: 0.98, b: 1 };
  return { r: 0.99, g: 0.97, b: 0.92 };
}

export function lipWidth(theme: ThemeId): number {
  if (theme === "stadium") return 0.2;
  if (theme === "alpine") return 0.16;
  if (theme === "works") return 0.14;
  if (theme === "mesa" || theme === "ember") return 0.16;
  return 0.12;
}

export function lipColor(theme: ThemeId): Rgb {
  if (theme === "night") return { r: 0.07, g: 0.09, b: 0.14 };
  if (theme === "works") return { r: 0.1, g: 0.08, b: 0.07 };
  if (theme === "grove") return { r: 0.06, g: 0.1, b: 0.08 };
  if (theme === "mesa") return { r: 0.16, g: 0.1, b: 0.05 };
  if (theme === "ember") return { r: 0.18, g: 0.08, b: 0.04 };
  if (theme === "storm") return { r: 0.08, g: 0.1, b: 0.14 };
  return { r: 0.06, g: 0.06, b: 0.07 };
}

export function edgeMark(theme: ThemeId): { width: number; inset: number; color: Rgb } {
  const width =
    theme === "canyon" ? 0.26 : theme === "stadium" ? 0.15 : theme === "alpine" ? 0.16 : theme === "works" ? 0.14 : theme === "mesa" ? 0.2 : theme === "ember" ? 0.22 : theme === "storm" ? 0.16 : 0.1;
  const inset = theme === "canyon" ? 0.12 : theme === "mesa" ? 0.14 : theme === "ember" ? 0.13 : 0.22;
  const color =
    theme === "stadium"
      ? { r: 1, g: 1, b: 0.98 }
      : theme === "night"
        ? { r: 0.62, g: 0.96, b: 1 }
        : theme === "alpine"
          ? { r: 0.88, g: 0.94, b: 1 }
          : theme === "works"
            ? { r: 0.28, g: 0.92, b: 0.86 }
            : theme === "mesa"
              ? { r: 0.98, g: 0.78, b: 0.32 }
              : theme === "grove"
                ? { r: 0.52, g: 0.88, b: 0.62 }
                : theme === "ember"
                  ? { r: 1, g: 0.48, b: 0.16 }
                  : theme === "storm"
                    ? { r: 0.62, g: 0.84, b: 0.96 }
                    : { r: 0.98, g: 0.96, b: 0.9 };
  return { width, inset, color };
}
