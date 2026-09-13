import type { LiveryId } from "./livery";

export type ThemeId = "stadium" | "canyon" | "night" | "alpine" | "works" | "mesa" | "grove";

export type Medal = "author" | "gold" | "silver" | "bronze";

export type Phase = "menu" | "select" | "garage" | "cup" | "editor" | "countdown" | "race" | "paused" | "results";

export function isLobbyPhase(phase: Phase): boolean {
  return phase === "menu" || phase === "select" || phase === "garage" || phase === "cup" || phase === "editor";
}

export type CameraMode = "chase" | "far" | "hood" | "cockpit";

export type StockTrackId = "circuit" | "canyon" | "helix" | "summit" | "yard" | "mesa" | "hollow";

export type TrackId = StockTrackId | "custom";

export const TRACK_ORDER: StockTrackId[] = ["circuit", "canyon", "helix", "summit", "yard", "mesa", "hollow"];

export const PLAYABLE_ORDER: TrackId[] = [...TRACK_ORDER, "custom"];

/** Trackmania-style ribbon materials. Distinct grip, not just paint. */
export type SurfaceKind = "plastic" | "dirt" | "ice" | "tech";

export const SURFACE_ORDER: SurfaceKind[] = ["plastic", "dirt", "ice", "tech"];

export type TrackNode = {
  x: number;
  y: number;
  z: number;
  width: number;
  bank: number;
  boost?: boolean;
  checkpoint?: boolean;
  surface?: SurfaceKind;
};

export function isStockTrack(id: TrackId): id is StockTrackId {
  return id !== "custom";
}

export type TrackDef = {
  id: TrackId;
  name: string;
  blurb: string;
  env: ThemeId;
  laps: number;
  closed: boolean;
  thumb: string;
  medals: { author: number; gold: number; silver: number; bronze: number };
  defaultSurface: SurfaceKind;
  nodes: TrackNode[];
};

export type Sample = {
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  tz: number;
  ux: number;
  uy: number;
  uz: number;
  rx: number;
  ry: number;
  rz: number;
  width: number;
  s: number;
  boost: boolean;
  checkpoint: boolean;
  surface: SurfaceKind;
};

export type BuiltTrack = {
  def: TrackDef;
  samples: Sample[];
  length: number;
  checkpoints: number[];
  boosts: number[];
};

export type Actions = {
  throttle: number;
  brake: number;
  steer: number;
  slide: number;
  respawn: boolean;
  restart: boolean;
  pause: boolean;
  camera: boolean;
  confirm: boolean;
  back: boolean;
  photo: boolean;
  rewind: boolean;
  menuY: number;
};

export type PadInfo = {
  connected: boolean;
  id: string;
  xbox: boolean;
  active: boolean;
};

export type CarSnap = {
  s: number;
  n: number;
  heading: number;
  speed: number;
  airborne: boolean;
  px: number;
  py: number;
  pz: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  yaw: number;
  boost: number;
  slide: number;
  driftCharge: number;
  justTurbo: boolean;
  justLand: boolean;
  justBoost: boolean;
  surface: SurfaceKind;
  fx: number;
  fy: number;
  fz: number;
  ux: number;
  uy: number;
  uz: number;
};

export type HudState = {
  time: number;
  speed: number;
  cp: number;
  cpTotal: number;
  lap: number;
  laps: number;
  boost: number;
  medal: Medal | null;
  wrongWay: boolean;
  countdown: number | null;
  splittime: number | null;
  driftCharge: number;
  s: number;
  n: number;
  heading: number;
  ghostS: number | null;
  ghostN: number | null;
  ghostDelta: number | null;
  ghostLead: "ahead" | "behind" | "even" | null;
  ghostKind: GhostSource;
  medalRemain: number | null;
  cpFlash: { kind: "cp" | "lap" | "finish"; delta: number | null; label: string } | null;
  rewinding: boolean;
  rewindRemainMs: number;
  surface: SurfaceKind;
};

export type GhostSource = "pb" | "last" | "import" | "none";

export type GhostPref = "auto" | "pb" | "last" | "import";

export type CupId = "gold" | "author";

export type CupTarget = "gold" | "author";

export type CupResult = {
  eventId: string;
  cupId: CupId;
  cupName: string;
  target: CupTarget;
  cleared: boolean;
  firstClear: boolean;
  cupComplete: boolean;
  campaignComplete: boolean;
  nextEventId: string | null;
  nextTrackId: TrackId | null;
  eventIndex: number;
  eventTotal: number;
};

export type ResultsState = {
  time: number;
  best: number | null;
  prevBest: number | null;
  medal: Medal | null;
  isPb: boolean;
  trackId: TrackId;
  ghostSaved: boolean;
  ghostSource: GhostSource;
  lastTime: number | null;
  recents: number[];
  ghostDelta: number | null;
  hadGhost: boolean;
  nextTrackId: TrackId;
  cup?: CupResult | null;
};

export type GhostFrame = {
  t: number;
  s: number;
  n: number;
  heading: number;
};

export type SaveData = {
  version: 1;
  best: Partial<Record<TrackId, number>>;
  ghosts: Partial<Record<TrackId, GhostFrame[]>>;
  livery?: LiveryId;
};
