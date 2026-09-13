import { compactFrames, ghostQuality, sanitizeFrames } from "./ghost";
import type { GhostFrame, GhostSource, SaveData, TrackId } from "./types";

export const SAVE_KEY = "rushline-v1";
export const LAST_KEY = "rushline-last-v1";
export const RECENT_LIMIT = 5;

export type LastSave = {
  runs: Partial<Record<TrackId, { time: number; frames: GhostFrame[] }>>;
  recents: Partial<Record<TrackId, number[]>>;
};

export type RunCommit = {
  savedBest: boolean;
  savedGhost: boolean;
  savedLast: boolean;
  isPb: boolean;
  ghostSource: GhostSource;
  recents: number[];
  best: number;
  lastTime: number;
};

export type PersistIo = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export function memoryIo(seed: Record<string, string> = {}): PersistIo & { data: Record<string, string> } {
  const data = { ...seed };
  return {
    data,
    getItem: (key) => (key in data ? data[key]! : null),
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

function browserIo(): PersistIo | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function emptySave(): SaveData {
  return { version: 1, best: {}, ghosts: {} };
}

export function emptyLast(): LastSave {
  return { runs: {}, recents: {} };
}

export function parseSave(raw: string | null | undefined): SaveData {
  if (!raw) return emptySave();
  try {
    const parsed = JSON.parse(raw) as SaveData;
    if (parsed?.version !== 1) return emptySave();
    const ghosts: SaveData["ghosts"] = {};
    for (const [id, frames] of Object.entries(parsed.ghosts ?? {})) {
      const clean = sanitizeFrames(frames);
      if (clean) ghosts[id as TrackId] = clean;
    }
    const best: SaveData["best"] = {};
    for (const [id, time] of Object.entries(parsed.best ?? {})) {
      if (typeof time === "number" && Number.isFinite(time) && time > 0) best[id as TrackId] = time;
    }
    return { version: 1, best, ghosts };
  } catch {
    return emptySave();
  }
}

export function parseLast(raw: string | null | undefined): LastSave {
  if (!raw) return emptyLast();
  try {
    const parsed = JSON.parse(raw) as LastSave;
    const runs: LastSave["runs"] = {};
    for (const [id, run] of Object.entries(parsed.runs ?? {})) {
      if (!run || typeof run.time !== "number" || !Number.isFinite(run.time)) continue;
      const frames = sanitizeFrames(run.frames);
      if (!frames) continue;
      runs[id as TrackId] = { time: run.time, frames };
    }
    const recents: LastSave["recents"] = {};
    for (const [id, list] of Object.entries(parsed.recents ?? {})) {
      if (!Array.isArray(list)) continue;
      recents[id as TrackId] = list.filter((n) => typeof n === "number" && Number.isFinite(n) && n > 0).slice(0, RECENT_LIMIT);
    }
    return { runs, recents };
  } catch {
    return emptyLast();
  }
}

function writeJson(io: PersistIo, key: string, value: unknown): boolean {
  try {
    io.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function pushRecent(list: number[] | undefined, time: number): number[] {
  const next = [time, ...(list ?? [])].filter((n) => Number.isFinite(n) && n > 0);
  const uniq: number[] = [];
  for (const n of next) {
    if (!uniq.some((u) => Math.abs(u - n) < 0.5)) uniq.push(n);
    if (uniq.length >= RECENT_LIMIT) break;
  }
  return uniq;
}

export function commitRun(
  trackId: TrackId,
  time: number,
  frames: GhostFrame[],
  io: PersistIo | null = browserIo(),
  prevSave?: SaveData,
  prevLast?: LastSave,
): RunCommit {
  const save = prevSave ?? (io ? parseSave(io.getItem(SAVE_KEY)) : emptySave());
  const last = prevLast ?? (io ? parseLast(io.getItem(LAST_KEY)) : emptyLast());

  const compact = compactFrames(frames);
  const prevBest = save.best[trackId] ?? null;
  const isPb = prevBest == null || time < prevBest;
  const best = isPb ? time : prevBest;
  let savedBest = true;
  let savedGhost = true;
  let savedLast = true;

  last.recents[trackId] = pushRecent(last.recents[trackId], time);
  if (compact.length >= 2) {
    last.runs[trackId] = { time, frames: compact };
  }

  if (isPb) {
    save.best[trackId] = time;
    if (compact.length >= 2) save.ghosts[trackId] = compact;
  }

  if (io) {
    if (isPb) {
      if (!writeJson(io, SAVE_KEY, save)) {
        const tight = { ...save, ghosts: { ...save.ghosts, [trackId]: compactFrames(frames, 360) } };
        if (writeJson(io, SAVE_KEY, tight)) {
          save.ghosts[trackId] = tight.ghosts[trackId];
        } else {
          const bestOnly = { version: 1 as const, best: { ...parseSave(io.getItem(SAVE_KEY)).best, [trackId]: time }, ghosts: parseSave(io.getItem(SAVE_KEY)).ghosts };
          savedGhost = false;
          savedBest = writeJson(io, SAVE_KEY, bestOnly);
          if (savedBest) {
            save.best = bestOnly.best;
            save.ghosts = bestOnly.ghosts;
          }
        }
      }
    }
    if (!writeJson(io, LAST_KEY, last)) {
      const slim: LastSave = {
        runs: { [trackId]: last.runs[trackId] },
        recents: { [trackId]: last.recents[trackId] },
      };
      savedLast = writeJson(io, LAST_KEY, slim);
      if (savedLast) {
        last.runs = slim.runs;
        last.recents = slim.recents;
      }
    }
  }

  const pbQ = ghostQuality(save.ghosts[trackId]);
  const lastQ = ghostQuality(last.runs[trackId]?.frames);
  const ghostSource: GhostSource = pbQ !== "none" ? "pb" : lastQ !== "none" ? "last" : "none";

  return {
    savedBest,
    savedGhost: isPb ? savedGhost && compact.length >= 2 : savedGhost,
    savedLast,
    isPb,
    ghostSource,
    recents: last.recents[trackId] ?? [time],
    best,
    lastTime: time,
  };
}

export function readLastRun(trackId: TrackId, io: PersistIo | null = browserIo()): { time: number; frames: GhostFrame[] } | null {
  if (!io) return null;
  return parseLast(io.getItem(LAST_KEY)).runs[trackId] ?? null;
}

export function readRecents(trackId: TrackId, io: PersistIo | null = browserIo()): number[] {
  if (!io) return [];
  return parseLast(io.getItem(LAST_KEY)).recents[trackId] ?? [];
}
