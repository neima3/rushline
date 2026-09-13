import type { SurfaceKind, ThemeId, TrackDef, TrackNode } from "./types";

export const CUSTOM_KEY = "rushline-custom-v1";
export const CUSTOM_TRACK_ID = "custom" as const;
export const MIN_EDITOR_POINTS = 4;
export const MAX_EDITOR_POINTS = 24;
export const MIN_POINT_GAP = 8;
export const MIN_LOOP_LENGTH = 180;
export const MAX_LOOP_LENGTH = 4200;

export type EditorPoint = {
  x: number;
  y: number;
  z: number;
  width: number;
  bank: number;
  boost?: boolean;
  checkpoint?: boolean;
};

export type CustomTrackSave = {
  version: 1;
  name: string;
  env: ThemeId;
  surface: SurfaceKind;
  laps: 1 | 2;
  points: EditorPoint[];
};

export type PersistIo = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export type EditorIssue = {
  ok: boolean;
  errors: string[];
  length: number;
  checkpoints: number;
  boosts: number;
};

const THEMES: ThemeId[] = ["stadium", "canyon", "night", "alpine", "works", "mesa", "grove", "ember", "storm"];
const SURFACES: SurfaceKind[] = ["plastic", "dirt", "ice", "tech"];

let draftOverride: CustomTrackSave | null = null;

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function finite(n: unknown, fallback: number) {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function pointAt(points: EditorPoint[], i: number): EditorPoint {
  const n = points.length;
  return points[((i % n) + n) % n]!;
}

export function sanitizeName(raw: unknown): string {
  const text = typeof raw === "string" ? raw.trim().slice(0, 24) : "";
  return text || "Custom";
}

export function sanitizePoint(raw: unknown): EditorPoint | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const x = finite(o.x, NaN);
  const y = finite(o.y, 0.02);
  const z = finite(o.z, NaN);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  return {
    x: clamp(x, -420, 420),
    y: clamp(y, 0.02, 28),
    z: clamp(z, -420, 420),
    width: clamp(finite(o.width, 12), 8.5, 16),
    bank: clamp(finite(o.bank, 0), -0.55, 0.55),
    boost: o.boost === true,
    checkpoint: o.checkpoint === true,
  };
}

export function defaultCustomSave(): CustomTrackSave {
  return {
    version: 1,
    name: "Custom",
    env: "stadium",
    surface: "plastic",
    laps: 1,
    points: [
      { x: 0, y: 0.02, z: 0, width: 12.5, bank: 0 },
      { x: 8, y: 0.02, z: -88, width: 12.5, bank: 0 },
      { x: 58, y: 0.02, z: -138, width: 12.2, bank: 0.18, checkpoint: true },
      { x: 118, y: 0.02, z: -88, width: 12.5, bank: 0, boost: true },
      { x: 122, y: 0.02, z: 8, width: 12.5, bank: 0 },
      { x: 118, y: 0.02, z: 78, width: 12.2, bank: -0.16, checkpoint: true },
      { x: 58, y: 0.02, z: 118, width: 12.4, bank: 0 },
      { x: 8, y: 0.02, z: 72, width: 12.5, bank: 0, boost: true },
    ],
  };
}

export function ensureCheckpoints(points: EditorPoint[]): EditorPoint[] {
  if (points.some((p) => p.checkpoint)) return points;
  if (points.length < MIN_EDITOR_POINTS) return points;
  const a = Math.max(1, Math.floor(points.length / 3));
  const b = Math.max(a + 1, Math.floor((points.length * 2) / 3));
  return points.map((p, i) => (i === a || i === b ? { ...p, checkpoint: true } : p));
}

export function parseCustomSave(raw: string | null | undefined): CustomTrackSave {
  const fallback = defaultCustomSave();
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<CustomTrackSave>;
    if (parsed?.version !== 1) return fallback;
    const points = (Array.isArray(parsed.points) ? parsed.points : []).map(sanitizePoint).filter((p): p is EditorPoint => Boolean(p));
    if (points.length < MIN_EDITOR_POINTS) return fallback;
    const env = THEMES.includes(parsed.env as ThemeId) ? (parsed.env as ThemeId) : fallback.env;
    const surface = SURFACES.includes(parsed.surface as SurfaceKind) ? (parsed.surface as SurfaceKind) : fallback.surface;
    const laps = parsed.laps === 2 ? 2 : 1;
    return {
      version: 1,
      name: sanitizeName(parsed.name),
      env,
      surface,
      laps,
      points: ensureCheckpoints(points.slice(0, MAX_EDITOR_POINTS)),
    };
  } catch {
    return fallback;
  }
}

function browserIo(): PersistIo | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function readCustomSave(io: PersistIo | null = browserIo()): CustomTrackSave {
  if (!io) return defaultCustomSave();
  try {
    return parseCustomSave(io.getItem(CUSTOM_KEY));
  } catch {
    return defaultCustomSave();
  }
}

export function writeCustomSave(save: CustomTrackSave, io: PersistIo | null = browserIo()): boolean {
  if (!io) return false;
  try {
    io.setItem(CUSTOM_KEY, JSON.stringify(cloneSave(save)));
    return true;
  } catch {
    return false;
  }
}

export function cloneSave(save: CustomTrackSave): CustomTrackSave {
  return {
    version: 1,
    name: sanitizeName(save.name),
    env: save.env,
    surface: save.surface,
    laps: save.laps === 2 ? 2 : 1,
    points: save.points.map((p) => ({ ...p })),
  };
}

export function setCustomDraft(save: CustomTrackSave | null) {
  draftOverride = save ? cloneSave(save) : null;
}

export function peekCustomDraft(): CustomTrackSave | null {
  return draftOverride ? cloneSave(draftOverride) : null;
}

export function readActiveCustom(io: PersistIo | null = browserIo()): CustomTrackSave {
  return draftOverride ? cloneSave(draftOverride) : readCustomSave(io);
}

export function pointsToNodes(points: EditorPoint[], surface: SurfaceKind): TrackNode[] {
  return ensureCheckpoints(points).map((p) => ({
    x: p.x,
    y: p.y,
    z: p.z,
    width: p.width,
    bank: p.bank,
    boost: p.boost || undefined,
    checkpoint: p.checkpoint || undefined,
    surface,
  }));
}

export function estimateLoopLength(points: EditorPoint[]): number {
  if (points.length < 2) return 0;
  let arc = 0;
  const segs = points.length;
  for (let i = 0; i < segs; i++) {
    const p0 = pointAt(points, i - 1);
    const p1 = pointAt(points, i);
    const p2 = pointAt(points, i + 1);
    const p3 = pointAt(points, i + 2);
    const seglen = Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
    const steps = Math.max(4, Math.ceil(seglen / 4));
    let px = p1.x;
    let py = p1.y;
    let pz = p1.z;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const x = catmull(p0.x, p1.x, p2.x, p3.x, t);
      const y = catmull(p0.y, p1.y, p2.y, p3.y, t);
      const z = catmull(p0.z, p1.z, p2.z, p3.z, t);
      arc += Math.hypot(x - px, y - py, z - pz);
      px = x;
      py = y;
      pz = z;
    }
  }
  return arc;
}

export function estimateMedals(length: number, laps: number) {
  const raceM = Math.max(220, length) * (laps === 2 ? 2 : 1);
  const author = Math.round(raceM / 40) * 1000;
  return {
    author: Math.max(16_000, author),
    gold: Math.round(author * 1.16),
    silver: Math.round(author * 1.36),
    bronze: Math.round(author * 1.68),
  };
}

export function customDefFromSave(save: CustomTrackSave): TrackDef {
  const clean = cloneSave(save);
  const points = ensureCheckpoints(clean.points);
  const length = estimateLoopLength(points);
  return {
    id: "custom",
    name: clean.name,
    blurb: "Closed ribbon you built. Time trial only.",
    env: clean.env,
    laps: clean.laps,
    closed: true,
    thumb: "/textures/thumb-custom.svg",
    medals: estimateMedals(length, clean.laps),
    defaultSurface: clean.surface,
    nodes: pointsToNodes(points, clean.surface),
  };
}

export function sampleLoop(points: EditorPoint[], step = 3): { x: number; y: number; z: number }[] {
  const out: { x: number; y: number; z: number }[] = [];
  if (points.length < 2) return out;
  for (let i = 0; i < points.length; i++) {
    const p0 = pointAt(points, i - 1);
    const p1 = pointAt(points, i);
    const p2 = pointAt(points, i + 1);
    const p3 = pointAt(points, i + 2);
    const seglen = Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
    const steps = Math.max(4, Math.ceil(seglen / step));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      out.push({
        x: catmull(p0.x, p1.x, p2.x, p3.x, t),
        y: catmull(p0.y, p1.y, p2.y, p3.y, t),
        z: catmull(p0.z, p1.z, p2.z, p3.z, t),
      });
    }
  }
  return out;
}

export function validateCustom(save: CustomTrackSave): EditorIssue {
  const errors: string[] = [];
  const points = save.points ?? [];
  if (points.length < MIN_EDITOR_POINTS) errors.push(`Need at least ${MIN_EDITOR_POINTS} control points.`);
  if (points.length > MAX_EDITOR_POINTS) errors.push(`Cap is ${MAX_EDITOR_POINTS} control points.`);
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = pointAt(points, i + 1);
    const gap = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (gap < MIN_POINT_GAP) errors.push(`Points ${i + 1} and ${(i + 1) % points.length + 1} are too close.`);
  }
  const length = estimateLoopLength(points);
  if (length < MIN_LOOP_LENGTH) errors.push("Ribbon is too short to race.");
  if (length > MAX_LOOP_LENGTH) errors.push("Ribbon is too long for the web build.");
  const checkpoints = points.filter((p) => p.checkpoint).length;
  const boosts = points.filter((p) => p.boost).length;
  if (checkpoints < 1) errors.push("Mark at least one checkpoint (not the start).");
  if (errors.some((e) => e.includes("too close"))) {
    return { ok: false, errors: unique(errors), length, checkpoints, boosts };
  }
  return { ok: errors.length === 0, errors: unique(errors), length, checkpoints, boosts };
}

function unique(list: string[]) {
  return [...new Set(list)];
}

export function movePoint(points: EditorPoint[], index: number, patch: Partial<EditorPoint>): EditorPoint[] {
  return points.map((p, i) => {
    if (i !== index) return p;
    return sanitizePoint({ ...p, ...patch }) ?? p;
  });
}

export function insertPoint(points: EditorPoint[], afterIndex: number, at?: { x: number; y?: number; z: number }): EditorPoint[] {
  if (points.length >= MAX_EDITOR_POINTS) return points;
  const a = pointAt(points, afterIndex);
  const b = pointAt(points, afterIndex + 1);
  const next: EditorPoint = sanitizePoint({
    x: at?.x ?? (a.x + b.x) * 0.5,
    y: at?.y ?? (a.y + b.y) * 0.5,
    z: at?.z ?? (a.z + b.z) * 0.5,
    width: (a.width + b.width) * 0.5,
    bank: (a.bank + b.bank) * 0.5,
  })!;
  const copy = points.slice();
  copy.splice(afterIndex + 1, 0, next);
  return copy;
}

export function removePoint(points: EditorPoint[], index: number): EditorPoint[] {
  if (points.length <= MIN_EDITOR_POINTS) return points;
  return points.filter((_, i) => i !== index);
}

export function nearestSegment(points: EditorPoint[], x: number, z: number): { index: number; dist: number; px: number; pz: number } {
  let best = { index: 0, dist: Infinity, px: x, pz: z };
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = pointAt(points, i + 1);
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const len2 = abx * abx + abz * abz || 1;
    const t = clamp(((x - a.x) * abx + (z - a.z) * abz) / len2, 0, 1);
    const px = a.x + abx * t;
    const pz = a.z + abz * t;
    const dist = Math.hypot(x - px, z - pz);
    if (dist < best.dist) best = { index: i, dist, px, pz };
  }
  return best;
}

export function exportCustomJson(save: CustomTrackSave): string {
  return `${JSON.stringify(cloneSave(save), null, 2)}\n`;
}

export function downloadCustomJson(save: CustomTrackSave): boolean {
  if (typeof document === "undefined" || typeof URL === "undefined") return false;
  try {
    const blob = new Blob([exportCustomJson(save)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rushline-${sanitizeName(save.name).toLowerCase().replace(/[^a-z0-9]+/g, "-") || "custom"}.json`;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    return true;
  } catch {
    return false;
  }
}

export const EDITOR_THEMES: { id: ThemeId; label: string }[] = [
  { id: "stadium", label: "Stadium" },
  { id: "canyon", label: "Canyon" },
  { id: "night", label: "Night" },
  { id: "alpine", label: "Alpine" },
  { id: "works", label: "Works" },
  { id: "mesa", label: "Mesa" },
  { id: "grove", label: "Grove" },
  { id: "ember", label: "Ember" },
  { id: "storm", label: "Storm" },
];

export const EDITOR_SURFACES: { id: SurfaceKind; label: string }[] = [
  { id: "plastic", label: "Plastic" },
  { id: "dirt", label: "Dirt" },
  { id: "ice", label: "Ice" },
  { id: "tech", label: "Tech" },
];
