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

function buildStadium(
  track: BuiltTrack,
  group: THREE.Group,
  geos: THREE.BufferGeometry[],
  mats: THREE.Material[],
  lights: THREE.Object3D[],
) {
  const standGeo = new THREE.BoxGeometry(1, 1, 1);
  const standMat = new THREE.MeshStandardMaterial({
    color: 0xcfc8ba,
    roughness: 0.82,
    metalness: 0.06,
  });
  const n = 20;
  const stands = new THREE.InstancedMesh(standGeo, standMat, n);
  stands.castShadow = true;
  stands.receiveShadow = true;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    _dummy.position.set(Math.cos(a) * 158, 6.2, Math.sin(a) * 158);
    _dummy.scale.set(22, 12.5, 28);
    _dummy.lookAt(0, 6.2, 0);
    _dummy.updateMatrix();
    stands.setMatrixAt(i, _dummy.matrix);
  }
  group.add(stands);
  geos.push(standGeo);
  mats.push(standMat);

  const seatGeo = new THREE.BoxGeometry(1, 1, 1);
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x3a4654, roughness: 0.7 });
  const seats = new THREE.InstancedMesh(seatGeo, seatMat, n);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    _dummy.position.set(Math.cos(a) * 150, 8.4, Math.sin(a) * 150);
    _dummy.scale.set(18, 6.5, 18);
    _dummy.lookAt(0, 8.4, 0);
    _dummy.updateMatrix();
    seats.setMatrixAt(i, _dummy.matrix);
  }
  group.add(seats);
  geos.push(seatGeo);
  mats.push(seatMat);

  const crowdGeo = new THREE.BoxGeometry(0.45, 0.7, 0.45);
  const crowdMat = new THREE.MeshStandardMaterial({ color: 0x2a2e36, roughness: 0.9 });
  const crowdN = 220;
  const crowd = new THREE.InstancedMesh(crowdGeo, crowdMat, crowdN);
  for (let i = 0; i < crowdN; i++) {
    const a = (i / crowdN) * Math.PI * 2 + hash(i) * 0.04;
    const r = 146 + hash(i + 3) * 16;
    const y = 6.6 + hash(i + 7) * 7;
    _dummy.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    _dummy.scale.set(1, 0.7 + hash(i + 2) * 0.6, 1);
    _dummy.rotation.set(0, a, 0);
    _dummy.updateMatrix();
    crowd.setMatrixAt(i, _dummy.matrix);
  }
  group.add(crowd);
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
    const x = Math.cos(a) * 78;
    const z = Math.sin(a) * 78;
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

  addTrees(group, geos, mats, 36, 95, 175, 0x3f6b38);
  addBanners(track, group, geos, mats, 0xf4f4f2, 0x2a2e36);
}

function buildCanyon(
  track: BuiltTrack,
  group: THREE.Group,
  geos: THREE.BufferGeometry[],
  mats: THREE.Material[],
) {
  const rockGeo = new THREE.BoxGeometry(1, 1, 1);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x9a6240, roughness: 0.96 });
  const n = 56;
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, n);
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  for (let i = 0; i < n; i++) {
    const a = hash(i) * Math.PI * 2;
    const r = 55 + hash(i + 4) * 170;
    const h = 10 + hash(i + 8) * 46;
    _dummy.position.set(Math.cos(a) * r, h / 2 - 10, Math.sin(a) * r);
    _dummy.scale.set(7 + hash(i + 1) * 20, h, 7 + hash(i + 2) * 18);
    _dummy.rotation.set(0, a * 0.7, (hash(i + 5) - 0.5) * 0.08);
    _dummy.updateMatrix();
    rocks.setMatrixAt(i, _dummy.matrix);
  }
  group.add(rocks);
  geos.push(rockGeo);
  mats.push(rockMat);

  const mesaGeo = new THREE.CylinderGeometry(1, 1.4, 1, 6);
  const mesaMat = new THREE.MeshStandardMaterial({ color: 0xb07a4e, roughness: 0.92 });
  const mesas = new THREE.InstancedMesh(mesaGeo, mesaMat, 14);
  mesas.castShadow = true;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.4;
    const r = 110 + hash(i + 11) * 80;
    const h = 18 + hash(i) * 28;
    _dummy.position.set(Math.cos(a) * r, h / 2 - 8, Math.sin(a) * r);
    _dummy.scale.set(10 + hash(i + 3) * 10, h, 10 + hash(i + 6) * 10);
    _dummy.rotation.set(0, a, 0);
    _dummy.updateMatrix();
    mesas.setMatrixAt(i, _dummy.matrix);
  }
  group.add(mesas);
  geos.push(mesaGeo);
  mats.push(mesaMat);

  const cactusGeo = new THREE.CylinderGeometry(0.22, 0.28, 2.4, 6);
  const cactusMat = new THREE.MeshStandardMaterial({ color: 0x3d6a3a, roughness: 0.8 });
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

  addTrackRocks(track, group, geos, mats, 0x8a5a38);
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
    color: 0x121722,
    roughness: 0.62,
    metalness: 0.18,
    emissive: 0x0a1528,
    emissiveIntensity: 0.45,
  });
  const n = 40;
  const buildings = new THREE.InstancedMesh(bldgGeo, bldgMat, n);
  buildings.castShadow = true;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 92 + (i % 5) * 16;
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
    color: 0xffd9a0,
    emissive: 0xffc878,
    emissiveIntensity: 1.6,
    roughness: 0.4,
  });
  const winN = 160;
  const windows = new THREE.InstancedMesh(winGeo, winMat, winN);
  for (let i = 0; i < winN; i++) {
    const a = hash(i) * Math.PI * 2;
    const r = 90 + (i % 5) * 16;
    const y = 2 + hash(i + 4) * 28;
    _dummy.position.set(Math.cos(a) * (r - 4.1), y, Math.sin(a) * (r - 4.1));
    _dummy.lookAt(0, y, 0);
    _dummy.scale.set(1, 1, 1);
    _dummy.updateMatrix();
    windows.setMatrixAt(i, _dummy.matrix);
  }
  group.add(windows);
  geos.push(winGeo);
  mats.push(winMat);

  const neonGeo = new THREE.BoxGeometry(1, 0.08, 0.08);
  const neonMat = new THREE.MeshStandardMaterial({
    color: 0x6ec8ff,
    emissive: 0x3aa0ff,
    emissiveIntensity: 2.2,
  });
  const neonN = 48;
  const neons = new THREE.InstancedMesh(neonGeo, neonMat, neonN);
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
    neons.setMatrixAt(i, _dummy.matrix);
  }
  group.add(neons);
  geos.push(neonGeo);
  mats.push(neonMat);
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
      const pl = new THREE.PointLight(0x8eb8ff, 0.85, 22, 2);
      pl.position.copy(lamp.position);
      group.add(pl);
      lights.push(pl);
      realLights++;
    }
  }
  geos.push(lampGeo, poleGeo);
  mats.push(lampMat, poleMat);

  if (theme === "stadium") addTireStacks(track, group, geos, mats);
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
) {
  const geo = new THREE.PlaneGeometry(4.5, 1.1);
  const mat = new THREE.MeshStandardMaterial({
    color: a,
    roughness: 0.55,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });
  const mat2 = new THREE.MeshStandardMaterial({
    color: b,
    roughness: 0.55,
    side: THREE.DoubleSide,
  });
  const n = 10;
  for (let i = 0; i < n; i++) {
    const sm = sampleAt(track, (i / n) * track.length);
    const side = i % 2 === 0 ? 1 : -1;
    const d = sm.width * 0.5 + 2.4;
    const mesh = new THREE.Mesh(geo, i % 2 === 0 ? mat : mat2);
    mesh.position.set(sm.x + sm.rx * side * d + sm.ux * 1.6, sm.y + sm.uy * 1.6, sm.z + sm.rz * side * d + sm.uz * 1.6);
    _fwd.set(sm.rx * side, sm.ry * side, sm.rz * side);
    _up.set(sm.ux, sm.uy, sm.uz);
    mesh.quaternion.setFromRotationMatrix(lookMat(_fwd, _up));
    group.add(mesh);
  }
  geos.push(geo);
  mats.push(mat, mat2);
}

function addTrackRocks(
  track: BuiltTrack,
  group: THREE.Group,
  geos: THREE.BufferGeometry[],
  mats: THREE.Material[],
  color: number,
) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
  const n = 28;
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.castShadow = true;
  for (let i = 0; i < n; i++) {
    const sm = track.samples[Math.floor((i / n) * track.samples.length)]!;
    const side = i % 2 === 0 ? 1 : -1;
    const d = sm.width * 0.5 + 4 + hash(i) * 6;
    const h = 1.2 + hash(i + 3) * 3;
    _dummy.position.set(sm.x + sm.rx * side * d, sm.y + h * 0.35, sm.z + sm.rz * side * d);
    _dummy.scale.set(1.2 + hash(i) * 2.2, h, 1.2 + hash(i + 2) * 2);
    _dummy.rotation.set(0, hash(i) * 6, 0);
    _dummy.updateMatrix();
    mesh.setMatrixAt(i, _dummy.matrix);
  }
  group.add(mesh);
  geos.push(geo);
  mats.push(mat);
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
