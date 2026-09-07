import * as THREE from "three";
import type { CarSnap } from "./types";
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
      size: 0.12,
      map: sparkSprite(),
      opacity: 0.95,
      additive: true,
    });
    this.smoke = this.makeCloud(MAX_SMOKE, {
      color: 0xc8c4bc,
      size: 0.42,
      map: smokeSprite(),
      opacity: 0.42,
      additive: false,
    });
    this.trail = this.makeCloud(MAX_TRAIL, {
      color: 0xffb45a,
      size: 0.16,
      map: sparkSprite(),
      opacity: 0.85,
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
      opacity: 0.55,
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

  setTheme(night: boolean) {
    this.trailColor.setHex(night ? 0x7ec8ff : 0xffb45a);
    (this.trail.points.material as THREE.PointsMaterial).color.copy(this.trailColor);
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

  private makeCloud(
    max: number,
    opts: { color: number; size: number; map: THREE.Texture; opacity: number; additive: boolean },
  ): Cloud {
    const pos = new Float32Array(max * 3);
    const vel = new Float32Array(max * 3);
    const life = new Float32Array(max);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
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
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.root.add(points);
    this.geos.push(geo);
    this.mats.push(mat);
    return { pos, vel, life, max, points };
  }

  private spawn(cloud: Cloud, cap: number, snap: CarSnap, kind: "spark" | "boostSpark" | "curb" | "smoke" | "trail") {
    const slot = pickSlot(cloud.life, cap);
    const rear = kind === "trail" ? 1.15 : 1.02;
    const side = (Math.random() - 0.5) * (kind === "smoke" ? 1.05 : 0.7);
    cloud.life[slot] = kind === "smoke" ? 0.45 + Math.random() * 0.4 : kind === "trail" ? 0.18 + Math.random() * 0.16 : 0.22 + Math.random() * 0.26;
    cloud.pos[slot * 3] = snap.px - snap.fx * rear + (kind === "smoke" ? -snap.fz : 1) * side * 0.35;
    cloud.pos[slot * 3 + 1] = snap.py + (kind === "smoke" ? 0.12 : 0.08) + Math.random() * 0.1;
    cloud.pos[slot * 3 + 2] = snap.pz - snap.fz * rear + (kind === "smoke" ? snap.fx : 1) * side * 0.35;
    if (kind === "smoke") {
      cloud.vel[slot * 3] = -snap.fx * (0.6 + Math.random()) + (Math.random() - 0.5) * 0.8;
      cloud.vel[slot * 3 + 1] = 0.55 + Math.random() * 0.7;
      cloud.vel[slot * 3 + 2] = -snap.fz * (0.6 + Math.random()) + (Math.random() - 0.5) * 0.8;
    } else if (kind === "trail") {
      cloud.vel[slot * 3] = -snap.fx * (6 + Math.random() * 4) + (Math.random() - 0.5) * 0.6;
      cloud.vel[slot * 3 + 1] = 0.15 + Math.random() * 0.35;
      cloud.vel[slot * 3 + 2] = -snap.fz * (6 + Math.random() * 4) + (Math.random() - 0.5) * 0.6;
    } else if (kind === "curb") {
      cloud.vel[slot * 3] = -snap.fx * (1.2 + Math.random() * 2) + (Math.random() - 0.5) * 3.2;
      cloud.vel[slot * 3 + 1] = 1.4 + Math.random() * 2.4;
      cloud.vel[slot * 3 + 2] = -snap.fz * (1.2 + Math.random() * 2) + (Math.random() - 0.5) * 3.2;
    } else {
      const boost = kind === "boostSpark";
      cloud.vel[slot * 3] = -snap.fx * (2 + Math.random() * 4) + (Math.random() - 0.5) * 2;
      cloud.vel[slot * 3 + 1] = (boost ? 2.2 : 0.6) + Math.random() * 2;
      cloud.vel[slot * 3 + 2] = -snap.fz * (2 + Math.random() * 4) + (Math.random() - 0.5) * 2;
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
  c.width = c.height = 32;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,255,240,1)");
  g.addColorStop(0.35, "rgba(255,200,110,0.85)");
  g.addColorStop(1, "rgba(255,140,40,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function smokeSprite() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  g.addColorStop(0, "rgba(230,228,222,0.55)");
  g.addColorStop(0.45, "rgba(180,176,168,0.28)");
  g.addColorStop(1, "rgba(120,118,112,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
