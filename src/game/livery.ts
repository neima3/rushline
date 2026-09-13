export const LIVERY_IDS = ["ivory", "violet", "sun", "frost", "carbon", "hazard"] as const;
export type LiveryId = (typeof LIVERY_IDS)[number];

export const DEFAULT_LIVERY: LiveryId = "ivory";

export type LiveryPattern = "chevron" | "slash" | "band" | "frost" | "pinstripe" | "hazard";

export type LiveryDef = {
  id: LiveryId;
  name: string;
  blurb: string;
  pattern: LiveryPattern;
  /** Body fill (CSS / canvas). */
  base: string;
  /** Decal / stripe fill. */
  stripe: string;
  shade: string;
  accent: number;
  accentNight: number;
  accentEmissive: number;
  accentEmissiveNight: number;
  gold: number;
  rim: number;
  rimNight: number;
  sheen: number;
};

export const LIVERIES: Record<LiveryId, LiveryDef> = {
  ivory: {
    id: "ivory",
    name: "Ivory",
    blurb: "Factory cream with rally orange chevrons.",
    pattern: "chevron",
    base: "#f4f1ea",
    stripe: "#ef5a24",
    shade: "#1a1a1e",
    accent: 0xef5a24,
    accentNight: 0xff7a3a,
    accentEmissive: 0x4a1808,
    accentEmissiveNight: 0x6a2010,
    gold: 0xd2ae62,
    rim: 0xd0d4dc,
    rimNight: 0xc8ccd4,
    sheen: 0xffe6cc,
  },
  violet: {
    id: "violet",
    name: "Violet",
    blurb: "Indigo shell, electric cyan slashes.",
    pattern: "slash",
    base: "#2a1a48",
    stripe: "#3de8ff",
    shade: "#12102a",
    accent: 0x3de8ff,
    accentNight: 0x7ef4ff,
    accentEmissive: 0x146880,
    accentEmissiveNight: 0x1a88a8,
    gold: 0x8ec8e8,
    rim: 0x8a78c0,
    rimNight: 0xa898e0,
    sheen: 0x9ad8ff,
  },
  sun: {
    id: "sun",
    name: "Sun",
    blurb: "Terracotta body, desert-sand racing band.",
    pattern: "band",
    base: "#c45a28",
    stripe: "#f4d6a0",
    shade: "#3a1c10",
    accent: 0xf4d6a0,
    accentNight: 0xffe8b8,
    accentEmissive: 0x5a3010,
    accentEmissiveNight: 0x7a4014,
    gold: 0xe8c878,
    rim: 0xe8c8a0,
    rimNight: 0xf0d4b0,
    sheen: 0xffd0b0,
  },
  frost: {
    id: "frost",
    name: "Frost",
    blurb: "Ice white with alpine blue bands.",
    pattern: "frost",
    base: "#e8f0f8",
    stripe: "#3a78c8",
    shade: "#1a2838",
    accent: 0x3a78c8,
    accentNight: 0x6aa8e8,
    accentEmissive: 0x143058,
    accentEmissiveNight: 0x1c4480,
    gold: 0xc8d8e8,
    rim: 0xd8e8f8,
    rimNight: 0xe8f2fc,
    sheen: 0xd8e8f8,
  },
  carbon: {
    id: "carbon",
    name: "Carbon",
    blurb: "Works black, gold pinstripe.",
    pattern: "pinstripe",
    base: "#141418",
    stripe: "#d2ae62",
    shade: "#08080a",
    accent: 0xd2ae62,
    accentNight: 0xe8c878,
    accentEmissive: 0x3a2a14,
    accentEmissiveNight: 0x5a4018,
    gold: 0xd2ae62,
    rim: 0xc8b070,
    rimNight: 0xd8c080,
    sheen: 0xffe4c4,
  },
  hazard: {
    id: "hazard",
    name: "Hazard",
    blurb: "Charcoal dock paint, sodium chevrons.",
    pattern: "hazard",
    base: "#1c1c16",
    stripe: "#f0a020",
    shade: "#0c0c0a",
    accent: 0xf0a020,
    accentNight: 0xffc040,
    accentEmissive: 0x4a2808,
    accentEmissiveNight: 0x6a3810,
    gold: 0xe0a040,
    rim: 0xb8a070,
    rimNight: 0xd0b878,
    sheen: 0xffd0b0,
  },
};

export const LIVERY_ORDER: LiveryId[] = [...LIVERY_IDS];

export function isLiveryId(v: unknown): v is LiveryId {
  return typeof v === "string" && (LIVERY_IDS as readonly string[]).includes(v);
}

export function parseLivery(v: unknown): LiveryId | undefined {
  return isLiveryId(v) ? v : undefined;
}

export function liveryId(v: unknown, fallback: LiveryId = DEFAULT_LIVERY): LiveryId {
  return parseLivery(v) ?? fallback;
}

export function liveryDef(id: unknown): LiveryDef {
  return LIVERIES[liveryId(id)];
}

export function nextLivery(id: LiveryId, dir: number): LiveryId {
  const i = LIVERY_ORDER.indexOf(id);
  const start = i < 0 ? 0 : i;
  const len = LIVERY_ORDER.length;
  return LIVERY_ORDER[(start + dir + len) % len]!;
}
