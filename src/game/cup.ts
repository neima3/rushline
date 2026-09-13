import {
  TRACK_ORDER,
  type CupId,
  type CupResult,
  type CupTarget,
  type Medal,
  type TrackId,
} from "./types.ts";

export type CupIo = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export type { CupId, CupResult, CupTarget };

export const CUP_KEY = "rushline-cup-v1";

export type CupEvent = {
  id: string;
  cupId: CupId;
  index: number;
  trackId: TrackId;
  target: CupTarget;
};

export type CupProgress = {
  version: 1;
  unlocked: Record<CupId, number>;
  medals: Partial<Record<string, Medal>>;
  times: Partial<Record<string, number>>;
  goldComplete: boolean;
  authorComplete: boolean;
};

export const CUP_ORDER: CupId[] = ["gold", "author"];

export const CUP_META: Record<CupId, { name: string; blurb: string }> = {
  gold: { name: "Gold Cup", blurb: "Hit Gold on every circuit. Five events." },
  author: { name: "Author Cup", blurb: "Author times. Unlocks after Gold Cup." },
};

const RANK: Record<Medal, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  author: 4,
};

function eventsFor(cupId: CupId, target: CupTarget): CupEvent[] {
  return TRACK_ORDER.map((trackId, index) => ({
    id: `${cupId}-${trackId}`,
    cupId,
    index,
    trackId,
    target,
  }));
}

export const CUP_EVENTS: Record<CupId, CupEvent[]> = {
  gold: eventsFor("gold", "gold"),
  author: eventsFor("author", "author"),
};

export function allCupEvents(): CupEvent[] {
  return [...CUP_EVENTS.gold, ...CUP_EVENTS.author];
}

export function getCupEvent(id: string | null | undefined): CupEvent | null {
  if (!id) return null;
  return allCupEvents().find((e) => e.id === id) ?? null;
}

export function emptyCup(): CupProgress {
  return {
    version: 1,
    unlocked: { gold: 0, author: -1 },
    medals: {},
    times: {},
    goldComplete: false,
    authorComplete: false,
  };
}

export function medalMeets(earned: Medal | null | undefined, target: CupTarget): boolean {
  if (!earned) return false;
  return RANK[earned] >= RANK[target];
}

export function betterMedal(a: Medal | null | undefined, b: Medal | null | undefined): Medal | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return RANK[b] > RANK[a] ? b : a;
}

export function isEventCleared(progress: CupProgress, event: CupEvent): boolean {
  return medalMeets(progress.medals[event.id], event.target);
}

export function isEventUnlocked(progress: CupProgress, event: CupEvent): boolean {
  return event.index <= (progress.unlocked[event.cupId] ?? -1);
}

export function cupClearedCount(progress: CupProgress, cupId: CupId): number {
  return CUP_EVENTS[cupId].filter((e) => isEventCleared(progress, e)).length;
}

export function isCupComplete(progress: CupProgress, cupId: CupId): boolean {
  return CUP_EVENTS[cupId].every((e) => isEventCleared(progress, e));
}

export function continueEvent(progress: CupProgress): CupEvent | null {
  for (const cupId of CUP_ORDER) {
    for (const ev of CUP_EVENTS[cupId]) {
      if (isEventUnlocked(progress, ev) && !isEventCleared(progress, ev)) return ev;
    }
  }
  return null;
}

export function parseCup(raw: string | null | undefined): CupProgress {
  const empty = emptyCup();
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw) as Partial<CupProgress>;
    if (parsed?.version !== 1) return empty;
    const medals: CupProgress["medals"] = {};
    for (const [id, medal] of Object.entries(parsed.medals ?? {})) {
      if (medal === "author" || medal === "gold" || medal === "silver" || medal === "bronze") {
        medals[id] = medal;
      }
    }
    const times: CupProgress["times"] = {};
    for (const [id, time] of Object.entries(parsed.times ?? {})) {
      if (typeof time === "number" && Number.isFinite(time) && time > 0) times[id] = time;
    }
    const goldUnlocked = Number.isFinite(parsed.unlocked?.gold) ? Math.trunc(parsed.unlocked!.gold) : 0;
    const authorUnlocked = Number.isFinite(parsed.unlocked?.author) ? Math.trunc(parsed.unlocked!.author) : -1;
    const next: CupProgress = {
      version: 1,
      unlocked: {
        gold: Math.max(0, Math.min(CUP_EVENTS.gold.length - 1, goldUnlocked)),
        author: Math.max(-1, Math.min(CUP_EVENTS.author.length - 1, authorUnlocked)),
      },
      medals,
      times,
      goldComplete: parsed.goldComplete === true || isCupComplete({ ...empty, medals }, "gold"),
      authorComplete: parsed.authorComplete === true || isCupComplete({ ...empty, medals }, "author"),
    };
    if (next.goldComplete) next.unlocked.author = Math.max(next.unlocked.author, 0);
    return next;
  } catch {
    return empty;
  }
}

function writeJson(io: CupIo, key: string, value: unknown): boolean {
  try {
    io.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function browserIo(): CupIo | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function readCup(io: CupIo | null = browserIo()): CupProgress {
  if (!io) return emptyCup();
  return parseCup(io.getItem(CUP_KEY));
}

export function writeCup(progress: CupProgress, io: CupIo | null = browserIo()): boolean {
  if (!io) return false;
  return writeJson(io, CUP_KEY, progress);
}

export function applyCupFinish(progress: CupProgress, event: CupEvent, time: number, medal: Medal | null): CupProgress {
  const next: CupProgress = {
    version: 1,
    unlocked: { ...progress.unlocked },
    medals: { ...progress.medals },
    times: { ...progress.times },
    goldComplete: progress.goldComplete,
    authorComplete: progress.authorComplete,
  };

  const prevTime = next.times[event.id];
  if (prevTime == null || time < prevTime) next.times[event.id] = time;
  next.medals[event.id] = betterMedal(next.medals[event.id], medal) ?? undefined;

  if (isEventCleared(next, event)) {
    const frontier = event.index + 1;
    if (frontier < CUP_EVENTS[event.cupId].length) {
      next.unlocked[event.cupId] = Math.max(next.unlocked[event.cupId], frontier);
    } else {
      next.unlocked[event.cupId] = Math.max(next.unlocked[event.cupId], event.index);
    }
  }

  next.goldComplete = isCupComplete(next, "gold");
  next.authorComplete = isCupComplete(next, "author");
  if (next.goldComplete) next.unlocked.author = Math.max(next.unlocked.author, 0);
  return next;
}

export function commitCupRun(
  event: CupEvent,
  time: number,
  medal: Medal | null,
  io: CupIo | null = browserIo(),
  prev?: CupProgress,
): { progress: CupProgress; result: CupResult } {
  const before = prev ?? (io ? parseCup(io.getItem(CUP_KEY)) : emptyCup());
  const cleared = medalMeets(medal, event.target);
  const firstClear = cleared && !isEventCleared(before, event);
  const progress = applyCupFinish(before, event, time, medal);
  if (io) writeCup(progress, io);
  const next = cleared ? continueEvent(progress) : null;
  return {
    progress,
    result: {
      eventId: event.id,
      cupId: event.cupId,
      cupName: CUP_META[event.cupId].name,
      target: event.target,
      cleared,
      firstClear,
      cupComplete: isCupComplete(progress, event.cupId),
      campaignComplete: progress.goldComplete && progress.authorComplete,
      nextEventId: next?.id ?? null,
      nextTrackId: next?.trackId ?? null,
      eventIndex: event.index,
      eventTotal: CUP_EVENTS[event.cupId].length,
    },
  };
}

export function cupHeadline(result: CupResult, medal: Medal | null): string {
  if (result.campaignComplete) return "Cup complete";
  if (result.cupComplete && result.firstClear) {
    return result.cupId === "gold" ? "Gold Cup cleared" : "Author Cup cleared";
  }
  if (result.cleared) return result.target === "author" ? "Author locked in" : "Gold locked in";
  if (medal === "author") return "Author — missed";
  if (medal === "gold") return "Gold — missed";
  if (medal === "silver") return "Silver — missed";
  if (medal === "bronze") return "Bronze — missed";
  return "Missed the cut";
}

export function cupContinueLabel(progress: CupProgress): string {
  const next = continueEvent(progress);
  if (!next) {
    if (progress.goldComplete && progress.authorComplete) return "Campaign complete";
    return "Open the board";
  }
  return `Continue · ${CUP_META[next.cupId].name} ${next.index + 1}/${CUP_EVENTS[next.cupId].length}`;
}
