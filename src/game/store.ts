import { create } from "zustand";
import type {
  CameraMode,
  HudState,
  PadInfo,
  Phase,
  ResultsState,
  SaveData,
  TrackId,
} from "./types";

const SAVE_KEY = "rushline-v1";

export const TRACK_ORDER: TrackId[] = ["circuit", "canyon", "helix"];

const emptyHud = (): HudState => ({
  time: 0,
  speed: 0,
  cp: 0,
  cpTotal: 0,
  lap: 1,
  laps: 2,
  boost: 0,
  medal: null,
  wrongWay: false,
  countdown: null,
  splittime: null,
  driftCharge: 0,
  s: 6,
  n: 0,
});

const emptyPad = (): PadInfo => ({
  connected: false,
  id: "",
  xbox: false,
  active: false,
});

function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { version: 1, best: {}, ghosts: {} };
    const parsed = JSON.parse(raw) as SaveData;
    if (parsed?.version !== 1) return { version: 1, best: {}, ghosts: {} };
    return {
      version: 1,
      best: parsed.best ?? {},
      ghosts: parsed.ghosts ?? {},
    };
  } catch {
    return { version: 1, best: {}, ghosts: {} };
  }
}

let saveCache: SaveData | null = null;

export function readSave(): SaveData {
  if (typeof window === "undefined") return { version: 1, best: {}, ghosts: {} };
  if (!saveCache) saveCache = loadSave();
  return saveCache;
}

export function writeSave(mutator: (s: SaveData) => void) {
  const s = readSave();
  mutator(s);
  saveCache = s;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* quota */
  }
}

type GameStore = {
  phase: Phase;
  trackId: TrackId;
  hud: HudState;
  results: ResultsState | null;
  camera: CameraMode;
  muted: boolean;
  autoThrottle: boolean;
  ready: boolean;
  touch: boolean;
  pad: PadInfo;
  best: Partial<Record<TrackId, number>>;
  setPhase: (p: Phase) => void;
  setTrack: (id: TrackId) => void;
  setHud: (h: Partial<HudState>) => void;
  setResults: (r: ResultsState | null) => void;
  setCamera: (c: CameraMode) => void;
  setMuted: (m: boolean) => void;
  setAutoThrottle: (v: boolean) => void;
  setReady: (v: boolean) => void;
  setTouch: (v: boolean) => void;
  setPad: (p: PadInfo) => void;
  refreshBest: () => void;
};

export const useGame = create<GameStore>((set) => ({
  phase: "menu",
  trackId: "circuit",
  hud: emptyHud(),
  results: null,
  camera: "chase",
  muted: false,
  autoThrottle: false,
  ready: false,
  touch: false,
  pad: emptyPad(),
  best: {},
  setPhase: (phase) => set({ phase }),
  setTrack: (trackId) => set({ trackId }),
  setHud: (h) => set((s) => ({ hud: { ...s.hud, ...h } })),
  setResults: (results) => set({ results }),
  setCamera: (camera) => set({ camera }),
  setMuted: (muted) => set({ muted }),
  setAutoThrottle: (autoThrottle) => set({ autoThrottle }),
  setReady: (ready) => set({ ready }),
  setTouch: (touch) => set({ touch }),
  setPad: (pad) => set({ pad }),
  refreshBest: () => set({ best: { ...readSave().best } }),
}));

export function resetHud(): HudState {
  return emptyHud();
}
