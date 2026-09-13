import { sampleGhost, sanitizeFrames, wrapAngle } from "./ghost.ts";
import { ghostScrubSpan, ghostScrubTime } from "./photo.ts";
import type { GhostFrame, GhostSource, TrackId } from "./types.ts";

export type ReplaySource = Exclude<GhostSource, "none">;

export type ReplayTape = {
  source: ReplaySource;
  time: number;
  frames: GhostFrame[];
  label: string;
};

export type ReplayCatalogInput = {
  trackId: TrackId;
  last?: { time: number; frames: GhostFrame[] } | null;
  pb?: { time: number; frames: GhostFrame[] } | null;
  imported?: { time: number; frames: GhostFrame[] } | null;
  author?: { time: number; frames: GhostFrame[] } | null;
  hotseat?: { time: number; frames: GhostFrame[] } | null;
};

export const REPLAY_SOURCE_ORDER: ReplaySource[] = ["last", "author", "pb", "import", "hotseat"];

export function replaySourceLabel(source: ReplaySource): string {
  if (source === "author") return "Author ghost";
  if (source === "import") return "Rival";
  if (source === "hotseat") return "Hotseat";
  if (source === "last") return "Last run";
  return "PB ghost";
}

export function isReplaySource(v: unknown): v is ReplaySource {
  return v === "last" || v === "pb" || v === "import" || v === "author" || v === "hotseat";
}

function tapeOf(
  source: ReplaySource,
  run: { time: number; frames: GhostFrame[] } | null | undefined,
): ReplayTape | null {
  if (!run || !Number.isFinite(run.time) || run.time <= 0) return null;
  const frames = sanitizeFrames(run.frames);
  if (!frames || ghostScrubSpan(frames) == null) return null;
  return { source, time: run.time, frames, label: replaySourceLabel(source) };
}

function sameTape(a: ReplayTape, b: ReplayTape): boolean {
  if (Math.abs(a.time - b.time) > 0.75) return false;
  if (a.frames.length !== b.frames.length) return false;
  const a0 = a.frames[0]!;
  const b0 = b.frames[0]!;
  const a1 = a.frames[a.frames.length - 1]!;
  const b1 = b.frames[b.frames.length - 1]!;
  return a0.t === b0.t && a1.t === b1.t && Math.abs(a0.s - b0.s) < 0.05 && Math.abs(a1.s - b1.s) < 0.05;
}

const SOURCE_RANK: Record<ReplaySource, number> = {
  author: 0,
  import: 1,
  hotseat: 2,
  pb: 3,
  last: 4,
};

export function listReplayTapes(input: ReplayCatalogInput): ReplayTape[] {
  const last = tapeOf("last", input.last);
  const imported = tapeOf("import", input.imported);
  const author = tapeOf("author", input.author);
  const hotseat = tapeOf("hotseat", input.hotseat);
  const pb = tapeOf("pb", input.pb);

  const raw: ReplayTape[] = [];
  if (last) raw.push(last);
  if (pb) raw.push(pb);
  if (imported) raw.push(imported);
  if (author) raw.push(author);
  if (hotseat) raw.push(hotseat);

  const out: ReplayTape[] = [];
  for (const tape of raw) {
    const i = out.findIndex((row) => sameTape(row, tape));
    if (i < 0) {
      out.push(tape);
      continue;
    }
    if (SOURCE_RANK[tape.source] < SOURCE_RANK[out[i]!.source]) out[i] = tape;
  }
  out.sort((a, b) => SOURCE_RANK[a.source] - SOURCE_RANK[b.source]);
  return out;
}

export function pickReplayTape(tapes: ReplayTape[], prefer?: ReplaySource | null): ReplayTape | null {
  if (tapes.length === 0) return null;
  if (prefer) {
    const hit = tapes.find((t) => t.source === prefer);
    if (hit) return hit;
    if (prefer === "pb") {
      const author = tapes.find((t) => t.source === "author");
      if (author) return author;
    }
    if (prefer === "author") {
      const pb = tapes.find((t) => t.source === "pb");
      if (pb) return pb;
    }
    if (prefer === "hotseat") {
      const last = tapes.find((t) => t.source === "last");
      if (last) return last;
    }
  }
  return tapes.find((t) => t.source === "last") ?? tapes[0] ?? null;
}

export function replayProgress(frames: GhostFrame[] | null | undefined, time: number): number {
  const span = ghostScrubSpan(frames);
  if (!span) return 0;
  return Math.max(0, Math.min(1, (time - span.start) / (span.end - span.start)));
}

export function replayTimeAt(frames: GhostFrame[] | null | undefined, u: number): number | null {
  return ghostScrubTime(frames, u);
}

export function replayDurationMs(frames: GhostFrame[] | null | undefined): number {
  const span = ghostScrubSpan(frames);
  return span ? span.end - span.start : 0;
}

export function stepReplayClock(
  time: number,
  dtMs: number,
  playing: boolean,
  frames: GhostFrame[] | null | undefined,
): { time: number; playing: boolean; ended: boolean } {
  const span = ghostScrubSpan(frames);
  if (!span) return { time: 0, playing: false, ended: true };
  let next = Number.isFinite(time) ? time : span.start;
  let on = playing;
  if (on) {
    const step = Number.isFinite(dtMs) ? Math.max(0, dtMs) : 0;
    next += step;
  }
  if (next < span.start) next = span.start;
  const ended = next >= span.end;
  if (ended) {
    next = span.end;
    on = false;
  }
  return { time: next, playing: on, ended };
}

/** Approximate ribbon speed (m/s) from neighboring ghost samples. */
export function ghostSpeedAt(frames: GhostFrame[] | null | undefined, time: number, length = 0): number {
  const clean = frames && frames.length >= 2 ? frames : null;
  if (!clean) return 0;
  const a = sampleGhost(clean, time, length, length > 1);
  const b = sampleGhost(clean, time + 40, length, length > 1);
  if (!a || !b) return 0;
  let ds = b.s - a.s;
  if (length > 1) {
    if (ds > length * 0.5) ds -= length;
    else if (ds < -length * 0.5) ds += length;
  }
  const speed = ds / 0.04;
  return Number.isFinite(speed) ? speed : 0;
}

export function ghostHeadingRate(frames: GhostFrame[] | null | undefined, time: number): number {
  const clean = frames && frames.length >= 2 ? frames : null;
  if (!clean) return 0;
  const a = sampleGhost(clean, time);
  const b = sampleGhost(clean, time + 40);
  if (!a || !b) return 0;
  return wrapAngle(b.heading - a.heading) / 0.04;
}
