import * as THREE from "three";
import type { CarSnap, ThemeId } from "./types";
import type { QualityProfile } from "./quality";

const MAX_SPARKS = 280;
const MAX_SMOKE = 220;
const MAX_TRAIL = 160;
const MAX_SKIDS = 420;

type Cloud = {
  pos: Float32Array;
  vel: Float32Array;
  life: Float32Array;
  max: number;
  points: THREE.Points;
};

export class Vfx {
  root = new THREE.Group();
  private sparks: Cloud;
  private smoke: Cloud;
  private trail: Cloud;
  private skidGeo: THREE.BufferGeometry;
  private skidPos: Float32Array;
  private skidCol: Float32Array;
  private skidIdx = 0;
  private skidCount = 0;
  private skidMesh: THREE.LineSegments;
  private lastSkid: [number, number, number] | null = null;
  private mats: THREE.Material[] = [];
  private geos: THREE.BufferGeometry[] = [];
  density = 1;
  private textures: THREE.Texture[] = [];
  private sparkScale = 1;
  private smokeScale = 1;
  private sparkCap = MAX_SPARKS;
  private smokeCap = MAX_SMOKE;
  private trailCap = MAX_TRAIL;
  private skidCap = MAX_SKIDS;
  private trailColor = new THREE.Color(0xffc070);

  constructor() {
    this.sparks = this.makeCloud(MAX_SPARKS, {
      color: 0xffc878,
      size: 0.14,
      map: sparkSprite(),
      opacity: 0.96,
      additive: true,
    });
    this.smoke = this.makeCloud(MAX_SMOKE, {
      color: 0xc8c4bc,
      size: 0.46,
      map: smokeSprite(),
      opacity: 0.4,
      additive: false,
    });
    this.trail = this.makeCloud(MAX_TRAIL, {
      color: 0xffb45a,
      size: 0.28,
      map: trailSprite(),
      opacity: 0.92,
      additive: true,
    });
    this.textures.push(
      (this.sparks.points.material as THREE.PointsMaterial).map!,
      (this.smoke.points.material as THREE.PointsMaterial).map!,
      (this.trail.points.material as THREE.PointsMaterial).map!,
    );

    this.skidPos = new Float32Array(MAX_SKIDS * 6);
    this.skidCol = new Float32Array(MAX_SKIDS * 6);
    this.skidGeo = new THREE.BufferGeometry();
    this.skidGeo.setAttribute("position", new THREE.BufferAttribute(this.skidPos, 3));
    this.skidGeo.setAttribute("color", new THREE.BufferAttribute(this.skidCol, 3));
    this.skidGeo.setDrawRange(0, 0);
    const skidMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
    });
    this.skidMesh = new THREE.LineSegments(this.skidGeo, skidMat);
    this.skidMesh.frustumCulled = false;
    this.root.add(this.skidMesh);
    this.geos.push(this.skidGeo);
    this.mats.push(skidMat);
  }

  setQuality(profile: QualityProfile) {
    this.sparkScale = profile.sparkScale;
    this.smokeScale = profile.smokeScale;
    this.density = profile.sparkScale;
    this.sparkCap = Math.max(24, Math.floor(MAX_SPARKS * profile.sparkScale));
    this.smokeCap = Math.max(16, Math.floor(MAX_SMOKE * profile.smokeScale));
    this.trailCap = Math.max(12, Math.floor(MAX_TRAIL * profile.sparkScale));
    this.skidCap = Math.max(40, Math.floor(MAX_SKIDS * (0.4 + profile.sparkScale * 0.6)));
  }

  setTheme(theme: ThemeId | boolean) {
    const night = theme === true || theme === "night";
    const canyon = theme === "canyon";
    this.trailColor.setHex(night ? 0x4ef0ff : 0xff8a3a);
    (this.trail.points.material as THREE.PointsMaterial).color.copy(this.trailColor);
    (this.smoke.points.material as THREE.PointsMaterial).color.setHex(canyon ? 0xc4a078 : night ? 0xb8a0d0 : 0xc8c4bc);
    (this.sparks.points.material as THREE.PointsMaterial).color.setHex(night ? 0xff8ad0 : 0xffd090);
    (this.sparks.points.material as THREE.PointsMaterial).size = night ? 0.18 : 0.15;
    (this.trail.points.material as THREE.PointsMaterial).size = night ? 0.32 : 0.28;
  }

  emitSparks(snap: CarSnap, count: number, boost: boolean) {
    const n = Math.max(0, Math.round(count * this.sparkScale));
    for (let i = 0; i < n; i++) this.spawn(this.sparks, this.sparkCap, snap, boost ? "boostSpark" : "spark");
  }

  emitCurbSparks(snap: CarSnap) {
    const n = Math.max(0, Math.round(5 * this.sparkScale));
    for (let i = 0; i < n; i++) this.spawn(this.sparks, this.sparkCap, snap, "curb");
  }

  emitSmoke(snap: CarSnap, count: number) {
    const n = Math.max(0, Math.round(count * this.smokeScale));
    for (let i = 0; i < n; i++) this.spawn(this.smoke, this.smokeCap, snap, "smoke");
  }

  emitTrail(snap: CarSnap, count: number) {
    const n = Math.max(0, Math.round(count * this.sparkScale));
    for (let i = 0; i < n; i++) this.spawn(this.trail, this.trailCap, snap, "trail");
  }

  emitLand(snap: CarSnap, hard: boolean) {
    const smokeN = Math.max(0, Math.round((hard ? 14 : 7) * this.smokeScale));
    const sparkN = Math.max(0, Math.round((hard ? 10 : 4) * this.sparkScale));
    for (let i = 0; i < smokeN; i++) this.spawn(this.smoke, this.smokeCap, snap, "land");
    for (let i = 0; i < sparkN; i++) this.spawn(this.sparks, this.sparkCap, snap, "spark");
  }

  emitTurbo(snap: CarSnap) {
    const n = Math.max(0, Math.round(16 * this.sparkScale));
    for (let i = 0; i < n; i++) this.spawn(this.trail, this.trailCap, snap, "turbo");
    for (let i = 0; i < Math.max(0, Math.round(8 * this.sparkScale)); i++) {
      this.spawn(this.sparks, this.sparkCap, snap, "boostSpark");
    }
  }

  emitBoostBurst(snap: CarSnap) {
    const n = Math.max(0, Math.round(12 * this.sparkScale));
    for (let i = 0; i < n; i++) this.spawn(this.trail, this.trailCap, snap, "trail");
    for (let i = 0; i < Math.max(0, Math.round(6 * this.sparkScale)); i++) {
      this.spawn(this.sparks, this.sparkCap, snap, "boostSpark");
    }
  }

  private makeCloud(
    max: number,
    opts: { color: number; size: number; map: THREE.Texture; opacity: number; additive: boolean },
  ): Cloud {
    const pos = new Float32Array(max * 3);
    const vel = new Float32Array(max * 3);
    const life = new Float32Array(max);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("life", new THREE.BufferAttribute(life, 1));
    const mat = new THREE.PointsMaterial({
      color: opts.color,
      size: opts.size,
      map: opts.map,
      transparent: true,
      opacity: opts.opacity,
      depthWrite: false,
      sizeAttenuation: true,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    mat.customProgramCacheKey = () => "rushline-vfx-life";
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = `attribute float life;\nvarying float vLife;\n${shader.vertexShader}`.replace(
        "void main() {",
        "void main() {\n\tvLife = max(life, 0.0);",
      );
      shader.fragmentShader = `varying float vLife;\n${shader.fragmentShader}`.replace(
        "#include <color_fragment>",
        "diffuseColor.a *= smoothstep(0.0, 0.11, vLife);\n#include <color_fragment>",
      );
    };
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.root.add(points);
    this.geos.push(geo);
    this.mats.push(mat);
    return { pos, vel, life, max, points };
  }

  private spawn(
    cloud: Cloud,
    cap: number,
    snap: CarSnap,
    kind: "spark" | "boostSpark" | "curb" | "smoke" | "trail" | "land" | "turbo",
  ) {
    const slot = pickSlot(cloud.life, cap);
    const rear = kind === "trail" || kind === "turbo" ? 1.22 : kind === "land" ? 0.35 : 1.02;
    const pipe = kind === "trail" || kind === "turbo" || kind === "boostSpark" ? (Math.random() < 0.5 ? -0.2 : 0.2) : 0;
    const side = (Math.random() - 0.5) * (kind === "smoke" || kind === "land" ? 1.15 : 0.55);
    const rx = -snap.fz;
    const rz = snap.fx;
    cloud.life[slot] =
      kind === "smoke" || kind === "land"
        ? 0.5 + Math.random() * 0.42
        : kind === "trail" || kind === "turbo"
          ? 0.26 + Math.random() * 0.2
          : 0.24 + Math.random() * 0.28;
    cloud.pos[slot * 3] = snap.px - snap.fx * rear + rx * pipe + (kind === "smoke" || kind === "land" ? rx : 1) * side * 0.35;
    cloud.pos[slot * 3 + 1] = snap.py + (kind === "land" ? 0.02 : kind === "smoke" ? 0.12 : 0.1) + Math.random() * 0.1;
    cloud.pos[slot * 3 + 2] = snap.pz - snap.fz * rear + rz * pipe + (kind === "smoke" || kind === "land" ? rz : 1) * side * 0.35;
    if (kind === "smoke" || kind === "land") {
      const up = kind === "land" ? 1.8 : 0.55;
      cloud.vel[slot * 3] = -snap.fx * (0.6 + Math.random()) + (Math.random() - 0.5) * (kind === "land" ? 2.4 : 0.8);
      cloud.vel[slot * 3 + 1] = up + Math.random() * 0.9;
      cloud.vel[slot * 3 + 2] = -snap.fz * (0.6 + Math.random()) + (Math.random() - 0.5) * (kind === "land" ? 2.4 : 0.8);
    } else if (kind === "trail" || kind === "turbo") {
      const punch = kind === "turbo" ? 9 : 7.2;
      cloud.vel[slot * 3] = -snap.fx * (punch + Math.random() * 4.5) + rx * (Math.random() - 0.5) * 0.45;
      cloud.vel[slot * 3 + 1] = 0.08 + Math.random() * 0.28;
      cloud.vel[slot * 3 + 2] = -snap.fz * (punch + Math.random() * 4.5) + rz * (Math.random() - 0.5) * 0.45;
    } else if (kind === "curb") {
      cloud.vel[slot * 3] = -snap.fx * (1.2 + Math.random() * 2) + (Math.random() - 0.5) * 3.2;
      cloud.vel[slot * 3 + 1] = 1.4 + Math.random() * 2.4;
      cloud.vel[slot * 3 + 2] = -snap.fz * (1.2 + Math.random() * 2) + (Math.random() - 0.5) * 3.2;
    } else {
      const boost = kind === "boostSpark";
      cloud.vel[slot * 3] = -snap.fx * (2.4 + Math.random() * 4.4) + rx * (Math.random() - 0.5) * (boost ? 2.6 : 2);
      cloud.vel[slot * 3 + 1] = (boost ? 2.6 : 0.6) + Math.random() * 2.2;
      cloud.vel[slot * 3 + 2] = -snap.fz * (2.4 + Math.random() * 4.4) + rz * (Math.random() - 0.5) * (boost ? 2.6 : 2);
    }
  }

  skid(snap: CarSnap, active: boolean) {
    if (!active || snap.airborne || this.density < 0.12) {
      this.lastSkid = null;
      return;
    }
    const x = snap.px - snap.fx * 0.7;
    const y = snap.py - 0.32;
    const z = snap.pz - snap.fz * 0.7;
    if (this.lastSkid) {
      const dx = x - this.lastSkid[0];
      const dz = z - this.lastSkid[2];
      if (dx * dx + dz * dz < 0.04) return;
      const i = this.skidIdx % this.skidCap;
      const o = i * 6;
      this.skidPos[o] = this.lastSkid[0];
      this.skidPos[o + 1] = this.lastSkid[1];
      this.skidPos[o + 2] = this.lastSkid[2];
      this.skidPos[o + 3] = x;
      this.skidPos[o + 4] = y;
      this.skidPos[o + 5] = z;
      const c = 0.08 + snap.driftCharge * 0.12;
      for (let k = 0; k < 6; k++) this.skidCol[o + k] = k % 3 === 1 ? c * 0.9 : c;
      this.skidIdx++;
      this.skidCount = Math.min(this.skidCap, this.skidCount + 1);
      (this.skidGeo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
      (this.skidGeo.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
      this.skidGeo.setDrawRange(0, Math.min(this.skidCount, this.skidCap) * 2);
    }
    this.lastSkid = [x, y, z];
  }

  step(dt: number) {
    stepCloud(this.sparks, this.sparkCap, dt, 12, 0);
    stepCloud(this.smoke, this.smokeCap, dt, 2.4, 0.55);
    stepCloud(this.trail, this.trailCap, dt, 3.2, 0);
  }

  resetSkids() {
    this.skidIdx = 0;
    this.skidCount = 0;
    this.lastSkid = null;
    this.skidGeo.setDrawRange(0, 0);
    this.sparks.life.fill(0);
    this.smoke.life.fill(0);
    this.trail.life.fill(0);
  }

  dispose() {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    for (const t of this.textures) t.dispose();
  }
}

function stepCloud(cloud: Cloud, cap: number, dt: number, gravity: number, drag: number) {
  for (let i = 0; i < cap; i++) {
    if (cloud.life[i]! <= 0) continue;
    cloud.life[i]! -= dt;
    cloud.pos[i * 3]! += cloud.vel[i * 3]! * dt;
    cloud.pos[i * 3 + 1]! += cloud.vel[i * 3 + 1]! * dt;
    cloud.pos[i * 3 + 2]! += cloud.vel[i * 3 + 2]! * dt;
    cloud.vel[i * 3 + 1]! -= gravity * dt;
    if (drag) {
      cloud.vel[i * 3]! *= 1 - drag * dt;
      cloud.vel[i * 3 + 2]! *= 1 - drag * dt;
    }
  }
  (cloud.points.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
  const lifeAttr = cloud.points.geometry.getAttribute("life") as THREE.BufferAttribute | undefined;
  if (lifeAttr) lifeAttr.needsUpdate = true;
}

function pickSlot(life: Float32Array, cap: number) {
  let slot = 0;
  let oldest = 1;
  for (let p = 0; p < cap; p++) {
    if (life[p]! <= 0) return p;
    if (life[p]! < oldest) {
      oldest = life[p]!;
      slot = p;
    }
  }
  return slot;
}

function sparkSprite() {
  const c = document.createElement("canvas");
  c.width = c.height = 48;
  const ctx = c.getContext("2d")!;
  const cx = 24;
  const cy = 24;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 22);
  g.addColorStop(0, "rgba(255,255,248,1)");
  g.addColorStop(0.18, "rgba(255,230,160,0.95)");
  g.addColorStop(0.42, "rgba(255,140,50,0.55)");
  g.addColorStop(1, "rgba(255,40,10,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 48, 48);
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = "rgba(255,248,220,0.7)";
  ctx.lineWidth = 1.15;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * 18, cy + Math.sin(a) * 18);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function trailSprite() {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(16, 0, 16, 64);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.22, "rgba(255,250,230,0.95)");
  g.addColorStop(0.55, "rgba(255,150,70,0.75)");
  g.addColorStop(1, "rgba(255,40,80,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(16, 2);
  ctx.lineTo(26, 58);
  ctx.lineTo(6, 58);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = "lighter";
  const core = ctx.createLinearGradient(16, 8, 16, 56);
  core.addColorStop(0, "rgba(255,255,255,0)");
  core.addColorStop(0.4, "rgba(255,255,255,0.85)");
  core.addColorStop(1, "rgba(255,180,80,0)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.moveTo(16, 10);
  ctx.lineTo(20, 54);
  ctx.lineTo(12, 54);
  ctx.closePath();
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function smokeSprite() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 30, 3, 32, 32, 30);
  g.addColorStop(0, "rgba(236,234,228,0.5)");
  g.addColorStop(0.4, "rgba(176,172,164,0.26)");
  g.addColorStop(1, "rgba(110,108,102,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
