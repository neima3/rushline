import { create } from "zustand";
import { DEFAULT_LIVERY, type LiveryId } from "./livery";
import {
  applyQuality,
  defaultSettings,
  loadSettings,
  persistSettings,
  type Quality,
  type Settings,
} from "./settings";
import {
  TRACK_ORDER,
  type CameraMode,
  type HudState,
  type Medal,
  type PadInfo,
  type Phase,
  type ResultsState,
  type SaveData,
  type TrackId,
} from "./types";
import {
  LAST_KEY,
  SAVE_KEY,
  commitRun,
  emptyLast,
  emptySave,
  parseLast,
  parseSave,
  type LastSave,
  type RunCommit,
} from "./persist";
import {
  commitCupRun,
  emptyCup,
  parseCup,
  CUP_KEY,
  type CupEvent,
  type CupProgress,
  type CupResult,
} from "./cup";

export { TRACK_ORDER };
export { SAVE_KEY, LAST_KEY, CUP_KEY, commitRun };
export type { RunCommit };

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
  heading: 0,
  ghostS: null,
  ghostN: null,
  ghostDelta: null,
  ghostLead: null,
  medalRemain: null,
  cpFlash: null,
});

const emptyPad = (): PadInfo => ({
  connected: false,
  id: "",
  xbox: false,
  active: false,
});

function loadSave(): SaveData {
  try {
    return parseSave(localStorage.getItem(SAVE_KEY));
  } catch {
    return emptySave();
  }
}

function loadLast(): LastSave {
  try {
    return parseLast(localStorage.getItem(LAST_KEY));
  } catch {
    return emptyLast();
  }
}

let saveCache: SaveData | null = null;
let lastCache: LastSave | null = null;
let cupCache: CupProgress | null = null;

export function readSave(): SaveData {
  if (typeof window === "undefined") return emptySave();
  if (!saveCache) saveCache = loadSave();
  return saveCache;
}

export function readLastSave(): LastSave {
  if (typeof window === "undefined") return emptyLast();
  if (!lastCache) lastCache = loadLast();
  return lastCache;
}

function persistLiverySave(livery: LiveryId) {
  writeSave((save) => {
    save.livery = livery;
  });
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

export function applyRunCommit(trackId: TrackId, time: number, frames: import("./types").GhostFrame[]): RunCommit {
  const save = readSave();
  const last = readLastSave();
  const io = typeof localStorage === "undefined" ? null : localStorage;
  const result = commitRun(trackId, time, frames, io, save, last);
  saveCache = save;
  lastCache = last;
  return result;
}

function loadCup(): CupProgress {
  try {
    return parseCup(localStorage.getItem(CUP_KEY));
  } catch {
    return emptyCup();
  }
}

export function readCupProgress(): CupProgress {
  if (typeof window === "undefined") return emptyCup();
  if (!cupCache) cupCache = loadCup();
  return cupCache;
}

export function applyCupCommit(event: CupEvent, time: number, medal: Medal | null): CupResult {
  const io = typeof localStorage === "undefined" ? null : localStorage;
  const out = commitCupRun(event, time, medal, io, readCupProgress());
  cupCache = out.progress;
  return out.result;
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
  padBanner: string | null;
  best: Partial<Record<TrackId, number>>;
  lastTimes: Partial<Record<TrackId, number>>;
  recents: Partial<Record<TrackId, number[]>>;
  settings: Settings;
  settingsOpen: boolean;
  fps: number;
  photoMode: boolean;
  photoCapturing: boolean;
  photoGhost: boolean;
  photoScrub: number;
  photoFollowGhost: boolean;
  playMode: "trial" | "cup";
  cupEventId: string | null;
  cupFocusId: string;
  cupProgress: CupProgress;
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
  setPadBanner: (text: string | null) => void;
  setSettingsOpen: (v: boolean) => void;
  hydrateSettings: (s: Settings) => void;
  patchSettings: (p: Partial<Settings>) => void;
  setQuality: (q: Quality) => void;
  setLivery: (id: LiveryId) => void;
  resetSettings: (touch: boolean) => void;
  setFps: (n: number) => void;
  setPhotoMode: (v: boolean) => void;
  setPhotoCapturing: (v: boolean) => void;
  setPhotoGhost: (v: boolean) => void;
  setPhotoScrub: (v: number) => void;
  setPhotoFollowGhost: (v: boolean) => void;
  setCupSession: (eventId: string | null) => void;
  setCupFocus: (id: string) => void;
  refreshBest: () => void;
  refreshCup: () => void;
};

const bootSettings = defaultSettings(false);

export const useGame = create<GameStore>((set) => ({
  phase: "menu",
  trackId: "circuit",
  hud: emptyHud(),
  results: null,
  camera: "chase",
  muted: false,
  autoThrottle: bootSettings.autoThrottle,
  ready: false,
  touch: false,
  pad: emptyPad(),
  padBanner: null,
  best: {},
  lastTimes: {},
  recents: {},
  settings: bootSettings,
  settingsOpen: false,
  fps: 0,
  photoMode: false,
  photoCapturing: false,
  photoGhost: false,
  photoScrub: 1,
  photoFollowGhost: false,
  playMode: "trial",
  cupEventId: null,
  cupFocusId: "gold-circuit",
  cupProgress: emptyCup(),
  setPhase: (phase) => set({ phase }),
  setTrack: (trackId) => set({ trackId }),
  setHud: (h) => set((s) => ({ hud: { ...s.hud, ...h } })),
  setResults: (results) => set({ results }),
  setCamera: (camera) => set({ camera }),
  setMuted: (muted) => set({ muted }),
  setAutoThrottle: (autoThrottle) =>
    set((s) => {
      const settings = { ...s.settings, autoThrottle };
      persistSettings(settings);
      return { autoThrottle, settings };
    }),
  setReady: (ready) => set({ ready }),
  setTouch: (touch) => set({ touch }),
  setPad: (pad) => set({ pad }),
  setPadBanner: (padBanner) => set({ padBanner }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  hydrateSettings: (settings) => set({ settings, autoThrottle: settings.autoThrottle }),
  patchSettings: (p) =>
    set((s) => {
      const settings = { ...s.settings, ...p };
      persistSettings(settings);
      if (p.livery) persistLiverySave(settings.livery);
      return { settings, autoThrottle: settings.autoThrottle };
    }),
  setQuality: (q) =>
    set((s) => {
      const settings = applyQuality(s.settings, q);
      persistSettings(settings);
      return { settings, autoThrottle: settings.autoThrottle };
    }),
  setLivery: (livery) =>
    set((s) => {
      const settings = { ...s.settings, livery };
      persistSettings(settings);
      persistLiverySave(livery);
      return { settings };
    }),
  resetSettings: (touch) =>
    set((s) => {
      const settings = { ...defaultSettings(touch), livery: s.settings.livery ?? DEFAULT_LIVERY };
      persistSettings(settings);
      persistLiverySave(settings.livery);
      return { settings, autoThrottle: settings.autoThrottle };
    }),
  setFps: (fps) => set({ fps }),
  setPhotoMode: (photoMode) => set({ photoMode, photoCapturing: false }),
  setPhotoCapturing: (photoCapturing) => set({ photoCapturing }),
  setPhotoGhost: (photoGhost) => set({ photoGhost }),
  setPhotoScrub: (photoScrub) => set({ photoScrub: Math.max(0, Math.min(1, photoScrub)) }),
  setPhotoFollowGhost: (photoFollowGhost) => set({ photoFollowGhost }),
  setCupSession: (cupEventId) => set({ playMode: cupEventId ? "cup" : "trial", cupEventId }),
  setCupFocus: (cupFocusId) => set({ cupFocusId }),
  refreshBest: () => {
    const save = readSave();
    const last = readLastSave();
    const lastTimes: Partial<Record<TrackId, number>> = {};
    for (const id of TRACK_ORDER) {
      const run = last.runs[id];
      if (run) lastTimes[id] = run.time;
    }
    set({ best: { ...save.best }, lastTimes, recents: { ...last.recents } });
  },
  refreshCup: () => set({ cupProgress: { ...readCupProgress() } }),
}));

export function resetHud(): HudState {
  return emptyHud();
}
