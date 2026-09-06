import * as THREE from "three";
import type { BuiltTrack, Sample, ThemeId, TrackDef, TrackId, TrackNode } from "./types";
import { makeAsphaltTexture, makeCheckerTexture } from "./textures";

const TAU = Math.PI * 2;

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
      ...extra,
    });
  }

  setWidth(w: number) {
    this.width = w;
    return this;
  }

  straight(
    dist: number,
    opts: { climb?: number; width?: number; bank?: number; boost?: boolean; checkpoint?: boolean } = {},
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
      this.capture({
        boost: Boolean(opts.boost) && i === Math.max(1, Math.floor(steps * 0.45)),
        checkpoint: Boolean(opts.checkpoint) && i === steps,
      });
    }
    if (opts.bank != null && !opts.bank) this.bank = 0;
    return this;
  }

  curve(
    angle: number,
    radius: number,
    opts: { bank?: number; climb?: number; checkpoint?: boolean; boost?: boolean; width?: number } = {},
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

export function rasterize(nodes: TrackNode[], closed: boolean): Sample[] {
  const pts: { x: number; y: number; z: number; width: number; bank: number; boost: boolean; checkpoint: boolean }[] =
    [];
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
    });
  }

  return samples;
}

export function compileTrack(def: TrackDef): BuiltTrack {
  const samples = rasterize(def.nodes, def.closed);
  const length = samples[samples.length - 1]?.s ?? 1;
  const checkpoints: number[] = [];
  const boosts: number[] = [];
  for (const sm of samples) {
    if (sm.checkpoint) checkpoints.push(sm.s);
    if (sm.boost) boosts.push(sm.s);
  }
  return { def, samples, length, checkpoints, boosts };
}

export function sampleAt(track: BuiltTrack, s: number): Sample {
  const { samples, length, def } = track;
  if (samples.length === 0) {
    return {
      x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: -1, ux: 0, uy: 1, uz: 0, rx: 1, ry: 0, rz: 0, width: 12, s: 0, boost: false, checkpoint: false,
    };
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
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
    tx,
    ty,
    tz,
    ux,
    uy,
    uz,
    rx,
    ry,
    rz,
    width: lerp(a.width, b.width, t),
    s: ss,
    boost: a.boost || b.boost,
    checkpoint: false,
  };
}

export function nearestSample(track: BuiltTrack, x: number, y: number, z: number, hintS: number): Sample {
  const { samples } = track;
  const n = samples.length;
  if (!n) return sampleAt(track, 0);
  const hint = samples.findIndex((sm) => sm.s >= hintS);
  const start = Math.max(0, hint < 0 ? 0 : hint);
  let best = samples[start]!;
  let bestD = Infinity;
  const window = Math.min(n, 80);
  for (let k = -window; k <= window; k++) {
    let i = start + k;
    if (track.def.closed) i = ((i % n) + n) % n;
    else if (i < 0 || i >= n) continue;
    const sm = samples[i]!;
    const d = (sm.x - x) ** 2 + (sm.y - y) ** 2 + (sm.z - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = sm;
    }
  }
  return best;
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

const THEME_ROAD: Record<ThemeId, { r: number; g: number; b: number }> = {
  stadium: { r: 0.22, g: 0.24, b: 0.27 },
  canyon: { r: 0.28, g: 0.24, b: 0.22 },
  night: { r: 0.1, g: 0.13, b: 0.2 },
};

export function buildTrackMeshes(track: BuiltTrack, theme: ThemeId) {
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

  const tint = THEME_ROAD[theme];
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
    const edgeA = 1.08;
    const midA = 0.82;
    const colL = { r: tint.r * edgeA, g: tint.g * edgeA, b: tint.b * edgeA };
    const colM = { r: tint.r * midA, g: tint.g * midA, b: tint.b * midA };
    const amx = (alx + arx) * 0.5;
    const amy = (aly + ary) * 0.5;
    const amz = (alz + arz) * 0.5;
    const bmx = (blx + brx) * 0.5;
    const bmy = (bly + bry) * 0.5;
    const bmz = (blz + brz) * 0.5;
    strip(roadPos, roadNrm, roadCol, roadUv, alx, aly, alz, amx, amy, amz, blx, bly, blz, bmx, bmy, bmz, a.ux, a.uy, a.uz, colL, u0, u1);
    strip(roadPos, roadNrm, roadCol, roadUv, amx, amy, amz, arx, ary, arz, bmx, bmy, bmz, brx, bry, brz, a.ux, a.uy, a.uz, colM, u0, u1);

    const stripe = Math.floor(a.s / 2.0) % 2 === 0;
    const curbA = stripe ? { r: 0.92, g: 0.18, b: 0.16 } : { r: 0.96, g: 0.96, b: 0.94 };
    const cw = 0.55;
    const ch = 0.11;
    const lift = 0.02;
    for (const side of [-1, 1] as const) {
      const aox = side < 0 ? alx : arx;
      const aoy = side < 0 ? aly : ary;
      const aoz = side < 0 ? alz : arz;
      const box = side < 0 ? blx : brx;
      const boy = side < 0 ? bly : bry;
      const boz = side < 0 ? blz : brz;
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

      const railH0 = 0.34;
      const railH1 = 0.62;
      const rd = 0.62;
      const wallColV =
        theme === "stadium"
          ? { r: 0.72, g: 0.74, b: 0.7 }
          : theme === "canyon"
            ? { r: 0.55, g: 0.38, b: 0.28 }
            : { r: 0.22, g: 0.28, b: 0.36 };
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
      const inner = theme === "night" ? { r: 0.16, g: 0.2, b: 0.28 } : { r: 0.82, g: 0.8, b: 0.74 };
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

    const dashOn = Math.floor(a.s / 4.4) % 2 === 0;
    if (dashOn && !a.boost) {
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
      const white = { r: 0.95, g: 0.95, b: 0.92 };
      strip(markPos, markNrm, markCol, markUv, ly0x, ly0y, ly0z, ly1x, ly1y, ly1z, ly2x, ly2y, ly2z, ly3x, ly3y, ly3z, a.ux, a.uy, a.uz, white, u0, u1);
    }

    const edgeW = 0.08;
    const inset = 0.28;
    const edgeCol = theme === "stadium" ? { r: 0.95, g: 0.86, b: 0.32 } : { r: 0.93, g: 0.93, b: 0.9 };
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

  const asphalt = makeAsphaltTexture(theme);
  asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping;
  asphalt.repeat.set(1, 1);

  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute("position", new THREE.Float32BufferAttribute(roadPos, 3));
  roadGeo.setAttribute("normal", new THREE.Float32BufferAttribute(roadNrm, 3));
  roadGeo.setAttribute("uv", new THREE.Float32BufferAttribute(roadUv, 2));
  roadGeo.setAttribute("color", new THREE.Float32BufferAttribute(roadCol, 3));
  roadGeo.computeVertexNormals();

  const curbGeo = new THREE.BufferGeometry();
  curbGeo.setAttribute("position", new THREE.Float32BufferAttribute(curbPos, 3));
  curbGeo.setAttribute("normal", new THREE.Float32BufferAttribute(curbNrm, 3));
  curbGeo.setAttribute("color", new THREE.Float32BufferAttribute(curbCol, 3));
  curbGeo.computeVertexNormals();

  const wallGeo = new THREE.BufferGeometry();
  wallGeo.setAttribute("position", new THREE.Float32BufferAttribute(wallPos, 3));
  wallGeo.setAttribute("normal", new THREE.Float32BufferAttribute(wallNrm, 3));
  wallGeo.setAttribute("color", new THREE.Float32BufferAttribute(wallCol, 3));
  wallGeo.computeVertexNormals();

  const markGeo = new THREE.BufferGeometry();
  markGeo.setAttribute("position", new THREE.Float32BufferAttribute(markPos, 3));
  markGeo.setAttribute("normal", new THREE.Float32BufferAttribute(markNrm, 3));
  markGeo.setAttribute("color", new THREE.Float32BufferAttribute(markCol, 3));
  markGeo.computeVertexNormals();

  const railGeo = new THREE.BufferGeometry();
  railGeo.setAttribute("position", new THREE.Float32BufferAttribute(railPos, 3));
  railGeo.setAttribute("normal", new THREE.Float32BufferAttribute(railNrm, 3));
  railGeo.setAttribute("color", new THREE.Float32BufferAttribute(railCol, 3));
  railGeo.computeVertexNormals();

  const roadMat = new THREE.MeshStandardMaterial({
    map: asphalt,
    vertexColors: true,
    roughness: theme === "night" ? 0.28 : 0.62,
    metalness: theme === "night" ? 0.22 : 0.06,
  });
  const curbMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.05 });
  const wallMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.7,
    metalness: 0.04,
    transparent: true,
    opacity: 0.32,
  });
  const markMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.05 });
  const railMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.35,
    metalness: theme === "night" ? 0.55 : 0.4,
    emissive: theme === "night" ? 0x102030 : 0x000000,
    emissiveIntensity: theme === "night" ? 0.35 : 0,
  });
  const postGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.85, 5);
  const postMat = new THREE.MeshStandardMaterial({
    color: theme === "canyon" ? 0x6a4634 : theme === "night" ? 0x1c222c : 0xb8b4aa,
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
    color: theme === "night" ? 0x6ec8ff : 0xe8c56a,
    emissive: theme === "night" ? 0x3a8cff : 0xc9a44a,
    emissiveIntensity: 1.15,
    roughness: 0.3,
    metalness: 0.25,
    side: THREE.DoubleSide,
  });
  const chevron = new THREE.BufferGeometry();
  const cv = new Float32Array([0, 0.5, 0, -0.45, -0.5, 0, 0.45, -0.5, 0]);
  chevron.setAttribute("position", new THREE.BufferAttribute(cv, 3));
  chevron.computeVertexNormals();
  for (const bs of track.boosts) {
    const sm = sampleAt(track, bs);
    for (let k = 0; k < 3; k++) {
      const mesh = new THREE.Mesh(chevron, boostMat);
      const along = (k - 1) * 1.15;
      mesh.position.set(
        sm.x + sm.tx * along + sm.ux * 0.05,
        sm.y + sm.ty * along + sm.uy * 0.05,
        sm.z + sm.tz * along + sm.uz * 0.05,
      );
      mesh.scale.set(sm.width * 0.22, 1.1, 1);
      const x = new THREE.Vector3(sm.rx, sm.ry, sm.rz).normalize();
      const y = new THREE.Vector3(sm.tx, sm.ty, sm.tz).normalize();
      const z = new THREE.Vector3(sm.ux, sm.uy, sm.uz).normalize();
      mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
      group.add(mesh);
    }
  }

  return {
    group,
    materials: [roadMat, curbMat, wallMat, markMat, railMat, postMat, boostMat, gridMat],
    geos: [roadGeo, curbGeo, wallGeo, markGeo, railGeo, postGeo, chevron, grid.geometry as THREE.BufferGeometry],
    textures: [asphalt, checker],
  };
}

function circuitNodes() {
  return new PathBuilder()
    .setWidth(12.5)
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
    .straight(48)
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

export const TRACK_DEFS: Record<TrackId, TrackDef> = {
  circuit: {
    id: "circuit",
    name: "Green Circuit",
    blurb: "Stadium flow. Two laps, one jump.",
    env: "stadium",
    laps: 2,
    closed: true,
    thumb: "/textures/thumb-circuit.jpg",
    medals: { author: 50_000, gold: 56_000, silver: 64_000, bronze: 78_000 },
    nodes: circuitNodes(),
  },
  canyon: {
    id: "canyon",
    name: "Ridge Drop",
    blurb: "A long descent, then a committed jump.",
    env: "canyon",
    laps: 1,
    closed: true,
    thumb: "/textures/thumb-canyon.jpg",
    medals: { author: 30_500, gold: 35_000, silver: 41_000, bronze: 52_000 },
    nodes: canyonNodes(),
  },
  helix: {
    id: "helix",
    name: "Night Helix",
    blurb: "Loop, corkscrew, keep the speed.",
    env: "night",
    laps: 1,
    closed: true,
    thumb: "/textures/thumb-helix.jpg",
    medals: { author: 27_500, gold: 32_000, silver: 38_000, bronze: 50_000 },
    nodes: helixNodes(),
  },
};

const builtCache = new Map<TrackId, BuiltTrack>();

export function getTrack(id: TrackId): BuiltTrack {
  let t = builtCache.get(id);
  if (!t) {
    t = compileTrack(TRACK_DEFS[id]);
    builtCache.set(id, t);
  }
  return t;
}

export function allTrackDefs(): TrackDef[] {
  return [TRACK_DEFS.circuit, TRACK_DEFS.canyon, TRACK_DEFS.helix];
}

export function medalFor(id: TrackId, time: number) {
  const m = TRACK_DEFS[id].medals;
  if (time <= m.author) return "author" as const;
  if (time <= m.gold) return "gold" as const;
  if (time <= m.silver) return "silver" as const;
  if (time <= m.bronze) return "bronze" as const;
  return null;
}
