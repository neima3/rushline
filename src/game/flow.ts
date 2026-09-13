import { TRACK_ORDER, type GhostFrame, type Medal, type ResultsState, type ThemeId, type TrackId } from "./types.ts";

export const HINTS_KEY = "rushline-hints-v1";

export type HintState = {
  controlsDismissed: boolean;
};

export const TRACK_ENV_LABEL: Record<ThemeId, string> = {
  stadium: "Stadium",
  canyon: "Canyon",
  night: "Night",
};

export const MEDAL_LABEL: Record<Medal, string> = {
  author: "Author",
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
};

export function nextTrackId(id: TrackId): TrackId {
  const i = TRACK_ORDER.indexOf(id);
  const idx = i < 0 ? 0 : (i + 1) % TRACK_ORDER.length;
  return TRACK_ORDER[idx]!;
}

/** Time vs the previous personal best. Negative = faster. Null if first finish. */
export function pbDeltaMs(time: number, prevBest: number | null | undefined): number | null {
  if (prevBest == null || !Number.isFinite(prevBest) || !Number.isFinite(time)) return null;
  return time - prevBest;
}

/** Finish split vs a recorded ghost. Negative = beat the ghost. */
export function ghostFinishDeltaMs(time: number, ghost: GhostFrame[] | null | undefined): number | null {
  if (!ghost || ghost.length < 2) return null;
  const last = ghost[ghost.length - 1]!;
  if (!Number.isFinite(time) || !Number.isFinite(last.t)) return null;
  return time - last.t;
}

export function resultsHeadline(medal: Medal | null, isPb: boolean): string {
  if (medal) return `${MEDAL_LABEL[medal]} medal`;
  if (isPb) return "Personal best";
  return "Finished";
}

export function buildResults(input: {
  time: number;
  trackId: TrackId;
  prevBest: number | null;
  ghost: GhostFrame[] | null | undefined;
  medal: Medal | null;
}): ResultsState {
  const { time, trackId, prevBest, ghost, medal } = input;
  const isPb = prevBest == null || time < prevBest;
  const ghostDelta = ghostFinishDeltaMs(time, ghost);
  return {
    time,
    best: isPb ? time : prevBest,
    prevBest,
    medal,
    isPb,
    trackId,
    ghostDelta,
    hadGhost: ghostDelta != null,
    nextTrackId: nextTrackId(trackId),
  };
}

export function parseHints(raw: unknown): HintState {
  if (!raw || typeof raw !== "object") return { controlsDismissed: false };
  const o = raw as Record<string, unknown>;
  return { controlsDismissed: o.controlsDismissed === true };
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function loadHints(storage?: StorageLike | null): HintState {
  if (!storage) {
    if (typeof window === "undefined") return { controlsDismissed: false };
    storage = window.localStorage;
  }
  try {
    const raw = storage.getItem(HINTS_KEY);
    if (!raw) return { controlsDismissed: false };
    return parseHints(JSON.parse(raw));
  } catch {
    return { controlsDismissed: false };
  }
}

export function persistHints(next: HintState, storage?: StorageLike | null): HintState {
  if (!storage) {
    if (typeof window === "undefined") return next;
    storage = window.localStorage;
  }
  try {
    storage.setItem(HINTS_KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
  return next;
}

export function dismissControlsHint(storage?: StorageLike | null): HintState {
  return persistHints({ controlsDismissed: true }, storage);
}
