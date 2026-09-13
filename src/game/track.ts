import * as THREE from "three";
import { customDefFromSave, readActiveCustom } from "./editor.ts";
import type { BuiltTrack, Medal, Sample, SurfaceKind, ThemeId, TrackDef, TrackId, TrackNode } from "./types";
import { TRACK_ORDER, type StockTrackId } from "./types.ts";
import { defaultSurface } from "./feel.ts";
import {
  curbBlockHigh,
  curbColor,
  curbDims,
  edgeMark,
  lipColor,
  lipWidth,
  roadCrown,
  roadSurfaceTint,
  surfaceBand,
  surfaceDashColor,
  surfaceShowsDash,
} from "./look";
import { makeAsphaltRoughness, makeAsphaltTexture, makeCheckerTexture } from "./textures";
import type { TextureBudget } from "./quality";

const TAU = Math.PI * 2;
const _hintSample: Sample = {
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

function wrapPi(a: number) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

class PathBuilder {
  x = 0;
  y = 0.02;
  z = 0;
  yaw = 0;
  width = 12;
  bank = 0;
  surface: SurfaceKind | undefined;
  nodes: TrackNode[] = [];

  constructor() {
    this.capture();
  }

  private capture(extra?: Partial<TrackNode>) {
    this.nodes.push({
      x: this.x,
      y: this.y,
      z: this.z,
      width: this.width,
      bank: this.bank,
      surface: extra?.surface ?? this.surface,
      ...extra,
    });
  }

  setWidth(w: number) {
    this.width = w;
    return this;
  }

  setSurface(kind: SurfaceKind) {
    this.surface = kind;
    const last = this.nodes[this.nodes.length - 1];
    if (last && this.nodes.length === 1) last.surface = kind;
    return this;
  }

  straight(
    dist: number,
    opts: { climb?: number; width?: number; bank?: number; boost?: boolean; checkpoint?: boolean; surface?: SurfaceKind } = {},
  ) {
    const steps = Math.max(2, Math.ceil(Math.abs(dist) / 8));
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const y0 = this.y;
    const dy = opts.climb ?? 0;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      this.x += fx * (dist / steps);
      this.z += fz * (dist / steps);
      this.y = y0 + dy * t;
      if (opts.width != null) this.width = opts.width;
      if (opts.bank != null) this.bank = opts.bank;
      if (opts.surface != null) this.surface = opts.surface;
      this.capture({
        boost: Boolean(opts.boost) && i === Math.max(1, Math.floor(steps * 0.45)),
        checkpoint: Boolean(opts.checkpoint) && i === steps,
        surface: this.surface,
      });
    }
    if (opts.bank != null && !opts.bank) this.bank = 0;
    return this;
  }

  curve(
    angle: number,
    radius: number,
    opts: { bank?: number; climb?: number; checkpoint?: boolean; boost?: boolean; width?: number; surface?: SurfaceKind } = {},
  ) {
    const sign = Math.sign(angle) || 1;
    const abs = Math.abs(angle);
    const arcLen = abs * radius;
    const steps = Math.max(8, Math.ceil(arcLen / 5.5));
    const y0 = this.y;
    const dy = opts.climb ?? 0;
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);
    const centerSide = -sign;
    const cx = this.x + rightX * radius * centerSide;
    const cz = this.z + rightZ * radius * centerSide;
    const startYaw = this.yaw;
    const bankIn = opts.bank ?? 0.32;
    if (opts.width != null) this.width = opts.width;
    if (opts.surface != null) this.surface = opts.surface;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const a = startYaw + angle * t;
      const rx = Math.cos(a);
      const rz = -Math.sin(a);
      this.x = cx - rx * radius * centerSide;
      this.z = cz - rz * radius * centerSide;
      this.y = y0 + dy * t;
      this.yaw = a;
      this.bank = bankIn * sign * Math.sin(t * Math.PI);
      this.capture({
        checkpoint: Boolean(opts.checkpoint) && i === steps,
        boost: Boolean(opts.boost) && i === Math.floor(steps * 0.3),
      });
    }
    this.bank = 0;
    return this;
  }

  loop(radius = 13, extra = 12) {
    const n = 40;
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const x0 = this.x;
    const y0 = this.y;
    const z0 = this.z;
    const w0 = this.width;
    this.width = Math.min(this.width, 10.5);
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const a = t * TAU;
      const along = radius * Math.sin(a) + extra * t;
      this.x = x0 + fx * along;
      this.z = z0 + fz * along;
      this.y = y0 + radius * (1 - Math.cos(a));
      this.capture({ boost: i === 3 });
    }
    this.width = w0;
    this.bank = 0;
    return this;
  }

  close() {
    const first = this.nodes[0];
    if (!first) return this;
    for (let pass = 0; pass < 3; pass++) {
      const dx = first.x - this.x;
      const dz = first.z - this.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 6 && Math.abs(this.y - first.y) < 2) break;
      const desired = Math.atan2(-dx, -dz);
      const dyaw = wrapPi(desired - this.yaw);
      if (Math.abs(dyaw) > 0.08) {
        const radius = Math.max(16, Math.min(48, dist * 0.42));
        this.curve(dyaw, radius, { climb: first.y - this.y });
      } else {
        this.straight(dist, { climb: first.y - this.y });
      }
    }
    this.x = first.x;
    this.y = first.y;
    this.z = first.z;
    this.yaw = 0;
    this.capture();
    return this;
  }

  build(): TrackNode[] {
    return this.nodes;
  }
}

function nodeAt(nodes: TrackNode[], i: number, closed: boolean) {
  const n = nodes.length;
  if (closed) return nodes[((i % n) + n) % n]!;
  return nodes[Math.max(0, Math.min(n - 1, i))]!;
}

export function rasterize(nodes: TrackNode[], closed: boolean, stabilizeUp = false, stabilizeFlats = false): Sample[] {
  const pts: {
    x: number;
    y: number;
    z: number;
    width: number;
    bank: number;
    boost: boolean;
    checkpoint: boolean;
    surface?: SurfaceKind;
  }[] = [];
  const n = nodes.length;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = nodeAt(nodes, i - 1, closed);
    const p1 = nodeAt(nodes, i, closed);
    const p2 = nodeAt(nodes, i + 1, closed);
    const p3 = nodeAt(nodes, i + 2, closed);
    const seglen = Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
    const steps = Math.max(2, Math.ceil(seglen / 1.35));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      pts.push({
        x: catmull(p0.x, p1.x, p2.x, p3.x, t),
        y: catmull(p0.y, p1.y, p2.y, p3.y, t),
        z: catmull(p0.z, p1.z, p2.z, p3.z, t),
        width: lerp(p1.width, p2.width, t),
        bank: lerp(p1.bank, p2.bank, t),
        boost: Boolean(p1.boost) && s === 0,
        checkpoint: Boolean(p1.checkpoint) && s === 0,
        surface: p1.surface ?? p2.surface,
      });
    }
  }
  if (!closed) {
    const last = nodes[n - 1]!;
    pts.push({
      x: last.x,
      y: last.y,
      z: last.z,
      width: last.width,
      bank: last.bank,
      boost: Boolean(last.boost),
      checkpoint: Boolean(last.checkpoint),
      surface: last.surface,
    });
  }

  const samples: Sample[] = [];
  let tx = 0;
  let ty = 0;
  let tz = -1;
  let ux = 0;
  let uy = 1;
  let uz = 0;
  let arc = 0;

  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    let ntx = q.x - p.x;
    let nty = q.y - p.y;
    let ntz = q.z - p.z;
    if (!closed && i === pts.length - 1) {
      ntx = tx;
      nty = ty;
      ntz = tz;
    }
    let len = Math.hypot(ntx, nty, ntz);
    if (len < 1e-6) {
      ntx = tx;
      nty = ty;
      ntz = tz;
      len = 1;
    } else {
      ntx /= len;
      nty /= len;
      ntz /= len;
    }

    if (i > 0) {
      const cx = ty * ntz - tz * nty;
      const cy = tz * ntx - tx * ntz;
      const cz = tx * nty - ty * ntx;
      const cl = Math.hypot(cx, cy, cz);
      const dt = Math.max(-1, Math.min(1, tx * ntx + ty * nty + tz * ntz));
      const angle = Math.acos(dt);
      if (cl > 1e-6 && angle > 1e-5) {
        const ax = cx / cl;
        const ay = cy / cl;
        const az = cz / cl;
        const sA = Math.sin(angle);
        const cA = Math.cos(angle);
        const one = 1 - cA;
        const rx = ux * (cA + ax * ax * one) + uy * (ax * ay * one - az * sA) + uz * (ax * az * one + ay * sA);
        const ry = ux * (ay * ax * one + az * sA) + uy * (cA + ay * ay * one) + uz * (ay * az * one - ax * sA);
        const rz = ux * (az * ax * one - ay * sA) + uy * (az * ay * one + ax * sA) + uz * (cA + az * az * one);
        ux = rx;
        uy = ry;
        uz = rz;
      }
      tx = ntx;
      ty = nty;
      tz = ntz;
    } else {
      tx = ntx;
      ty = nty;
      tz = ntz;
    }

    let d = ux * tx + uy * ty + uz * tz;
    ux -= tx * d;
    uy -= ty * d;
    uz -= tz * d;
    let ul = Math.hypot(ux, uy, uz);
    if (ul < 0.2) {
      const altX = 1 - tx * tx;
      const altY = 0 - tx * ty;
      const altZ = 0 - tx * tz;
      ux = altX;
      uy = altY;
      uz = altZ;
      ul = Math.hypot(ux, uy, uz);
    }
    ux /= ul;
    uy /= ul;
    uz /= ul;

    if (p.bank) {
      const sB = Math.sin(p.bank);
      const cB = Math.cos(p.bank);
      const one = 1 - cB;
      const ax = tx;
      const ay = ty;
      const az = tz;
      const rx = ux * (cB + ax * ax * one) + uy * (ax * ay * one - az * sB) + uz * (ax * az * one + ay * sB);
      const ry = ux * (ay * ax * one + az * sB) + uy * (cB + ay * ay * one) + uz * (ay * az * one - ax * sB);
      const rz = ux * (az * ax * one - ay * sB) + uy * (az * ay * one + ax * sB) + uz * (cB + az * az * one);
      ux = rx;
      uy = ry;
      uz = rz;
      d = ux * tx + uy * ty + uz * tz;
      ux -= tx * d;
      uy -= ty * d;
      uz -= tz * d;
      ul = Math.hypot(ux, uy, uz) || 1;
      ux /= ul;
      uy /= ul;
      uz /= ul;
    }

    let rx = ty * uz - tz * uy;
    let ry = tz * ux - tx * uz;
    let rz = tx * uy - ty * ux;
    const rl = Math.hypot(rx, ry, rz) || 1;
    rx /= rl;
    ry /= rl;
    rz /= rl;
    ux = ry * tz - rz * ty;
    uy = rz * tx - rx * tz;
    uz = rx * ty - ry * tx;

    const flattenThis =
      stabilizeUp || (stabilizeFlats && Math.abs(ty) < 0.52 && p.y < 7);
    if (flattenThis) {
      let wx = -tx * ty;
      let wy = 1 - ty * ty;
      let wz = -tz * ty;
      const wl = Math.hypot(wx, wy, wz);
      if (wl < 0.12) {
        if (uy < 0) {
          ux = -ux;
          uy = -uy;
          uz = -uz;
        }
      } else {
        ux = wx / wl;
        uy = wy / wl;
        uz = wz / wl;
        if (p.bank) {
          const sB = Math.sin(p.bank);
          const cB = Math.cos(p.bank);
          const one = 1 - cB;
          const ax = tx;
          const ay = ty;
          const az = tz;
          const nux = ux * (cB + ax * ax * one) + uy * (ax * ay * one - az * sB) + uz * (ax * az * one + ay * sB);
          const nuy = ux * (ay * ax * one + az * sB) + uy * (cB + ay * ay * one) + uz * (ay * az * one - ax * sB);
          const nuz = ux * (az * ax * one - ay * sB) + uy * (az * ay * one + ax * sB) + uz * (cB + az * az * one);
          ux = nux;
          uy = nuy;
          uz = nuz;
        }
      }
      rx = ty * uz - tz * uy;
      ry = tz * ux - tx * uz;
      rz = tx * uy - ty * ux;
      const rl2 = Math.hypot(rx, ry, rz) || 1;
      rx /= rl2;
      ry /= rl2;
      rz /= rl2;
      ux = ry * tz - rz * ty;
      uy = rz * tx - rx * tz;
      uz = rx * ty - ry * tx;
    }

    if (i > 0) {
      const prev = pts[i - 1]!;
      arc += Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z);
    }

    samples.push({
      x: p.x,
      y: p.y,
      z: p.z,
      tx,
      ty,
      tz,
      ux,
      uy,
      uz,
      rx,
      ry,
      rz,
      width: p.width,
      s: arc,
      boost: p.boost,
      checkpoint: p.checkpoint,
      surface: p.surface ?? "plastic",
    });
  }

  return samples;
}

export function compileTrack(def: TrackDef): BuiltTrack {
  const fallback = def.defaultSurface ?? defaultSurface(def.id);
  const nodes = def.nodes.map((n) => (n.surface ? n : { ...n, surface: fallback }));
  const samples = rasterize(nodes, def.closed, def.id !== "helix", def.id === "helix");
  for (const sm of samples) {
    if (!sm.surface) sm.surface = fallback;
  }
  const length = samples[samples.length - 1]?.s ?? 1;
  const checkpoints: number[] = [];
  const boosts: number[] = [];
  for (const sm of samples) {
    if (sm.checkpoint) checkpoints.push(sm.s);
    if (sm.boost) boosts.push(sm.s);
  }
  return { def, samples, length, checkpoints, boosts };
}

function writeEmptySample(dst: Sample): Sample {
  dst.x = 0;
  dst.y = 0;
  dst.z = 0;
  dst.tx = 0;
  dst.ty = 0;
  dst.tz = -1;
  dst.ux = 0;
  dst.uy = 1;
  dst.uz = 0;
  dst.rx = 1;
  dst.ry = 0;
  dst.rz = 0;
  dst.width = 12;
  dst.s = 0;
  dst.boost = false;
  dst.checkpoint = false;
  dst.surface = "plastic";
  return dst;
}

export function sampleAt(track: BuiltTrack, s: number, out?: Sample): Sample {
  const { samples, length, def } = track;
  if (samples.length === 0) {
    return writeEmptySample(out ?? ({} as Sample));
  }
  let ss = s;
  if (def.closed) {
    ss = ((ss % length) + length) % length;
  } else {
    ss = Math.max(0, Math.min(length, ss));
  }
  let lo = 0;
  let hi = samples.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid]!.s < ss) lo = mid + 1;
    else hi = mid;
  }
  const i1 = Math.max(1, lo);
  const a = samples[i1 - 1]!;
  const b = samples[i1]!;
  const span = b.s - a.s || 1;
  const t = Math.max(0, Math.min(1, (ss - a.s) / span));
  let tx = lerp(a.tx, b.tx, t);
  let ty = lerp(a.ty, b.ty, t);
  let tz = lerp(a.tz, b.tz, t);
  let tl = Math.hypot(tx, ty, tz) || 1;
  tx /= tl;
  ty /= tl;
  tz /= tl;
  let ux = lerp(a.ux, b.ux, t);
  let uy = lerp(a.uy, b.uy, t);
  let uz = lerp(a.uz, b.uz, t);
  const ud = ux * tx + uy * ty + uz * tz;
  ux -= tx * ud;
  uy -= ty * ud;
  uz -= tz * ud;
  let ul = Math.hypot(ux, uy, uz);
  if (ul < 0.2) {
    ux = 0;
    uy = 1;
    uz = 0;
    ul = 1;
  }
  ux /= ul;
  uy /= ul;
  uz /= ul;
  let rx = ty * uz - tz * uy;
  let ry = tz * ux - tx * uz;
  let rz = tx * uy - ty * ux;
  const rl = Math.hypot(rx, ry, rz) || 1;
  rx /= rl;
  ry /= rl;
  rz /= rl;
  ux = ry * tz - rz * ty;
  uy = rz * tx - rx * tz;
  uz = rx * ty - ry * tx;
  const dst = out ?? ({} as Sample);
  dst.x = lerp(a.x, b.x, t);
  dst.y = lerp(a.y, b.y, t);
  dst.z = lerp(a.z, b.z, t);
  dst.tx = tx;
  dst.ty = ty;
  dst.tz = tz;
  dst.ux = ux;
  dst.uy = uy;
  dst.uz = uz;
  dst.rx = rx;
  dst.ry = ry;
  dst.rz = rz;
  dst.width = lerp(a.width, b.width, t);
  dst.s = ss;
  dst.boost = a.boost || b.boost;
  dst.checkpoint = false;
  dst.surface = t < 0.5 ? a.surface : b.surface;
  return dst;
}

export function nearestSample(
  track: BuiltTrack,
  x: number,
  y: number,
  z: number,
  hintS: number,
  opts?: { noWrap?: boolean; minUy?: number; maxDs?: number; window?: number },
): Sample {
  const { samples } = track;
  const n = samples.length;
  if (!n) return sampleAt(track, 0);
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid]!.s < hintS) lo = mid + 1;
    else hi = mid;
  }
  const start = Math.max(0, lo);
  const hintSm = sampleAt(track, hintS, _hintSample);
  let best = samples[start]!;
  let bestD = Infinity;
  let fallback = best;
  let fallbackD = Infinity;
  const window = Math.min(n, opts?.window ?? 80);
  const minUy = opts?.minUy;
  const maxDs = opts?.maxDs;
  const wrap = track.def.closed && !opts?.noWrap;
  const L = track.length || 1;
  for (let k = -window; k <= window; k++) {
    let i = start + k;
    if (wrap) i = ((i % n) + n) % n;
    else if (i < 0 || i >= n) continue;
    const sm = samples[i]!;
    let ds = sm.s - hintS;
    if (wrap) {
      ds = ((ds % L) + L) % L;
      if (ds > L * 0.5) ds -= L;
    }
    if (maxDs != null && Math.abs(ds) > maxDs) continue;
    let d = (sm.x - x) ** 2 + (sm.y - y) ** 2 + (sm.z - z) ** 2;
    // Closed ribbons overlap at the start/finish. Index neighbors from the
    // closing stretch sit a few metres left/right of the outbound lane and
    // win a pure XYZ race — that is the pre-CP1 left-shoulder snap.
    if (wrap) {
      const align = sm.tx * hintSm.tx + sm.ty * hintSm.ty + sm.tz * hintSm.tz;
      if (align < 0.12) d += 28;
      d += Math.abs(ds) * 0.22;
    }
    if (d < fallbackD) {
      fallbackD = d;
      fallback = sm;
    }
    if (minUy != null && sm.uy < minUy) continue;
    if (d < bestD) {
      bestD = d;
      best = sm;
    }
  }
  return bestD < Infinity ? best : fallback;
}

export function crossedGate(prev: number, next: number, gate: number, length: number, closed: boolean) {
  if (!closed) return prev < gate && next >= gate;
  const p = ((prev % length) + length) % length;
  let q = next;
  if (next - prev > length * 0.5) q = next - length;
  if (prev - next > length * 0.5) q = next + length;
  const g1 = gate;
  const g2 = gate + length;
  const g0 = gate - length;
  return (p < g1 && q >= g1) || (p < g2 && q >= g2) || (p < g0 && q >= g0);
}

export function buildTrackMeshes(track: BuiltTrack, theme: ThemeId, budget?: TextureBudget) {
  const samples = track.samples;
  const closed = track.def.closed;
  const count = closed ? samples.length : samples.length - 1;
  const roadPos: number[] = [];
  const roadNrm: number[] = [];
  const roadUv: number[] = [];
  const roadCol: number[] = [];
  const curbPos: number[] = [];
  const curbNrm: number[] = [];
  const curbCol: number[] = [];
  const wallPos: number[] = [];
  const wallNrm: number[] = [];
  const wallCol: number[] = [];
  const markPos: number[] = [];
  const markNrm: number[] = [];
  const markUv: number[] = [];
  const markCol: number[] = [];
  const railPos: number[] = [];
  const railNrm: number[] = [];
  const railCol: number[] = [];

  const pushTri = (
    pos: number[],
    nrm: number[],
    col: number[] | null,
    uv: number[] | null,
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    cx: number,
    cy: number,
    cz: number,
    nx: number,
    ny: number,
    nz: number,
    color: { r: number; g: number; b: number },
    uvs?: [number, number, number, number, number, number],
  ) => {
    pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    nrm.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    if (col) col.push(color.r, color.g, color.b, color.r, color.g, color.b, color.r, color.g, color.b);
    if (uv && uvs) uv.push(...uvs);
  };

  const strip = (
    pos: number[],
    nrm: number[],
    col: number[] | null,
    uv: number[] | null,
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    cx: number,
    cy: number,
    cz: number,
    dx: number,
    dy: number,
    dz: number,
    nx: number,
    ny: number,
    nz: number,
    color: { r: number; g: number; b: number },
    u0: number,
    u1: number,
  ) => {
    pushTri(pos, nrm, col, uv, ax, ay, az, bx, by, bz, dx, dy, dz, nx, ny, nz, color, [u0, 0, u0, 1, u1, 1]);
    pushTri(pos, nrm, col, uv, ax, ay, az, dx, dy, dz, cx, cy, cz, nx, ny, nz, color, [u0, 0, u1, 1, u1, 0]);
  };

  const dummy = new THREE.Object3D();
  const postMats: THREE.Matrix4[] = [];

  for (let i = 0; i < count; i++) {
    const a = samples[i]!;
    const b = samples[(i + 1) % samples.length]!;
    const ha = a.width * 0.5;
    const hb = b.width * 0.5;
    const alx = a.x - a.rx * ha;
    const aly = a.y - a.ry * ha;
    const alz = a.z - a.rz * ha;
    const arx = a.x + a.rx * ha;
    const ary = a.y + a.ry * ha;
    const arz = a.z + a.rz * ha;
    const blx = b.x - b.rx * hb;
    const bly = b.y - b.ry * hb;
    const blz = b.z - b.rz * hb;
    const brx = b.x + b.rx * hb;
    const bry = b.y + b.ry * hb;
    const brz = b.z + b.rz * hb;

    const u0 = a.s * 0.08;
    const u1 = b.s * 0.08;
    const crown = roadCrown(theme);
    const tint = roadSurfaceTint(theme, a.surface);
    const band = surfaceBand(a.surface, a.s);
    const colL = {
      r: Math.max(0.04, tint.r * crown.edge + band),
      g: Math.max(0.04, tint.g * crown.edge + band * 0.9),
      b: Math.max(0.04, tint.b * crown.edge + band * 1.1),
    };
    const colM = {
      r: Math.max(0.04, tint.r * crown.mid + band * 0.7),
      g: Math.max(0.04, tint.g * crown.mid + band * 0.65),
      b: Math.max(0.04, tint.b * crown.mid + band * 0.85),
    };
    const amx = (alx + arx) * 0.5;
    const amy = (aly + ary) * 0.5;
    const amz = (alz + arz) * 0.5;
    const bmx = (blx + brx) * 0.5;
    const bmy = (bly + bry) * 0.5;
    const bmz = (blz + brz) * 0.5;
    strip(roadPos, roadNrm, roadCol, roadUv, alx, aly, alz, amx, amy, amz, blx, bly, blz, bmx, bmy, bmz, a.ux, a.uy, a.uz, colL, u0, u1);
    strip(roadPos, roadNrm, roadCol, roadUv, amx, amy, amz, arx, ary, arz, bmx, bmy, bmz, brx, bry, brz, a.ux, a.uy, a.uz, colM, u0, u1);

    const sausage = curbBlockHigh(theme, (a.s + b.s) * 0.5);
    const { width: cw, height: ch, lift } = curbDims(theme, sausage);
    for (const side of [-1, 1] as const) {
      const aox = side < 0 ? alx : arx;
      const aoy = side < 0 ? aly : ary;
      const aoz = side < 0 ? alz : arz;
      const box = side < 0 ? blx : brx;
      const boy = side < 0 ? bly : bry;
      const boz = side < 0 ? blz : brz;
      const curbA = curbColor(theme, side, sausage);
      const aex = aox + a.rx * side * cw + a.ux * ch;
      const aey = aoy + a.ry * side * cw + a.uy * ch;
      const aez = aoz + a.rz * side * cw + a.uz * ch;
      const bex = box + b.rx * side * cw + b.ux * ch;
      const bey = boy + b.ry * side * cw + b.uy * ch;
      const bez = boz + b.rz * side * cw + b.uz * ch;
      strip(
        curbPos,
        curbNrm,
        curbCol,
        null,
        aox + a.ux * lift,
        aoy + a.uy * lift,
        aoz + a.uz * lift,
        aex,
        aey,
        aez,
        box + b.ux * lift,
        boy + b.uy * lift,
        boz + b.uz * lift,
        bex,
        bey,
        bez,
        a.ux,
        a.uy,
        a.uz,
        curbA,
        u0,
        u1,
      );
      const nx = a.rx * side;
      const ny = a.ry * side;
      const nz = a.rz * side;
      pushTri(curbPos, curbNrm, curbCol, null, aox, aoy, aoz, bex, bey, bez, aex, aey, aez, nx, ny, nz, curbA);
      pushTri(curbPos, curbNrm, curbCol, null, aox, aoy, aoz, box, boy, boz, bex, bey, bez, nx, ny, nz, curbA);

      const lip = lipWidth(theme);
      const lipCol = lipColor(theme);
      const l0x = aox - a.rx * side * lip + a.ux * 0.03;
      const l0y = aoy - a.ry * side * lip + a.uy * 0.03;
      const l0z = aoz - a.rz * side * lip + a.uz * 0.03;
      const l1x = aox + a.ux * 0.03;
      const l1y = aoy + a.uy * 0.03;
      const l1z = aoz + a.uz * 0.03;
      const l2x = box - b.rx * side * lip + b.ux * 0.03;
      const l2y = boy - b.ry * side * lip + b.uy * 0.03;
      const l2z = boz - b.rz * side * lip + b.uz * 0.03;
      const l3x = box + b.ux * 0.03;
      const l3y = boy + b.uy * 0.03;
      const l3z = boz + b.uz * 0.03;
      strip(markPos, markNrm, markCol, markUv, l0x, l0y, l0z, l1x, l1y, l1z, l2x, l2y, l2z, l3x, l3y, l3z, a.ux, a.uy, a.uz, lipCol, u0, u1);

      const railH0 = 0.34;
      const railH1 = 0.62;
      const rd = 0.62;
      const wallColV =
        theme === "stadium"
          ? { r: 0.78, g: 0.8, b: 0.76 }
          : theme === "canyon"
            ? { r: 0.55, g: 0.38, b: 0.28 }
            : theme === "alpine"
              ? { r: 0.72, g: 0.8, b: 0.88 }
              : theme === "works"
                ? side < 0
                  ? { r: 0.12, g: 0.82, b: 0.78 }
                  : { r: 0.92, g: 0.42, b: 0.12 }
                : theme === "mesa"
                  ? { r: 0.86, g: 0.56, b: 0.22 }
                  : theme === "grove"
                    ? side < 0
                      ? { r: 0.28, g: 0.72, b: 0.42 }
                      : { r: 0.72, g: 0.62, b: 0.22 }
                    : theme === "ember"
                      ? side < 0
                        ? { r: 1, g: 0.32, b: 0.08 }
                        : { r: 0.72, g: 0.18, b: 0.08 }
                      : theme === "storm"
                        ? side < 0
                          ? { r: 0.22, g: 0.64, b: 0.86 }
                          : { r: 0.7, g: 0.78, b: 0.88 }
                        : side < 0
                          ? { r: 0.2, g: 0.72, b: 0.95 }
                          : { r: 0.9, g: 0.22, b: 0.62 };
      const a0x = aox + a.rx * side * rd + a.ux * railH0;
      const a0y = aoy + a.ry * side * rd + a.uy * railH0;
      const a0z = aoz + a.rz * side * rd + a.uz * railH0;
      const b0x = box + b.rx * side * rd + b.ux * railH0;
      const b0y = boy + b.ry * side * rd + b.uy * railH0;
      const b0z = boz + b.rz * side * rd + b.uz * railH0;
      const a1x = aox + a.rx * side * rd + a.ux * railH1;
      const a1y = aoy + a.ry * side * rd + a.uy * railH1;
      const a1z = aoz + a.rz * side * rd + a.uz * railH1;
      const b1x = box + b.rx * side * rd + b.ux * railH1;
      const b1y = boy + b.ry * side * rd + b.uy * railH1;
      const b1z = boz + b.rz * side * rd + b.uz * railH1;
      strip(railPos, railNrm, railCol, null, a0x, a0y, a0z, a1x, a1y, a1z, b0x, b0y, b0z, b1x, b1y, b1z, nx, ny, nz, wallColV, u0, u1);

      const catchH = 0.9;
      const aTopX = aex + a.ux * catchH * 0.15;
      const aTopY = aey + a.uy * catchH * 0.15;
      const aTopZ = aez + a.uz * catchH * 0.15;
      const bTopX = bex + b.ux * catchH * 0.15;
      const bTopY = bey + b.uy * catchH * 0.15;
      const bTopZ = bez + b.uz * catchH * 0.15;
      const inner =
        theme === "night"
          ? { r: 0.24, g: 0.3, b: 0.4 }
          : theme === "alpine"
            ? { r: 0.78, g: 0.86, b: 0.92 }
            : theme === "works"
              ? { r: 0.32, g: 0.28, b: 0.24 }
              : theme === "mesa"
                ? { r: 0.62, g: 0.42, b: 0.22 }
                : theme === "grove"
                  ? { r: 0.16, g: 0.24, b: 0.18 }
                  : theme === "ember"
                    ? { r: 0.42, g: 0.18, b: 0.1 }
                    : theme === "storm"
                      ? { r: 0.22, g: 0.28, b: 0.34 }
                      : { r: 0.82, g: 0.8, b: 0.74 };
      pushTri(wallPos, wallNrm, wallCol, null, aex, aey, aez, bTopX, bTopY, bTopZ, aTopX, aTopY, aTopZ, nx, ny, nz, inner);
      pushTri(wallPos, wallNrm, wallCol, null, aex, aey, aez, bex, bey, bez, bTopX, bTopY, bTopZ, nx, ny, nz, inner);

      if (i % 3 === 0) {
        dummy.position.set(
          aox + a.rx * side * 0.7 + a.ux * 0.55,
          aoy + a.ry * side * 0.7 + a.uy * 0.55,
          aoz + a.rz * side * 0.7 + a.uz * 0.55,
        );
        dummy.quaternion.identity();
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        postMats.push(dummy.matrix.clone());
      }
    }

    const dashOn = Math.floor(a.s / (a.surface === "ice" ? 3.2 : 4.4)) % 2 === 0;
    if (dashOn && !a.boost && surfaceShowsDash(a.surface)) {
      const hw = 0.09;
      const ly0x = a.x - a.rx * hw + a.ux * 0.03;
      const ly0y = a.y - a.ry * hw + a.uy * 0.03;
      const ly0z = a.z - a.rz * hw + a.uz * 0.03;
      const ly1x = a.x + a.rx * hw + a.ux * 0.03;
      const ly1y = a.y + a.ry * hw + a.uy * 0.03;
      const ly1z = a.z + a.rz * hw + a.uz * 0.03;
      const ly2x = b.x - b.rx * hw + b.ux * 0.03;
      const ly2y = b.y - b.ry * hw + b.uy * 0.03;
      const ly2z = b.z - b.rz * hw + b.uz * 0.03;
      const ly3x = b.x + b.rx * hw + b.ux * 0.03;
      const ly3y = b.y + b.ry * hw + b.uy * 0.03;
      const ly3z = b.z + b.rz * hw + b.uz * 0.03;
      const white = surfaceDashColor(a.surface);
      strip(markPos, markNrm, markCol, markUv, ly0x, ly0y, ly0z, ly1x, ly1y, ly1z, ly2x, ly2y, ly2z, ly3x, ly3y, ly3z, a.ux, a.uy, a.uz, white, u0, u1);
    }

    const { width: edgeW, inset, color: edgeCol } = edgeMark(theme);
    for (const side of [-1, 1] as const) {
      const e0x = a.x + a.rx * side * (ha - inset) + a.ux * 0.025;
      const e0y = a.y + a.ry * side * (ha - inset) + a.uy * 0.025;
      const e0z = a.z + a.rz * side * (ha - inset) + a.uz * 0.025;
      const e1x = a.x + a.rx * side * (ha - inset - edgeW) + a.ux * 0.025;
      const e1y = a.y + a.ry * side * (ha - inset - edgeW) + a.uy * 0.025;
      const e1z = a.z + a.rz * side * (ha - inset - edgeW) + a.uz * 0.025;
      const e2x = b.x + b.rx * side * (hb - inset) + b.ux * 0.025;
      const e2y = b.y + b.ry * side * (hb - inset) + b.uy * 0.025;
      const e2z = b.z + b.rz * side * (hb - inset) + b.uz * 0.025;
      const e3x = b.x + b.rx * side * (hb - inset - edgeW) + b.ux * 0.025;
      const e3y = b.y + b.ry * side * (hb - inset - edgeW) + b.uy * 0.025;
      const e3z = b.z + b.rz * side * (hb - inset - edgeW) + b.uz * 0.025;
      strip(markPos, markNrm, markCol, markUv, e1x, e1y, e1z, e0x, e0y, e0z, e3x, e3y, e3z, e2x, e2y, e2z, a.ux, a.uy, a.uz, edgeCol, u0, u1);
    }
  }

  const texOpts = { size: budget?.size ?? 256, anisotropy: budget?.anisotropy ?? 8 };
  const asphalt = makeAsphaltTexture(theme, texOpts);
  asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping;
  asphalt.repeat.set(1, 1);
  const asphaltRough = budget?.roughnessMap === false ? null : makeAsphaltRoughness(theme, texOpts);

  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute("position", new THREE.Float32BufferAttribute(roadPos, 3));
  roadGeo.setAttribute("normal", new THREE.Float32BufferAttribute(roadNrm, 3));
  roadGeo.setAttribute("uv", new THREE.Float32BufferAttribute(roadUv, 2));
  roadGeo.setAttribute("color", new THREE.Float32BufferAttribute(roadCol, 3));
  // Keep authored ribbon normals. computeVertexNormals() follows triangle
  // winding, which faces down and paints the driving surface black at night.

  const curbGeo = new THREE.BufferGeometry();
  curbGeo.setAttribute("position", new THREE.Float32BufferAttribute(curbPos, 3));
  curbGeo.setAttribute("normal", new THREE.Float32BufferAttribute(curbNrm, 3));
  curbGeo.setAttribute("color", new THREE.Float32BufferAttribute(curbCol, 3));
  // Keep authored curb normals so red/white blocks stay faceted, not rounded.

  const wallGeo = new THREE.BufferGeometry();
  wallGeo.setAttribute("position", new THREE.Float32BufferAttribute(wallPos, 3));
  wallGeo.setAttribute("normal", new THREE.Float32BufferAttribute(wallNrm, 3));
  wallGeo.setAttribute("color", new THREE.Float32BufferAttribute(wallCol, 3));
  wallGeo.computeVertexNormals();

  const markGeo = new THREE.BufferGeometry();
  markGeo.setAttribute("position", new THREE.Float32BufferAttribute(markPos, 3));
  markGeo.setAttribute("normal", new THREE.Float32BufferAttribute(markNrm, 3));
  markGeo.setAttribute("color", new THREE.Float32BufferAttribute(markCol, 3));

  const railGeo = new THREE.BufferGeometry();
  railGeo.setAttribute("position", new THREE.Float32BufferAttribute(railPos, 3));
  railGeo.setAttribute("normal", new THREE.Float32BufferAttribute(railNrm, 3));
  railGeo.setAttribute("color", new THREE.Float32BufferAttribute(railCol, 3));
  railGeo.computeVertexNormals();

  const roadMat = new THREE.MeshStandardMaterial({
    map: asphalt,
    roughnessMap: asphaltRough ?? undefined,
    vertexColors: true,
    roughness: theme === "night" ? 0.38 : theme === "stadium" ? 0.52 : theme === "alpine" ? 0.58 : theme === "works" ? 0.44 : theme === "mesa" ? 0.7 : theme === "grove" ? 0.48 : theme === "ember" ? 0.68 : theme === "storm" ? 0.42 : 0.74,
    metalness: theme === "night" ? 0.16 : theme === "stadium" ? 0.08 : theme === "alpine" ? 0.12 : theme === "works" ? 0.2 : theme === "mesa" ? 0.06 : theme === "grove" ? 0.1 : theme === "ember" ? 0.08 : theme === "storm" ? 0.18 : 0.05,
    emissive: theme === "night" ? 0x1c2438 : theme === "alpine" ? 0x101820 : theme === "works" ? 0x181410 : theme === "mesa" ? 0x201808 : theme === "grove" ? 0x081410 : theme === "ember" ? 0x281008 : theme === "storm" ? 0x081018 : 0x000000,
    emissiveIntensity: theme === "night" ? 0.34 : theme === "alpine" ? 0.06 : theme === "works" ? 0.12 : theme === "mesa" ? 0.08 : theme === "grove" ? 0.16 : theme === "ember" ? 0.14 : theme === "storm" ? 0.18 : 0,
    side: THREE.DoubleSide,
  });
  const curbMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: theme === "stadium" ? 0.22 : theme === "alpine" ? 0.26 : theme === "works" ? 0.28 : theme === "mesa" ? 0.36 : theme === "ember" ? 0.34 : theme === "storm" ? 0.3 : 0.32,
    metalness: theme === "night" ? 0.28 : theme === "stadium" ? 0.08 : theme === "alpine" ? 0.14 : theme === "works" ? 0.22 : theme === "grove" ? 0.16 : theme === "storm" ? 0.2 : 0.06,
    emissive: theme === "night" ? 0x3a2060 : theme === "stadium" ? 0x2a0808 : theme === "alpine" ? 0x102028 : theme === "works" ? 0x281808 : theme === "mesa" ? 0x281404 : theme === "grove" ? 0x102818 : theme === "ember" ? 0x301004 : theme === "storm" ? 0x102028 : 0x140404,
    emissiveIntensity: theme === "night" ? 0.62 : theme === "stadium" ? 0.12 : theme === "alpine" ? 0.1 : theme === "works" ? 0.22 : theme === "mesa" ? 0.14 : theme === "grove" ? 0.28 : theme === "ember" ? 0.2 : theme === "storm" ? 0.24 : 0.04,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.7,
    metalness: 0.04,
    transparent: true,
    opacity: 0.32,
  });
  const markMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.38,
    metalness: 0.06,
    emissive: theme === "night" ? 0x102028 : theme === "works" ? 0x141210 : theme === "grove" ? 0x0c1810 : theme === "ember" ? 0x201008 : theme === "storm" ? 0x0c141c : 0x000000,
    emissiveIntensity: theme === "night" ? 0.28 : theme === "works" ? 0.08 : theme === "grove" ? 0.12 : theme === "ember" ? 0.1 : theme === "storm" ? 0.14 : 0,
  });
  const railMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.35,
    metalness: theme === "night" ? 0.55 : theme === "works" ? 0.5 : theme === "grove" ? 0.38 : theme === "storm" ? 0.48 : 0.4,
    emissive: theme === "night" ? 0x3a60a0 : theme === "alpine" ? 0x203040 : theme === "works" ? 0x146060 : theme === "mesa" ? 0x402008 : theme === "grove" ? 0x184028 : theme === "ember" ? 0x501808 : theme === "storm" ? 0x184060 : 0x000000,
    emissiveIntensity: theme === "night" ? 0.85 : theme === "alpine" ? 0.18 : theme === "works" ? 0.42 : theme === "mesa" ? 0.16 : theme === "grove" ? 0.38 : theme === "ember" ? 0.28 : theme === "storm" ? 0.4 : 0,
  });
  const postGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.85, 5);
  const postMat = new THREE.MeshStandardMaterial({
    color: theme === "canyon" ? 0x6a4634 : theme === "night" ? 0x1c222c : theme === "alpine" ? 0x8a7a68 : theme === "works" ? 0x3a3228 : theme === "mesa" ? 0x8a6238 : theme === "grove" ? 0x1a2418 : theme === "ember" ? 0x4a2214 : theme === "storm" ? 0x1c2834 : 0xb8b4aa,
    roughness: 0.5,
    metalness: 0.35,
  });
  const posts = new THREE.InstancedMesh(postGeo, postMat, postMats.length);
  posts.castShadow = true;
  for (let i = 0; i < postMats.length; i++) posts.setMatrixAt(i, postMats[i]!);

  const group = new THREE.Group();
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.receiveShadow = true;
  const curb = new THREE.Mesh(curbGeo, curbMat);
  curb.receiveShadow = true;
  curb.castShadow = true;
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.receiveShadow = true;
  const marks = new THREE.Mesh(markGeo, markMat);
  const rails = new THREE.Mesh(railGeo, railMat);
  rails.castShadow = true;
  group.add(road, curb, wall, marks, rails, posts);

  const checker = makeCheckerTexture();
  checker.repeat.set(4, 1);
  const gridMat = new THREE.MeshStandardMaterial({
    map: checker,
    roughness: 0.5,
    metalness: 0.08,
  });
  const finish = sampleAt(track, 2.2);
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), gridMat);
  grid.position.set(finish.x + finish.ux * 0.04, finish.y + finish.uy * 0.04, finish.z + finish.uz * 0.04);
  grid.scale.set(finish.width * 0.92, 1.5, 1);
  {
    const x = new THREE.Vector3(finish.rx, finish.ry, finish.rz).normalize();
    const y = new THREE.Vector3(finish.tx, finish.ty, finish.tz).normalize();
    const z = new THREE.Vector3(finish.ux, finish.uy, finish.uz).normalize();
    grid.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  }
  group.add(grid);

  const boostMat = new THREE.MeshStandardMaterial({
    color: theme === "night" ? 0x6ec8ff : theme === "works" ? 0x4ee8d4 : theme === "grove" ? 0x7ee8a0 : theme === "ember" ? 0xff7a30 : theme === "storm" ? 0x7ec8e8 : 0xe8c56a,
    emissive: theme === "night" ? 0x3a8cff : theme === "works" ? 0x1aa890 : theme === "grove" ? 0x2a8850 : theme === "ember" ? 0xc04010 : theme === "storm" ? 0x2a6088 : 0xc9a44a,
    emissiveIntensity: 1.35,
    roughness: 0.28,
    metalness: 0.28,
    side: THREE.DoubleSide,
  });
  const boostPadMat = new THREE.MeshStandardMaterial({
    color: theme === "night" ? 0x3a80c8 : theme === "ember" ? 0xc05018 : 0xc9a44a,
    emissive: theme === "night" ? 0x1a4a88 : theme === "works" ? 0x0a6058 : theme === "ember" ? 0x801808 : theme === "storm" ? 0x184060 : 0x6a4a10,
    emissiveIntensity: 0.55,
    roughness: 0.42,
    metalness: 0.18,
    transparent: true,
    opacity: 0.38,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const chevron = new THREE.BufferGeometry();
  const cv = new Float32Array([0, 0.5, 0, -0.45, -0.5, 0, 0.45, -0.5, 0]);
  chevron.setAttribute("position", new THREE.BufferAttribute(cv, 3));
  chevron.computeVertexNormals();
  const padGeo = new THREE.PlaneGeometry(1, 1);
  for (const bs of track.boosts) {
    const sm = sampleAt(track, bs);
    const basis = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(sm.rx, sm.ry, sm.rz).normalize(),
      new THREE.Vector3(sm.tx, sm.ty, sm.tz).normalize(),
      new THREE.Vector3(sm.ux, sm.uy, sm.uz).normalize(),
    );
    const pad = new THREE.Mesh(padGeo, boostPadMat);
    pad.position.set(sm.x + sm.ux * 0.03, sm.y + sm.uy * 0.03, sm.z + sm.uz * 0.03);
    pad.scale.set(sm.width * 0.62, 3.4, 1);
    pad.quaternion.setFromRotationMatrix(basis);
    pad.renderOrder = 1;
    group.add(pad);
    for (let k = 0; k < 3; k++) {
      const mesh = new THREE.Mesh(chevron, boostMat);
      const along = (k - 1) * 1.15;
      mesh.position.set(
        sm.x + sm.tx * along + sm.ux * 0.05,
        sm.y + sm.ty * along + sm.uy * 0.05,
        sm.z + sm.tz * along + sm.uz * 0.05,
      );
      mesh.scale.set(sm.width * 0.22, 1.1, 1);
      mesh.quaternion.setFromRotationMatrix(basis);
      group.add(mesh);
    }
  }

  return {
    group,
    materials: [roadMat, curbMat, wallMat, markMat, railMat, postMat, boostMat, boostPadMat, gridMat],
    geos: [roadGeo, curbGeo, wallGeo, markGeo, railGeo, postGeo, chevron, padGeo, grid.geometry as THREE.BufferGeometry],
    textures: asphaltRough ? [asphalt, asphaltRough, checker] : [asphalt, checker],
  };
}

function circuitNodes() {
  return new PathBuilder()
    .setWidth(12.5)
    .setSurface("plastic")
    .straight(70)
    .curve(-Math.PI * 0.5, 34)
    .straight(42, { checkpoint: true })
    .curve(Math.PI * 0.38, 18, { width: 11 })
    .curve(-Math.PI * 0.48, 16)
    .straight(30, { boost: true, width: 12.5 })
    .curve(Math.PI * 0.95, 28, { bank: 0.42 })
    .straight(22)
    .straight(48, { climb: 11 })
    .straight(14)
    .straight(42, { climb: -11, checkpoint: true })
    .curve(-Math.PI * 0.72, 24, { bank: 0.36 })
    .straight(46, { boost: true })
    .curve(Math.PI * 0.42, 30)
    .straight(28, { checkpoint: true })
    .curve(Math.PI * 0.55, 26)
    .straight(20)
    .close()
    .build();
}

function canyonNodes() {
  return new PathBuilder()
    .setWidth(12)
    .setSurface("plastic")
    .straight(48)
    .setSurface("dirt")
    .curve(-Math.PI * 0.55, 36)
    .straight(34, { climb: 14, checkpoint: true })
    .curve(Math.PI * 0.85, 26, { bank: 0.48, climb: 6 })
    .straight(18)
    .straight(90, { climb: -30, boost: true, width: 13 })
    .straight(24, { checkpoint: true })
    .curve(-Math.PI * 0.92, 32, { bank: 0.5 })
    .straight(36, { climb: 8 })
    .straight(28, { climb: 16 })
    .straight(12)
    .straight(34, { climb: -14, checkpoint: true })
    .curve(Math.PI * 0.7, 28, { bank: 0.34 })
    .straight(40, { boost: true })
    .curve(-Math.PI * 0.4, 30)
    .straight(18)
    .close()
    .build();
}

function helixNodes() {
  return new PathBuilder()
    .setWidth(11.5)
    .setSurface("tech")
    .straight(44, { boost: true })
    .loop(12.5, 11)
    .straight(22, { checkpoint: true })
    .curve(-Math.PI * 0.7, 20, { bank: 0.4, width: 10.5 })
    .curve(Math.PI, 20, { bank: 1.05, climb: 5 })
    .curve(Math.PI * 0.7, 18, { bank: 1.0, climb: -5 })
    .straight(26, { boost: true, checkpoint: true, width: 11.5 })
    .curve(Math.PI * 1.05, 22, { bank: 0.46 })
    .straight(36)
    .curve(-Math.PI * 0.85, 18, { width: 10.5 })
    .straight(28, { checkpoint: true })
    .straight(24, { boost: true })
    .close()
    .build();
}

function summitNodes() {
  return new PathBuilder()
    .setWidth(12)
    .setSurface("ice")
    .straight(58)
    .curve(-Math.PI * 0.42, 30)
    .straight(26, { checkpoint: true })
    .curve(Math.PI * 0.92, 17, { bank: 0.46, climb: 11, width: 10.6 })
    .straight(20, { climb: 7 })
    .curve(-Math.PI * 0.88, 16, { bank: 0.5, climb: 6, width: 10.4 })
    .straight(22, { boost: true, checkpoint: true, width: 12 })
    .curve(Math.PI * 0.58, 26, { bank: 0.38 })
    .straight(78, { climb: -24, boost: true, width: 13 })
    .straight(20, { checkpoint: true, width: 12 })
    .curve(-Math.PI * 0.38, 18, { width: 11 })
    .curve(Math.PI * 0.42, 16, { width: 10.8 })
    .straight(34, { boost: true, width: 12 })
    .curve(Math.PI * 0.55, 28, { bank: 0.34 })
    .straight(18)
    .close()
    .build();
}

function yardNodes() {
  return new PathBuilder()
    .setWidth(12.2)
    .setSurface("tech")
    .straight(64)
    .curve(-Math.PI * 0.46, 30)
    .straight(30, { checkpoint: true })
    .curve(Math.PI * 0.78, 16, { bank: 0.42, width: 10.6 })
    .curve(-Math.PI * 0.74, 15, { bank: 0.44, width: 10.4 })
    .straight(24, { boost: true, width: 12 })
    .straight(38, { climb: 12 })
    .curve(Math.PI * 0.98, 18, { bank: 0.5, width: 10.8 })
    .straight(24, { checkpoint: true, boost: true, width: 12.2 })
    .straight(84, { climb: -14, width: 13 })
    .curve(-Math.PI * 0.55, 28, { bank: 0.36, width: 12 })
    .straight(26, { checkpoint: true })
    .curve(Math.PI * 0.46, 26)
    .straight(38, { boost: true })
    .curve(Math.PI * 0.52, 30)
    .straight(20)
    .close()
    .build();
}

function mesaNodes() {
  return new PathBuilder()
    .setWidth(13)
    .setSurface("dirt")
    .straight(68)
    .curve(-Math.PI * 0.4, 34)
    .straight(28, { checkpoint: true })
    .straight(56, { climb: 18, width: 12.2 })
    .setSurface("plastic")
    .curve(Math.PI * 0.86, 18, { bank: 0.46, climb: 4, width: 10.8 })
    .straight(16, { climb: 3 })
    .curve(-Math.PI * 0.94, 15, { bank: 0.5, width: 10.4 })
    .straight(24, { boost: true, checkpoint: true, width: 13 })
    .setSurface("dirt")
    .straight(88, { climb: -24, boost: true, width: 13.6 })
    .straight(22, { checkpoint: true, width: 12.4 })
    .curve(Math.PI * 0.52, 30, { bank: 0.34 })
    .straight(36, { boost: true })
    .curve(-Math.PI * 0.44, 28)
    .straight(20)
    .close()
    .build();
}

function hollowNodes() {
  return new PathBuilder()
    .setWidth(11.2)
    .setSurface("dirt")
    .straight(58)
    .curve(-Math.PI * 0.64, 18, { width: 10.4 })
    .straight(26, { checkpoint: true })
    .curve(Math.PI * 0.76, 14, { bank: 0.46, width: 10.1 })
    .curve(-Math.PI * 0.7, 13.2, { bank: 0.48, width: 9.9 })
    .straight(22, { boost: true, width: 11.2 })
    .straight(40, { climb: -12 })
    .curve(Math.PI * 0.98, 16, { bank: 0.52, width: 10.3 })
    .straight(26, { checkpoint: true, boost: true, width: 11.4 })
    .setSurface("tech")
    .straight(62, { climb: 14, width: 11.6 })
    .curve(-Math.PI * 0.56, 22, { bank: 0.38 })
    .straight(28, { checkpoint: true })
    .curve(Math.PI * 0.48, 24)
    .straight(36, { boost: true })
    .curve(Math.PI * 0.42, 26)
    .straight(20)
    .close()
    .build();
}

function emberNodes() {
  return new PathBuilder()
    .setWidth(12.6)
    .setSurface("dirt")
    .straight(62)
    .curve(-Math.PI * 0.72, 30, { bank: 0.4 })
    .straight(28, { checkpoint: true })
    .straight(52, { climb: 16, width: 11.8 })
    .setSurface("plastic")
    .curve(Math.PI * 0.82, 15, { bank: 0.5, climb: 5, width: 10.6 })
    .curve(-Math.PI * 0.78, 14, { bank: 0.48, width: 10.4 })
    .straight(20, { boost: true, checkpoint: true, width: 12.4 })
    .setSurface("dirt")
    .straight(86, { climb: -22, boost: true, width: 13.2 })
    .straight(24, { checkpoint: true, width: 12 })
    .setSurface("plastic")
    .curve(Math.PI * 0.5, 22, { bank: 0.36 })
    .straight(26, { boost: true })
    .setSurface("dirt")
    .curve(-Math.PI * 0.46, 26)
    .straight(18)
    .close()
    .build();
}

function stormNodes() {
  return new PathBuilder()
    .setWidth(12)
    .setSurface("plastic")
    .straight(72)
    .curve(-Math.PI * 0.5, 24, { width: 11.2 })
    .curve(Math.PI * 0.46, 20, { width: 10.8 })
    .straight(30, { checkpoint: true, width: 12 })
    .setSurface("ice")
    .curve(-Math.PI * 0.62, 15, { bank: 0.38, width: 10.6 })
    .straight(16, { width: 11 })
    .setSurface("tech")
    .straight(26, { climb: 10, boost: true, width: 11.6 })
    .curve(Math.PI * 0.88, 16, { bank: 0.46, width: 10.8 })
    .straight(20, { checkpoint: true, boost: true, width: 12 })
    .setSurface("plastic")
    .straight(78, { climb: -12, width: 12.8 })
    .straight(24, { checkpoint: true, width: 12 })
    .setSurface("tech")
    .curve(Math.PI * 0.42, 22, { bank: 0.34 })
    .straight(28, { boost: true })
    .setSurface("plastic")
    .curve(-Math.PI * 0.4, 26)
    .straight(18)
    .close()
    .build();
}

export const TRACK_DEFS: Record<StockTrackId, TrackDef> = {
  circuit: {
    id: "circuit",
    name: "Green Circuit",
    blurb: "Stadium plastic. Two laps, one jump.",
    env: "stadium",
    laps: 2,
    closed: true,
    thumb: "/textures/thumb-circuit.jpg",
    medals: { author: 50_000, gold: 56_000, silver: 64_000, bronze: 78_000 },
    defaultSurface: "plastic",
    nodes: circuitNodes(),
  },
  canyon: {
    id: "canyon",
    name: "Ridge Drop",
    blurb: "Paved start, then dirt. A long descent and a committed jump.",
    env: "canyon",
    laps: 1,
    closed: true,
    thumb: "/textures/thumb-canyon.jpg",
    medals: { author: 30_500, gold: 35_000, silver: 41_000, bronze: 52_000 },
    defaultSurface: "dirt",
    nodes: canyonNodes(),
  },
  helix: {
    id: "helix",
    name: "Night Helix",
    blurb: "Night tech. Loop, corkscrew, keep the speed.",
    env: "night",
    laps: 1,
    closed: true,
    thumb: "/textures/thumb-helix.jpg",
    medals: { author: 27_500, gold: 32_000, silver: 38_000, bronze: 50_000 },
    defaultSurface: "tech",
    nodes: helixNodes(),
  },
  summit: {
    id: "summit",
    name: "White Pass",
    blurb: "Morning ice. Switchbacks, then a long drop.",
    env: "alpine",
    laps: 1,
    closed: true,
    thumb: "/textures/thumb-summit.svg",
    medals: { author: 30_000, gold: 35_000, silver: 42_000, bronze: 52_000 },
    defaultSurface: "ice",
    nodes: summitNodes(),
  },
  yard: {
    id: "yard",
    name: "Arc Yard",
    blurb: "Metal docks. Tight cuts, then a gantry drop.",
    env: "works",
    laps: 1,
    closed: true,
    thumb: "/textures/thumb-yard.svg",
    medals: { author: 31_000, gold: 36_000, silver: 43_000, bronze: 54_000 },
    defaultSurface: "tech",
    nodes: yardNodes(),
  },
  mesa: {
    id: "mesa",
    name: "Red Mesa",
    blurb: "Dirt climb, plastic table, dirt drop.",
    env: "mesa",
    laps: 1,
    closed: true,
    thumb: "/textures/thumb-mesa.svg",
    medals: { author: 32_000, gold: 37_500, silver: 45_000, bronze: 56_000 },
    defaultSurface: "dirt",
    nodes: mesaNodes(),
  },
  hollow: {
    id: "hollow",
    name: "Black Hollow",
    blurb: "Dirt pines, then a tech clearing sprint.",
    env: "grove",
    laps: 1,
    closed: true,
    thumb: "/textures/thumb-hollow.svg",
    medals: { author: 31_000, gold: 36_500, silver: 44_000, bronze: 55_000 },
    defaultSurface: "dirt",
    nodes: hollowNodes(),
  },
  ember: {
    id: "ember",
    name: "Ember Caldera",
    blurb: "Ash rim, lava glass, then a crater drop.",
    env: "ember",
    laps: 1,
    closed: true,
    thumb: "/textures/thumb-ember.svg",
    medals: { author: 33_000, gold: 38_500, silver: 46_000, bronze: 58_000 },
    defaultSurface: "dirt",
    nodes: emberNodes(),
  },
  storm: {
    id: "storm",
    name: "Storm Dock",
    blurb: "Wet streets, ice plaza, then a tech pier.",
    env: "storm",
    laps: 1,
    closed: true,
    thumb: "/textures/thumb-storm.svg",
    medals: { author: 32_500, gold: 38_000, silver: 45_500, bronze: 57_000 },
    defaultSurface: "plastic",
    nodes: stormNodes(),
  },
};

const builtCache = new Map<TrackId, BuiltTrack>();

export function getTrackDef(id: TrackId): TrackDef {
  if (id === "custom") return customDefFromSave(readActiveCustom());
  return TRACK_DEFS[id];
}

export function invalidateCustomTrack() {
  builtCache.delete("custom");
}

export function validateCustomBuild() {
  const def = getTrackDef("custom");
  const built = compileTrack(def);
  const first = built.samples[0];
  const last = built.samples[built.samples.length - 1];
  const seam = first && last ? Math.hypot(first.x - last.x, first.y - last.y, first.z - last.z) : Infinity;
  const errors: string[] = [];
  if (built.samples.length < 24) errors.push("Mesh did not build enough ribbon samples.");
  if (built.length < 180) errors.push("Compiled ribbon is too short.");
  if (seam > 22) errors.push("Loop does not close cleanly.");
  if (built.checkpoints.length < 1) errors.push("Need a checkpoint so the lap can count.");
  return { ok: errors.length === 0, errors, length: built.length, samples: built.samples.length, checkpoints: built.checkpoints.length, boosts: built.boosts.length };
}

export function getTrack(id: TrackId): BuiltTrack {
  if (id === "custom") {
    let custom = builtCache.get("custom");
    if (!custom) {
      custom = compileTrack(getTrackDef("custom"));
      builtCache.set("custom", custom);
    }
    return custom;
  }
  let t = builtCache.get(id);
  if (!t) {
    t = compileTrack(TRACK_DEFS[id]);
    builtCache.set(id, t);
  }
  return t;
}

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    builtCache.clear();
  });
}

export function allTrackDefs(): TrackDef[] {
  return [...TRACK_ORDER.map((id) => TRACK_DEFS[id]), getTrackDef("custom")];
}

export function medalFromTimes(medals: TrackDef["medals"], time: number) {
  if (time <= medals.author) return "author" as const;
  if (time <= medals.gold) return "gold" as const;
  if (time <= medals.silver) return "silver" as const;
  if (time <= medals.bronze) return "bronze" as const;
  return null;
}

export function medalFor(id: TrackId, time: number, medals?: TrackDef["medals"]) {
  return medalFromTimes(medals ?? getTrackDef(id).medals, time);
}

export type MedalPace = {
  holding: Medal | null;
  remain: number | null;
  lost: Medal[];
};

/** During a run: the medal you are still on pace for, and ms until it drops. */
export function medalPaceFromTimes(medals: TrackDef["medals"], time: number): MedalPace {
  const ladder: { id: Medal; at: number }[] = [
    { id: "author", at: medals.author },
    { id: "gold", at: medals.gold },
    { id: "silver", at: medals.silver },
    { id: "bronze", at: medals.bronze },
  ];
  const lost: Medal[] = [];
  for (const rung of ladder) {
    if (time <= rung.at) {
      return { holding: rung.id, remain: rung.at - time, lost };
    }
    lost.push(rung.id);
  }
  return { holding: null, remain: null, lost };
}

export function medalPace(id: TrackId, time: number, medals?: TrackDef["medals"]): MedalPace {
  return medalPaceFromTimes(medals ?? getTrackDef(id).medals, time);
}
