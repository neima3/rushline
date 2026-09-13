import type { GhostFrame, GhostSource } from "./types";

export const RECORD_MIN_MS = 20;
export const RECORD_MAX_MS = 40;
export const STORE_MAX_FRAMES = 900;

export type GhostPose = {
  s: number;
  n: number;
  heading: number;
};

export function wrapAngle(a: number): number {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
}

function unwrapToward(prev: number, next: number, period: number): number {
  if (!Number.isFinite(period) || period <= 0) return next;
  let d = next - prev;
  const half = period * 0.5;
  if (d > half) next -= period;
  else if (d < -half) next += period;
  return next;
}

export function sanitizeFrames(raw: unknown): GhostFrame[] | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const out: GhostFrame[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const t = o.t;
    const s = o.s;
    const n = o.n;
    const heading = o.heading;
    if (
      typeof t !== "number" ||
      typeof s !== "number" ||
      typeof n !== "number" ||
      typeof heading !== "number" ||
      !Number.isFinite(t) ||
      !Number.isFinite(s) ||
      !Number.isFinite(n) ||
      !Number.isFinite(heading) ||
      t < 0
    ) {
      continue;
    }
    out.push({ t, s, n, heading });
  }
  if (out.length < 2) return null;
  out.sort((a, b) => a.t - b.t);
  const uniq: GhostFrame[] = [out[0]!];
  for (let i = 1; i < out.length; i++) {
    const f = out[i]!;
    const last = uniq[uniq.length - 1]!;
    if (f.t <= last.t) continue;
    uniq.push(f);
  }
  return uniq.length >= 2 ? uniq : null;
}

export function ghostQuality(frames: GhostFrame[] | null | undefined): "none" | "weak" | "ok" {
  if (!frames || frames.length < 2) return "none";
  const first = frames[0]!;
  const last = frames[frames.length - 1]!;
  const duration = last.t - first.t;
  if (frames.length < 12 || duration < 2000) return "weak";
  let gaps = 0;
  let worst = 0;
  for (let i = 1; i < frames.length; i++) {
    const dt = frames[i]!.t - frames[i - 1]!.t;
    worst = Math.max(worst, dt);
    if (dt > 220) gaps++;
  }
  if (worst > 900 || gaps > frames.length * 0.18) return "weak";
  return "ok";
}

export function pickRaceGhost(
  pb: GhostFrame[] | null | undefined,
  last: GhostFrame[] | null | undefined,
  prefer: "auto" | "pb" | "last" = "auto",
): { frames: GhostFrame[] | null; source: GhostSource } {
  const pbFrames = sanitizeFrames(pb);
  const lastFrames = sanitizeFrames(last);
  if (prefer === "pb" && pbFrames) return { frames: pbFrames, source: "pb" };
  if (prefer === "last" && lastFrames) return { frames: lastFrames, source: "last" };

  const pbQ = ghostQuality(pbFrames);
  const lastQ = ghostQuality(lastFrames);
  if (pbQ === "ok") return { frames: pbFrames, source: "pb" };
  if (lastQ === "ok") return { frames: lastFrames, source: "last" };
  if (pbQ === "weak" && lastQ === "weak") {
    const pbSpan = pbFrames![pbFrames!.length - 1]!.t - pbFrames![0]!.t;
    const lastSpan = lastFrames![lastFrames!.length - 1]!.t - lastFrames![0]!.t;
    if (lastFrames!.length > pbFrames!.length + 4 || lastSpan > pbSpan + 800) {
      return { frames: lastFrames, source: "last" };
    }
    return { frames: pbFrames, source: "pb" };
  }
  if (pbQ === "weak") return { frames: pbFrames, source: "pb" };
  if (lastQ === "weak") return { frames: lastFrames, source: "last" };
  return { frames: null, source: "none" };
}

export function shouldRecord(prev: GhostFrame | undefined, next: GhostFrame): boolean {
  if (!prev) return true;
  const dt = next.t - prev.t;
  if (dt < RECORD_MIN_MS) return false;
  if (dt >= RECORD_MAX_MS) return true;
  const ds = Math.abs(next.s - prev.s);
  const dn = Math.abs(next.n - prev.n);
  const dh = Math.abs(wrapAngle(next.heading - prev.heading));
  return ds > 1.6 || dn > 0.28 || dh > 0.1;
}

export function compactFrames(frames: GhostFrame[], maxFrames = STORE_MAX_FRAMES): GhostFrame[] {
  const clean = sanitizeFrames(frames);
  if (!clean) return [];
  if (clean.length <= maxFrames) return clean;
  const out: GhostFrame[] = [clean[0]!];
  const lastI = clean.length - 1;
  const step = (clean.length - 1) / (maxFrames - 1);
  for (let k = 1; k < maxFrames - 1; k++) {
    const i = Math.round(k * step);
    const f = clean[Math.max(1, Math.min(lastI - 1, i))]!;
    if (f.t > out[out.length - 1]!.t) out.push(f);
  }
  const tail = clean[lastI]!;
  if (tail.t > out[out.length - 1]!.t) out.push(tail);
  return out;
}

function findSpan(frames: GhostFrame[], time: number): number {
  let lo = 0;
  let hi = frames.length - 2;
  if (time <= frames[0]!.t) return 0;
  if (time >= frames[frames.length - 1]!.t) return frames.length - 2;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const a = frames[mid]!.t;
    const b = frames[mid + 1]!.t;
    if (time < a) hi = mid - 1;
    else if (time > b) lo = mid + 1;
    else return mid;
  }
  return Math.max(0, Math.min(frames.length - 2, lo));
}

function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function sampleAt(frames: GhostFrame[], i: number): GhostFrame {
  if (i <= 0) return frames[0]!;
  if (i >= frames.length) return frames[frames.length - 1]!;
  return frames[i]!;
}

/** Cubic playback. Snaps across respawn / lap-seam jumps instead of stretching. */
export function sampleGhost(
  frames: GhostFrame[] | null | undefined,
  time: number,
  length = 0,
  closed = false,
): GhostPose | null {
  const clean = frames && frames.length >= 2 ? frames : null;
  if (!clean) return null;
  if (clean.length === 2 || time <= clean[0]!.t) {
    const a = clean[0]!;
    if (time <= a.t) return { s: a.s, n: a.n, heading: a.heading };
  }
  const last = clean[clean.length - 1]!;
  if (time >= last.t) return { s: last.s, n: last.n, heading: last.heading };

  const i = findSpan(clean, time);
  const a = clean[i]!;
  const b = clean[i + 1]!;
  const span = b.t - a.t || 1;
  const t = Math.max(0, Math.min(1, (time - a.t) / span));

  const jumpS = Math.abs(b.s - a.s);
  const jumpLimit = length > 1 ? Math.max(36, length * 0.42) : 40;
  if (jumpS > jumpLimit) {
    return t < 0.5 ? { s: a.s, n: a.n, heading: a.heading } : { s: b.s, n: b.n, heading: b.heading };
  }

  const p0 = sampleAt(clean, i - 1);
  const p3 = sampleAt(clean, i + 2);
  const period = closed && length > 1 ? length : 0;
  const s0 = p0.s;
  const s1 = unwrapToward(s0, a.s, period);
  const s2 = unwrapToward(s1, b.s, period);
  const s3 = unwrapToward(s2, p3.s, period);
  const h0 = p0.heading;
  const h1 = h0 + wrapAngle(a.heading - h0);
  const h2 = h1 + wrapAngle(b.heading - h1);
  const h3 = h2 + wrapAngle(p3.heading - h2);

  let s = catmull(s0, s1, s2, s3, t);
  if (period) {
    s = ((s % period) + period) % period;
  }
  return {
    s,
    n: catmull(p0.n, a.n, b.n, p3.n, t),
    heading: h1 + wrapAngle(catmull(h0, h1, h2, h3, t) - h1),
  };
}

