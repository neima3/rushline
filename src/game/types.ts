export type ThemeId = "stadium" | "canyon" | "night" | "alpine";

export type Medal = "author" | "gold" | "silver" | "bronze";

export type Phase = "menu" | "select" | "countdown" | "race" | "paused" | "results";

export type CameraMode = "chase" | "hood";

export type TrackId = "circuit" | "canyon" | "helix" | "summit";

export type TrackNode = {
  x: number;
  y: number;
  z: number;
  width: number;
  bank: number;
  boost?: boolean;
  checkpoint?: boolean;
};

export type TrackDef = {
  id: TrackId;
  name: string;
  blurb: string;
  env: ThemeId;
  laps: number;
  closed: boolean;
  thumb: string;
  medals: { author: number; gold: number; silver: number; bronze: number };
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
  medalRemain: number | null;
  cpFlash: { kind: "cp" | "lap" | "finish"; delta: number | null; label: string } | null;
};

export type GhostSource = "pb" | "last" | "none";

export type GhostPref = "auto" | "pb" | "last";

export type ResultsState = {
  time: number;
  best: number | null;
  medal: Medal | null;
  isPb: boolean;
  trackId: TrackId;
  ghostSaved: boolean;
  ghostSource: GhostSource;
  lastTime: number | null;
  recents: number[];
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
};
