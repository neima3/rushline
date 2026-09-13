import { wrapAngle } from "./ghost";
import { surfaceFeel } from "./feel";
import { getTrack, sampleAt } from "./track";
import {
  TRACK_ORDER,
  isStockTrack,
  type BuiltTrack,
  type GhostFrame,
  type Sample,
  type StockTrackId,
  type TrackId,
} from "./types";

/** Match `CarSim.reset` / finish gate so the tape starts and ends on the race line. */
export const AUTHOR_START_S = 6;
export const AUTHOR_FINISH_S = 2.5;
/** Tight enough for `ghostQuality` "ok" without storing a fat recorded tape. */
export const AUTHOR_FRAME_MS = 160;

const cache = new Map<StockTrackId, GhostFrame[]>();

const _a: Sample = emptySample();
const _b: Sample = emptySample();

function emptySample(): Sample {
  return {
    x: 0,
    y: 0,
    z: 0,
    tx: 0,
    ty: 0,
    tz: -1,
    ux: 0,
    uy: 1,
    uz: 0,
    rx: 1,
    ry: 0,
    rz: 0,
    width: 12,
    s: 0,
    boost: false,
    checkpoint: false,
    surface: "plastic",
  };
}

function wrapS(s: number, length: number): number {
  const L = Math.max(1, length);
  return ((s % L) + L) % L;
}

function tangentYaw(tx: number, tz: number): number {
  return Math.atan2(-tx, -tz);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

type Knot = {
  dist: number;
  s: number;
  n: number;
  heading: number;
  weight: number;
  rawT: number;
};

function raceTravel(length: number, laps: number, startS: number, finishS: number): number {
  return Math.max(1, laps) * length - (startS - finishS);
}

function localWeight(track: BuiltTrack, s: number): { n: number; weight: number } {
  const a = sampleAt(track, s, _a);
  const b = sampleAt(track, s + 4, _b);
  const bend = wrapAngle(tangentYaw(b.tx, b.tz) - tangentYaw(a.tx, a.tz));
  const curv = bend / 4;
  const feel = surfaceFeel(a.surface);
  const climb = clamp(a.ty, -0.35, 0.55);
  let weight = feel.accel / Math.max(0.72, feel.drag);
  if (a.boost) weight *= 1.28;
  weight *= 1 - Math.min(0.38, Math.abs(curv) * 7.5);
  weight *= 1 - climb * 0.42;
  weight = clamp(weight, 0.42, 1.55);

  const maxN = Math.min(1.7, a.width * 0.14);
  const cut = a.surface === "ice" ? 0.4 : a.surface === "dirt" ? 0.7 : 1;
  const n = clamp(-curv * 16 * cut, -maxN, maxN);
  return { n, weight };
}

function sampleKnots(knots: Knot[], rawT: number): Knot {
  const last = knots[knots.length - 1]!;
  if (rawT <= knots[0]!.rawT) return knots[0]!;
  if (rawT >= last.rawT) return last;
  let lo = 0;
  let hi = knots.length - 2;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const a = knots[mid]!;
    const b = knots[mid + 1]!;
    if (rawT < a.rawT) hi = mid - 1;
    else if (rawT > b.rawT) lo = mid + 1;
    else {
      const span = b.rawT - a.rawT || 1;
      const u = clamp((rawT - a.rawT) / span, 0, 1);
      return {
        dist: a.dist + (b.dist - a.dist) * u,
        s: a.s + (b.s - a.s) * u,
        n: a.n + (b.n - a.n) * u,
        heading: a.heading + wrapAngle(b.heading - a.heading) * u,
        weight: a.weight + (b.weight - a.weight) * u,
        rawT,
      };
    }
  }
  return knots[Math.max(0, Math.min(knots.length - 1, lo))]!;
}

/** Procedural author-line tape paced to the track's Author medal. */
export function buildAuthorGhost(track: BuiltTrack): GhostFrame[] | null {
  const authorMs = track.def.medals.author;
  if (!Number.isFinite(authorMs) || authorMs < 2000) return null;
  const L = track.length;
  if (!Number.isFinite(L) || L < 80) return null;
  const laps = Math.max(1, track.def.laps);
  const startS = Math.min(AUTHOR_START_S, L * 0.08);
  const finishS = Math.min(AUTHOR_FINISH_S, L * 0.04);
  const travel = raceTravel(L, laps, startS, finishS);
  if (travel < 40) return null;

  const STEP = 5;
  const count = Math.max(8, Math.ceil(travel / STEP) + 1);
  const knots: Knot[] = [];
  let prevN = 0;
  let raw = 0;

  for (let i = 0; i < count; i++) {
    const dist = Math.min(travel, i * STEP);
    const unwrapped = startS + dist;
    const s = wrapS(unwrapped, L);
    const local = localWeight(track, s);
    const n = prevN + (local.n - prevN) * 0.28;
    const heading = clamp(Math.atan2(-(n - prevN), STEP), -0.42, 0.42);
    if (i > 0) {
      const prev = knots[i - 1]!;
      const speed = (local.weight + prev.weight) * 0.5;
      raw += (dist - prev.dist) / Math.max(0.35, speed);
    }
    knots.push({ dist, s: unwrapped, n, heading, weight: local.weight, rawT: raw });
    prevN = n;
  }

  const tail = knots[knots.length - 1]!;
  tail.s = startS + travel;
  tail.n *= 0.35;
  tail.heading = 0;
  tail.dist = travel;

  if (raw <= 0 || knots.length < 2) return null;

  const frames: GhostFrame[] = [];
  const emit = (t: number): GhostFrame => {
    const knot = sampleKnots(knots, (t / authorMs) * raw);
    return {
      t,
      s: wrapS(knot.s, L),
      n: knot.n,
      heading: knot.heading,
    };
  };

  for (let t = 0; t < authorMs; t += AUTHOR_FRAME_MS) {
    frames.push(emit(t));
  }
  const finish = emit(authorMs);
  finish.t = authorMs;
  finish.s = finishS;
  finish.heading = 0;
  const last = frames[frames.length - 1];
  if (!last || last.t < authorMs - 0.5) frames.push(finish);
  else frames[frames.length - 1] = finish;

  return frames.length >= 2 ? frames : null;
}

export function authorGhostFor(id: TrackId): GhostFrame[] | null {
  if (!isStockTrack(id)) return null;
  const hit = cache.get(id);
  if (hit) return hit;
  const built = buildAuthorGhost(getTrack(id));
  if (built) cache.set(id, built);
  return built;
}

export function allAuthorGhosts(): Record<StockTrackId, GhostFrame[]> {
  const out = {} as Record<StockTrackId, GhostFrame[]>;
  for (const id of TRACK_ORDER) {
    const frames = authorGhostFor(id);
    if (frames) out[id] = frames;
  }
  return out;
}

export function clearAuthorGhostCache() {
  cache.clear();
}
