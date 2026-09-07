import * as THREE from "three";
import type { CarSnap } from "./types";

const MAX_SPARKS = 280;
const MAX_SKIDS = 420;

export class Vfx {
  root = new THREE.Group();
  private sparkPos: Float32Array;
  private sparkLife: Float32Array;
  private sparkVel: Float32Array;
  private sparks: THREE.Points;
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

  constructor() {
    this.sparkPos = new Float32Array(MAX_SPARKS * 3);
    this.sparkLife = new Float32Array(MAX_SPARKS);
    this.sparkVel = new Float32Array(MAX_SPARKS * 3);
    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute("position", new THREE.BufferAttribute(this.sparkPos, 3));
    const sMat = new THREE.PointsMaterial({
      color: 0xffc878,
      size: 0.11,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.sparks = new THREE.Points(sGeo, sMat);
    this.sparks.frustumCulled = false;
    this.root.add(this.sparks);
    this.geos.push(sGeo);
    this.mats.push(sMat);

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

  emitSparks(snap: CarSnap, count: number, boost: boolean) {
    const n = Math.round(count * this.density);
    for (let i = 0; i < n; i++) this.spawnSpark(snap, boost);
  }

  private spawnSpark(snap: CarSnap, boost: boolean) {
    let slot = 0;
    let oldest = 1;
    for (let p = 0; p < this.sparkLife.length; p++) {
      if (this.sparkLife[p]! <= 0) {
        slot = p;
        break;
      }
      if (this.sparkLife[p]! < oldest) {
        oldest = this.sparkLife[p]!;
        slot = p;
      }
    }
    this.sparkLife[slot] = 0.28 + Math.random() * 0.28;
    const rear = 1.05;
    this.sparkPos[slot * 3] = snap.px - snap.fx * rear + (Math.random() - 0.5) * 0.7;
    this.sparkPos[slot * 3 + 1] = snap.py + 0.08 + Math.random() * 0.12;
    this.sparkPos[slot * 3 + 2] = snap.pz - snap.fz * rear + (Math.random() - 0.5) * 0.7;
    this.sparkVel[slot * 3] = -snap.fx * (2 + Math.random() * 4) + (Math.random() - 0.5) * 2;
    this.sparkVel[slot * 3 + 1] = (boost ? 2.2 : 0.6) + Math.random() * 2;
    this.sparkVel[slot * 3 + 2] = -snap.fz * (2 + Math.random() * 4) + (Math.random() - 0.5) * 2;
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
      const i = this.skidIdx % MAX_SKIDS;
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
      this.skidCount = Math.min(MAX_SKIDS, this.skidCount + 1);
      (this.skidGeo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
      (this.skidGeo.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
      this.skidGeo.setDrawRange(0, Math.min(this.skidCount, MAX_SKIDS) * 2);
    }
    this.lastSkid = [x, y, z];
  }

  step(dt: number) {
    for (let i = 0; i < this.sparkLife.length; i++) {
      if (this.sparkLife[i]! <= 0) continue;
      this.sparkLife[i]! -= dt;
      this.sparkPos[i * 3]! += this.sparkVel[i * 3]! * dt;
      this.sparkPos[i * 3 + 1]! += this.sparkVel[i * 3 + 1]! * dt;
      this.sparkPos[i * 3 + 2]! += this.sparkVel[i * 3 + 2]! * dt;
      this.sparkVel[i * 3 + 1]! -= 12 * dt;
    }
    (this.sparks.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
  }

  resetSkids() {
    this.skidIdx = 0;
    this.skidCount = 0;
    this.lastSkid = null;
    this.skidGeo.setDrawRange(0, 0);
  }

  dispose() {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
  }
}
