import * as THREE from "three";
import type { BuiltTrack, ThemeId } from "./types";
import { sampleAt } from "./track";
import { makeGroundTexture } from "./textures";

const _dummy = new THREE.Object3D();
const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3();
const _look = new THREE.Matrix4();

function lookMat(fwd: THREE.Vector3, up: THREE.Vector3) {
  const x = new THREE.Vector3().crossVectors(up, fwd);
  if (x.lengthSq() < 1e-8) x.set(1, 0, 0);
  x.normalize();
  const y = new THREE.Vector3().crossVectors(fwd, x).normalize();
  _look.makeBasis(x, y, fwd.clone().normalize());
  return _look;
}

export type EnvBuild = {
  group: THREE.Group;
  lights: THREE.Object3D[];
  geos: THREE.BufferGeometry[];
  mats: THREE.Material[];
  textures: THREE.Texture[];
};

export function applyGroundMaterial(mesh: THREE.Mesh, theme: ThemeId, textures: THREE.Texture[]) {
  const tex = makeGroundTexture(theme);
  textures.push(tex);
  const mat = mesh.material as THREE.MeshStandardMaterial;
  mat.map = tex;
  mat.color.set(0xffffff);
  mat.roughness = theme === "night" ? 0.92 : 0.95;
  mat.needsUpdate = true;
}

export function buildEnvironment(track: BuiltTrack, theme: ThemeId): EnvBuild {
  const group = new THREE.Group();
  const lights: THREE.Object3D[] = [];
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  if (theme === "stadium") buildStadium(track, group, geos, mats, lights);
  else if (theme === "canyon") buildCanyon(track, group, geos, mats);
  else buildNight(track, group, geos, mats, lights);

  decorateTrackside(track, theme, group, geos, mats, lights);
  return { group, lights, geos, mats, textures };
}

function trackOutRadius(track: BuiltTrack) {
  let maxR = 0;
  for (const sm of track.samples) maxR = Math.max(maxR, Math.hypot(sm.x, sm.z));
  return maxR;
}

function overlapsTrack(track: BuiltTrack, x: number, z: number, radius: number) {
  const need = radius;
  for (const sm of track.samples) {
    const dx = x - sm.x;
    const dz = z - sm.z;
    const clear = sm.width * 0.5 + need;
    if (dx * dx + dz * dz < clear * clear) return true;
  }
  return false;
}

function buildStadium(
  track: BuiltTrack,
  group: THREE.Group,
  geos: THREE.BufferGeometry[],
  mats: THREE.Material[],
  lights: THREE.Object3D[],
) {
  const ring = trackOutRadius(track) + 52;
  const standGeo = new THREE.BoxGeometry(1, 1, 1);
  const standMat = new THREE.MeshStandardMaterial({
    color: 0xb8b2a4,
    roughness: 0.78,
    metalness: 0.08,
  });
  const n = 20;
  const stands = new THREE.InstancedMesh(standGeo, standMat, n);
  stands.castShadow = true;
  stands.receiveShadow = true;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    _dummy.position.set(Math.cos(a) * ring, 6.2, Math.sin(a) * ring);
    _dummy.scale.set(22, 12.5, 28);
    _dummy.lookAt(0, 6.2, 0);
    _dummy.updateMatrix();
    stands.setMatrixAt(i, _dummy.matrix);
  }
  group.add(stands);
  geos.push(standGeo);
  mats.push(standMat);

  const seatGeo = new THREE.BoxGeometry(1, 1, 1);
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x2a4a72, roughness: 0.62, metalness: 0.08 });
  const seats = new THREE.InstancedMesh(seatGeo, seatMat, n);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    _dummy.position.set(Math.cos(a) * (ring - 8), 8.4, Math.sin(a) * (ring - 8));
    _dummy.scale.set(18, 6.5, 18);
    _dummy.lookAt(0, 8.4, 0);
    _dummy.updateMatrix();
    seats.setMatrixAt(i, _dummy.matrix);
  }
  group.add(seats);
  geos.push(seatGeo);
  mats.push(seatMat);

  const crowdGeo = new THREE.BoxGeometry(0.45, 0.7, 0.45);
  const crowdMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  const crowdN = 220;
  const crowd = new THREE.InstancedMesh(crowdGeo, crowdMat, crowdN);
  const crowdColors = [0xc43c2a, 0x1f5aa8, 0xf0f0ee, 0xe8b43a, 0x2a2e36, 0x3d8c5a];
  for (let i = 0; i < crowdN; i++) {
    const a = (i / crowdN) * Math.PI * 2 + hash(i) * 0.04;
    const r = ring - 12 + hash(i + 3) * 16;
    const y = 6.6 + hash(i + 7) * 7;
    _dummy.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    _dummy.scale.set(1, 0.7 + hash(i + 2) * 0.6, 1);
    _dummy.rotation.set(0, a, 0);
    _dummy.updateMatrix();
    crowd.setMatrixAt(i, _dummy.matrix);
    crowd.setColorAt(i, new THREE.Color(crowdColors[i % crowdColors.length]!));
  }
  if (crowd.instanceColor) crowd.instanceColor.needsUpdate = true;
  group.add(crowd);

  const fasciaGeo = new THREE.CylinderGeometry(ring - 20, ring - 20, 2.2, 36, 1, true);
  const fasciaMat = new THREE.MeshStandardMaterial({
    color: 0xf2f0ea,
    roughness: 0.42,
    metalness: 0.12,
    side: THREE.DoubleSide,
    emissive: 0x1a2430,
    emissiveIntensity: 0.12,
  });
  const fascia = new THREE.Mesh(fasciaGeo, fasciaMat);
  fascia.position.y = 5.4;
  fascia.receiveShadow = true;
  group.add(fascia);
  const ledGeo = new THREE.TorusGeometry(ring - 20, 0.11, 6, 48);
  const ledMat = new THREE.MeshStandardMaterial({
    color: 0xff8a3a,
    emissive: 0xff6a20,
    emissiveIntensity: 1.15,
    roughness: 0.28,
  });
  const led = new THREE.Mesh(ledGeo, ledMat);
  led.rotation.x = Math.PI / 2;
  led.position.y = 6.55;
  group.add(led);
  geos.push(fasciaGeo, ledGeo);
  mats.push(fasciaMat, ledMat);
  geos.push(crowdGeo);
  mats.push(crowdMat);

  const poleGeo = new THREE.CylinderGeometry(0.22, 0.28, 16, 6);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xb8b2a6, roughness: 0.45, metalness: 0.35 });
  const lampGeo = new THREE.SphereGeometry(0.55, 10, 8);
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfff4d6,
    emissive: 0xffe6b0,
    emissiveIntensity: 1.8,
    roughness: 0.3,
  });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, 8);
  poles.castShadow = true;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.18;
    const x = Math.cos(a) * (ring - 24);
    const z = Math.sin(a) * (ring - 24);
    _dummy.position.set(x, 8, z);
    _dummy.rotation.set(0, 0, 0);
    _dummy.scale.set(1, 1, 1);
    _dummy.updateMatrix();
    poles.setMatrixAt(i, _dummy.matrix);
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(x, 16.2, z);
    group.add(lamp);
    const pl = new THREE.PointLight(0xfff1d0, 1.1, 48, 2);
    pl.position.set(x, 15.6, z);
    group.add(pl);
    lights.push(pl);
  }
  group.add(poles);
  geos.push(poleGeo, lampGeo);
  mats.push(poleMat, lampMat);

  addTrees(group, geos, mats, 36, ring + 8, ring + 70, 0x3f6b38);
  addBanners(track, group, geos, mats, 0xf4f4f2, 0x111318, 0xef5a24);
  addNearStands(track, group, geos, mats);
}

function buildCanyon(
  track: BuiltTrack,
  group: THREE.Group,
  geos: THREE.BufferGeometry[],
  mats: THREE.Material[],
) {
  const ring = trackOutRadius(track) + 36;
  const rockGeo = new THREE.BoxGeometry(1, 1, 1);
  const rockDark = new THREE.MeshStandardMaterial({ color: 0x3a2438, roughness: 0.97 });
  const rockLite = new THREE.MeshStandardMaterial({ color: 0xd07840, roughness: 0.88 });
  const darkPlaced: { x: number; y: number; z: number; sx: number; h: number; sz: number; ry: number; rz: number }[] = [];
  const litePlaced: typeof darkPlaced = [];
  for (let i = 0; i < 56; i++) {
    const a = hash(i) * Math.PI * 2;
    let r = 55 + hash(i + 4) * 170;
    const h = 10 + hash(i + 8) * 46;
    const sx = 7 + hash(i + 1) * 20;
    const sz = 7 + hash(i + 2) * 18;
    let x = Math.cos(a) * r;
    let z = Math.sin(a) * r;
    if (overlapsTrack(track, x, z, Math.max(sx, sz) * 0.85 + 18)) {
      r = ring + 28 + hash(i) * 50;
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
    }
    if (overlapsTrack(track, x, z, Math.max(sx, sz) * 0.7 + 14)) continue;
    const entry = { x, y: h / 2 - 10, z, sx, h, sz, ry: a * 0.7, rz: (hash(i + 5) - 0.5) * 0.08 };
    (hash(i + 9) > 0.42 ? litePlaced : darkPlaced).push(entry);
  }
  const placeRocks = (placed: typeof darkPlaced, mat: THREE.Material) => {
    const rocks = new THREE.InstancedMesh(rockGeo, mat, placed.length);
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    for (let i = 0; i < placed.length; i++) {
      const p = placed[i]!;
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.scale.set(p.sx, p.h, p.sz);
      _dummy.rotation.set(0, p.ry, p.rz);
      _dummy.updateMatrix();
      rocks.setMatrixAt(i, _dummy.matrix);
    }
    group.add(rocks);
  };
  placeRocks(darkPlaced, rockDark);
  placeRocks(litePlaced, rockLite);
  geos.push(rockGeo);
  mats.push(rockDark, rockLite);

  const mesaGeo = new THREE.CylinderGeometry(1, 1.4, 1, 6);
  const mesaMat = new THREE.MeshStandardMaterial({ color: 0xe07838, roughness: 0.88 });
  const mesaPlaced: { x: number; y: number; z: number; sx: number; h: number; sz: number; ry: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.4;
    let r = 110 + hash(i + 11) * 80;
    const h = 18 + hash(i) * 28;
    const sx = 10 + hash(i + 3) * 10;
    const sz = 10 + hash(i + 6) * 10;
    let x = Math.cos(a) * r;
    let z = Math.sin(a) * r;
    if (overlapsTrack(track, x, z, Math.max(sx, sz) * 0.9 + 20)) {
      r = ring + 32 + hash(i) * 36;
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
    }
    if (overlapsTrack(track, x, z, Math.max(sx, sz) * 0.75 + 16)) continue;
    mesaPlaced.push({ x, y: h / 2 - 8, z, sx, h, sz, ry: a });
  }
  const mesas = new THREE.InstancedMesh(mesaGeo, mesaMat, mesaPlaced.length);
  mesas.castShadow = true;
  for (let i = 0; i < mesaPlaced.length; i++) {
    const p = mesaPlaced[i]!;
    _dummy.position.set(p.x, p.y, p.z);
    _dummy.scale.set(p.sx, p.h, p.sz);
    _dummy.rotation.set(0, p.ry, 0);
    _dummy.updateMatrix();
    mesas.setMatrixAt(i, _dummy.matrix);
  }
  group.add(mesas);
  geos.push(mesaGeo);
  mats.push(mesaMat);

  const cactusGeo = new THREE.CylinderGeometry(0.22, 0.28, 2.4, 6);
  const cactusMat = new THREE.MeshStandardMaterial({ color: 0x6a7048, roughness: 0.88 });
  const cacti = new THREE.InstancedMesh(cactusGeo, cactusMat, 24);
  for (let i = 0; i < 24; i++) {
    const sm = track.samples[Math.floor((i / 24) * track.samples.length)]!;
    const side = i % 2 === 0 ? 1 : -1;
    const dist = sm.width * 0.5 + 6 + hash(i) * 10;
    _dummy.position.set(
      sm.x + sm.rx * side * dist,
      sm.y + 0.8,
      sm.z + sm.rz * side * dist,
    );
    _dummy.scale.set(1, 0.8 + hash(i + 2) * 1.4, 1);
    _dummy.rotation.set(0, 0, 0);
    _dummy.updateMatrix();
    cacti.setMatrixAt(i, _dummy.matrix);
  }
  group.add(cacti);
  geos.push(cactusGeo);
  mats.push(cactusMat);

  addTrackRocks(track, group, geos, mats, 0x2e1c28, 0xe08848);
  addRidgeFoliage(track, group, geos, mats);
  addHorizonHaze(group, geos, mats, 0xff8a48, 0.11, ring + 90);
}

function buildNight(
  track: BuiltTrack,
  group: THREE.Group,
  geos: THREE.BufferGeometry[],
  mats: THREE.Material[],
  lights: THREE.Object3D[],
) {
  const bldgGeo = new THREE.BoxGeometry(1, 1, 1);
  const bldgMat = new THREE.MeshStandardMaterial({
    color: 0x1c1830,
    roughness: 0.58,
    metalness: 0.18,
    emissive: 0x2a1848,
    emissiveIntensity: 0.55,
  });
  const ring = trackOutRadius(track) + 40;
  const n = 40;
  const buildings = new THREE.InstancedMesh(bldgGeo, bldgMat, n);
  buildings.castShadow = true;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = ring + (i % 5) * 16;
    const h = 10 + (i % 9) * 7;
    _dummy.position.set(Math.cos(a) * r, h / 2 - 5, Math.sin(a) * r);
    _dummy.scale.set(8 + (i % 4) * 2.2, h, 8 + (i % 3) * 3);
    _dummy.rotation.set(0, a, 0);
    _dummy.updateMatrix();
    buildings.setMatrixAt(i, _dummy.matrix);
  }
  group.add(buildings);
  geos.push(bldgGeo);
  mats.push(bldgMat);

  const winGeo = new THREE.BoxGeometry(0.35, 0.5, 0.08);
  const winMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 1.7,
    roughness: 0.4,
  });
  const winN = 160;
  const windows = new THREE.InstancedMesh(winGeo, winMat, winN);
  const winColors = [0xffd9a0, 0x8ec8ff, 0xff8ad4, 0xfff0c8];
  for (let i = 0; i < winN; i++) {
    const a = hash(i) * Math.PI * 2;
    const r = ring + (i % 5) * 16;
    const y = 2 + hash(i + 4) * 28;
    _dummy.position.set(Math.cos(a) * (r - 4.1), y, Math.sin(a) * (r - 4.1));
    _dummy.lookAt(0, y, 0);
    _dummy.scale.set(1, 1, 1);
    _dummy.updateMatrix();
    windows.setMatrixAt(i, _dummy.matrix);
    windows.setColorAt(i, new THREE.Color(winColors[i % winColors.length]!));
  }
  if (windows.instanceColor) windows.instanceColor.needsUpdate = true;
  group.add(windows);
  geos.push(winGeo);
  mats.push(winMat);

  const neonGeo = new THREE.BoxGeometry(1, 0.08, 0.08);
  const neonMat = new THREE.MeshStandardMaterial({
    color: 0x6ec8ff,
    emissive: 0x3aa0ff,
    emissiveIntensity: 2.2,
  });
  const neonMag = new THREE.MeshStandardMaterial({
    color: 0xff5aa8,
    emissive: 0xff2a88,
    emissiveIntensity: 2.1,
  });
  const neonN = 48;
  const neons = new THREE.InstancedMesh(neonGeo, neonMat, neonN);
  const neonsM = new THREE.InstancedMesh(neonGeo, neonMag, neonN);
  let ci = 0;
  let mi = 0;
  for (let i = 0; i < neonN; i++) {
    const sm = track.samples[Math.floor((i / neonN) * track.samples.length)]!;
    const side = i % 2 === 0 ? 1 : -1;
    const d = sm.width * 0.5 + 1.1;
    _dummy.position.set(sm.x + sm.rx * side * d + sm.ux * 0.7, sm.y + sm.uy * 0.7, sm.z + sm.rz * side * d + sm.uz * 0.7);
    _fwd.set(sm.tx, sm.ty, sm.tz);
    _up.set(sm.ux, sm.uy, sm.uz);
    _dummy.quaternion.setFromRotationMatrix(lookMat(_fwd, _up));
    _dummy.scale.set(2.8, 1, 1);
    _dummy.updateMatrix();
    if (side < 0) neonsM.setMatrixAt(mi++, _dummy.matrix);
    else neons.setMatrixAt(ci++, _dummy.matrix);
  }
  neons.count = ci;
  neonsM.count = mi;
  group.add(neons, neonsM);
  geos.push(neonGeo);
  mats.push(neonMat, neonMag);
  addHorizonHaze(group, geos, mats, 0x6a40c8, 0.1, ring + 70);
}

function decorateTrackside(
  track: BuiltTrack,
  theme: ThemeId,
  group: THREE.Group,
  geos: THREE.BufferGeometry[],
  mats: THREE.Material[],
  lights: THREE.Object3D[],
) {
  const lampGeo = new THREE.SphereGeometry(0.22, 8, 8);
  const lampMat = new THREE.MeshStandardMaterial({
    color: theme === "night" ? 0xaad0ff : 0xfff0c8,
    emissive: theme === "night" ? 0x6aa0ff : 0xffe0a0,
    emissiveIntensity: theme === "night" ? 1.8 : 0.9,
  });
  const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 2.6, 6);
  const poleMat = new THREE.MeshStandardMaterial({
    color: theme === "canyon" ? 0x5a4030 : 0x2a2e36,
    roughness: 0.5,
    metalness: 0.4,
  });
  const step = Math.max(1, Math.floor(track.samples.length / (theme === "night" ? 36 : 22)));
  let realLights = 0;
  for (let i = 0; i < track.samples.length; i += step) {
    const sm = track.samples[i]!;
    const side = i % (step * 2) === 0 ? 1 : -1;
    const d = sm.width * 0.5 + 1.15;
    const px = sm.x + sm.rx * side * d;
    const py = sm.y + sm.uy * 1.3;
    const pz = sm.z + sm.rz * side * d;
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(px, py, pz);
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(px + sm.ux * 1.25, py + sm.uy * 1.25, pz + sm.uz * 1.25);
    group.add(pole, lamp);
    if (theme === "night" && realLights < 8) {
      const pl = new THREE.PointLight(0x8eb8ff, 1.0, 40, 2);
      pl.position.copy(lamp.position);
      group.add(pl);
      lights.push(pl);
      realLights++;
    }
  }
  geos.push(lampGeo, poleGeo);
  mats.push(lampMat, poleMat);

  if (theme === "stadium") addTireStacks(track, group, geos, mats);
  addContrastBarriers(track, theme, group, geos, mats);
}

function addTrees(
  group: THREE.Group,
  geos: THREE.BufferGeometry[],
  mats: THREE.Material[],
  count: number,
  r0: number,
  r1: number,
  color: number,
) {
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.26, 2.2, 5);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3426, roughness: 0.9 });
  const leafGeo = new THREE.ConeGeometry(1.35, 3.2, 7);
  const leafMat = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, count);
  trunks.castShadow = true;
  leaves.castShadow = true;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + hash(i) * 0.2;
    const r = r0 + hash(i + 2) * (r1 - r0);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const s = 0.8 + hash(i + 5) * 0.7;
    _dummy.position.set(x, 1.1, z);
    _dummy.scale.set(s, s, s);
    _dummy.rotation.set(0, 0, 0);
    _dummy.updateMatrix();
    trunks.setMatrixAt(i, _dummy.matrix);
    _dummy.position.set(x, 3.4 * s, z);
    _dummy.updateMatrix();
    leaves.setMatrixAt(i, _dummy.matrix);
  }
  group.add(trunks, leaves);
  geos.push(trunkGeo, leafGeo);
  mats.push(trunkMat, leafMat);
}

function addBanners(
  track: BuiltTrack,
  group: THREE.Group,
  geos: THREE.BufferGeometry[],
  mats: THREE.Material[],
  a: number,
  b: number,
  accent = 0xc4a574,
) {
  const geo = new THREE.PlaneGeometry(4.8, 1.25);
  const mat = new THREE.MeshStandardMaterial({
    color: a,
    roughness: 0.42,
    metalness: 0.12,
    side: THREE.DoubleSide,
    emissive: 0x222226,
    emissiveIntensity: 0.08,
  });
  const mat2 = new THREE.MeshStandardMaterial({
    color: b,
    roughness: 0.42,
    side: THREE.DoubleSide,
    emissive: accent,
    emissiveIntensity: 0.18,
  });
  const edgeGeo = new THREE.BoxGeometry(4.9, 0.06, 0.06);
  const edgeMat = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 0.55,
    roughness: 0.3,
  });
  const n = 10;
  for (let i = 0; i < n; i++) {
    const sm = sampleAt(track, (i / n) * track.length);
    const side = i % 2 === 0 ? 1 : -1;
    const d = sm.width * 0.5 + 2.4;
    const mesh = new THREE.Mesh(geo, i % 2 === 0 ? mat : mat2);
    const px = sm.x + sm.rx * side * d + sm.ux * 1.7;
    const py = sm.y + sm.uy * 1.7;
    const pz = sm.z + sm.rz * side * d + sm.uz * 1.7;
    mesh.position.set(px, py, pz);
    _fwd.set(sm.rx * side, sm.ry * side, sm.rz * side);
    _up.set(sm.ux, sm.uy, sm.uz);
    mesh.quaternion.setFromRotationMatrix(lookMat(_fwd, _up));
    const edge = new THREE.Mesh(edgeGeo, edgeMat);
    edge.position.set(px + sm.ux * 0.68, py + sm.uy * 0.68, pz + sm.uz * 0.68);
    edge.quaternion.copy(mesh.quaternion);
    group.add(mesh, edge);
  }
  geos.push(geo, edgeGeo);
  mats.push(mat, mat2, edgeMat);
}

function addHorizonHaze(
  group: THREE.Group,
  geos: THREE.BufferGeometry[],
  mats: THREE.Material[],
  color: number,
  opacity: number,
  radius: number,
) {
  const geo = new THREE.CylinderGeometry(radius, radius + 18, 16, 28, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: true,
  });
  const haze = new THREE.Mesh(geo, mat);
  haze.position.y = 4;
  haze.renderOrder = -80;
  group.add(haze);
  geos.push(geo);
  mats.push(mat);
}

function addTrackRocks(
  track: BuiltTrack,
  group: THREE.Group,
  geos: THREE.BufferGeometry[],
  mats: THREE.Material[],
  dark: number,
  lite = dark,
) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const darkMat = new THREE.MeshStandardMaterial({ color: dark, roughness: 0.96 });
  const liteMat = new THREE.MeshStandardMaterial({ color: lite, roughness: 0.9 });
  const n = 28;
  const darkMesh = new THREE.InstancedMesh(geo, darkMat, n);
  const liteMesh = new THREE.InstancedMesh(geo, liteMat, n);
  darkMesh.castShadow = true;
  liteMesh.castShadow = true;
  let di = 0;
  let li = 0;
  for (let i = 0; i < n; i++) {
    const sm = track.samples[Math.floor((i / n) * track.samples.length)]!;
    const side = i % 2 === 0 ? 1 : -1;
    const d = sm.width * 0.5 + 12 + hash(i) * 6;
    const h = 1.2 + hash(i + 3) * 3;
    _dummy.position.set(sm.x + sm.rx * side * d, sm.y + h * 0.35, sm.z + sm.rz * side * d);
    _dummy.scale.set(1.2 + hash(i) * 2.2, h, 1.2 + hash(i + 2) * 2);
    _dummy.rotation.set(0, hash(i) * 6, 0);
    _dummy.updateMatrix();
    if (hash(i + 7) > 0.45) {
      liteMesh.setMatrixAt(li++, _dummy.matrix);
    } else {
      darkMesh.setMatrixAt(di++, _dummy.matrix);
    }
  }
  darkMesh.count = di;
  liteMesh.count = li;
  group.add(darkMesh, liteMesh);
  geos.push(geo);
  mats.push(darkMat, liteMat);
}

function addRidgeFoliage(
  track: BuiltTrack,
  group: THREE.Group,
  geos: THREE.BufferGeometry[],
  mats: THREE.Material[],
) {
  const bushGeo = new THREE.IcosahedronGeometry(0.85, 0);
  const sage = new THREE.MeshStandardMaterial({ color: 0x4a6a38, roughness: 0.95 });
  const olive = new THREE.MeshStandardMaterial({ color: 0x2e4a28, roughness: 0.96 });
  const n = 40;
  const aMesh = new THREE.InstancedMesh(bushGeo, sage, n);
  const bMesh = new THREE.InstancedMesh(bushGeo, olive, n);
  aMesh.castShadow = true;
  bMesh.castShadow = true;
  let ai = 0;
  let bi = 0;
  for (let i = 0; i < n; i++) {
    const sm = track.samples[Math.floor((i / n) * track.samples.length)]!;
    const side = i % 2 === 0 ? 1 : -1;
    const d = sm.width * 0.5 + 4.2 + hash(i + 2) * 7;
    const s = 0.7 + hash(i + 4) * 1.1;
    _dummy.position.set(sm.x + sm.rx * side * d, sm.y + 0.45 * s, sm.z + sm.rz * side * d);
    _dummy.scale.set(s, s * (0.7 + hash(i) * 0.5), s);
    _dummy.rotation.set(hash(i) * 0.4, hash(i + 3) * 6, 0);
    _dummy.updateMatrix();
    if (i % 2 === 0) aMesh.setMatrixAt(ai++, _dummy.matrix);
    else bMesh.setMatrixAt(bi++, _dummy.matrix);
  }
  aMesh.count = ai;
  bMesh.count = bi;
  group.add(aMesh, bMesh);
  geos.push(bushGeo);
  mats.push(sage, olive);
}

function addContrastBarriers(
  track: BuiltTrack,
  theme: ThemeId,
  group: THREE.Group,
  geos: THREE.BufferGeometry[],
  mats: THREE.Material[],
) {
  const geo = new THREE.BoxGeometry(0.1, 0.92, 1.35);
  const light = new THREE.MeshStandardMaterial({
    color: theme === "night" ? 0x5ee8ff : theme === "canyon" ? 0xffc070 : 0xf4d24a,
    roughness: 0.28,
    metalness: 0.16,
    emissive: theme === "night" ? 0x146880 : theme === "canyon" ? 0x4a2008 : 0x6a4a08,
    emissiveIntensity: theme === "night" ? 0.85 : 0.28,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x14161c,
    roughness: 0.55,
    metalness: 0.2,
  });
  const n = theme === "night" ? 28 : 22;
  const step = Math.max(1, Math.floor(track.samples.length / n));
  const meshL = new THREE.InstancedMesh(geo, light, n * 2);
  const meshD = new THREE.InstancedMesh(geo, dark, n * 2);
  meshL.castShadow = true;
  meshD.castShadow = true;
  let li = 0;
  let di = 0;
  let k = 0;
  for (let i = 0; i < track.samples.length && k < n * 2; i += step, k++) {
    const sm = track.samples[i]!;
    const side = k % 2 === 0 ? 1 : -1;
    const d = sm.width * 0.5 + 0.78;
    _dummy.position.set(sm.x + sm.rx * side * d + sm.ux * 0.42, sm.y + sm.uy * 0.42, sm.z + sm.rz * side * d + sm.uz * 0.42);
    _fwd.set(sm.tx, sm.ty, sm.tz);
    _up.set(sm.ux, sm.uy, sm.uz);
    _dummy.quaternion.setFromRotationMatrix(lookMat(_fwd, _up));
    _dummy.scale.set(1, 1, 1);
    _dummy.updateMatrix();
    if (Math.floor(i / step) % 2 === 0) meshL.setMatrixAt(li++, _dummy.matrix);
    else meshD.setMatrixAt(di++, _dummy.matrix);
  }
  meshL.count = li;
  meshD.count = di;
  meshL.instanceMatrix.needsUpdate = true;
  meshD.instanceMatrix.needsUpdate = true;
  group.add(meshL, meshD);
  geos.push(geo);
  mats.push(light, dark);
}

function addNearStands(
  track: BuiltTrack,
  group: THREE.Group,
  geos: THREE.BufferGeometry[],
  mats: THREE.Material[],
) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const conc = new THREE.MeshStandardMaterial({ color: 0xa8a294, roughness: 0.78, metalness: 0.08 });
  const seats = new THREE.MeshStandardMaterial({
    color: 0x1e4c88,
    roughness: 0.5,
    metalness: 0.1,
    emissive: 0x102038,
    emissiveIntensity: 0.12,
  });
  const n = 12;
  const bowl = new THREE.InstancedMesh(geo, conc, n);
  const seat = new THREE.InstancedMesh(geo, seats, n);
  bowl.castShadow = true;
  bowl.receiveShadow = true;
  for (let i = 0; i < n; i++) {
    const sm = sampleAt(track, ((i + 0.5) / n) * track.length);
    const side = i % 2 === 0 ? 1 : -1;
    const d = sm.width * 0.5 + 16;
    _dummy.position.set(sm.x + sm.rx * side * d, sm.y + 4.2, sm.z + sm.rz * side * d);
    _fwd.set(sm.tx, sm.ty, sm.tz);
    _up.set(sm.ux, sm.uy, sm.uz);
    _dummy.quaternion.setFromRotationMatrix(lookMat(_fwd, _up));
    _dummy.scale.set(22, 8.4, 14);
    _dummy.updateMatrix();
    bowl.setMatrixAt(i, _dummy.matrix);
    _dummy.position.set(sm.x + sm.rx * side * (d - 4), sm.y + 5.6, sm.z + sm.rz * side * (d - 4));
    _dummy.scale.set(18, 5.2, 10);
    _dummy.updateMatrix();
    seat.setMatrixAt(i, _dummy.matrix);
  }
  bowl.instanceMatrix.needsUpdate = true;
  seat.instanceMatrix.needsUpdate = true;
  group.add(bowl, seat);
  geos.push(geo);
  mats.push(conc, seats);
}

function addTireStacks(
  track: BuiltTrack,
  group: THREE.Group,
  geos: THREE.BufferGeometry[],
  mats: THREE.Material[],
) {
  const geo = new THREE.TorusGeometry(0.38, 0.14, 6, 10);
  const mat = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.9 });
  const n = 36;
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.castShadow = true;
  let k = 0;
  for (let i = 0; i < 12 && k < n; i++) {
    const sm = sampleAt(track, (i / 12) * track.length);
    const side = i % 2 === 0 ? 1 : -1;
    const d = sm.width * 0.5 + 1.8;
    const bx = sm.x + sm.rx * side * d;
    const by = sm.y + 0.18;
    const bz = sm.z + sm.rz * side * d;
    for (let t = 0; t < 3 && k < n; t++, k++) {
      _dummy.position.set(bx, by + t * 0.32, bz);
      _dummy.rotation.set(Math.PI / 2, 0, 0);
      _dummy.scale.set(1, 1, 1);
      _dummy.updateMatrix();
      mesh.setMatrixAt(k, _dummy.matrix);
    }
  }
  group.add(mesh);
  geos.push(geo);
  mats.push(mat);
}

function hash(i: number) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
