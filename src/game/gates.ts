import * as THREE from "three";
import type { Sample, ThemeId } from "./types";
import { makeCheckerTexture } from "./textures";
import { GATE_LOOK } from "./presentation";

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

export type GateBuild = {
  group: THREE.Group;
  mats: THREE.Material[];
  textures: THREE.Texture[];
};

/** Start gantry / CP arch — high-contrast at speed, no physics. */
export function buildGate(sm: Sample, theme: ThemeId, finish: boolean): GateBuild {
  const group = new THREE.Group();
  const mats: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const night = theme === "night";
  const h = finish ? 4.05 : 3.55;
  const w = sm.width * 0.5 + 0.42;
  const postCol = finish ? GATE_LOOK.startPost : night ? GATE_LOOK.cpNight : GATE_LOOK.cpDay;
  const emit = finish ? GATE_LOOK.startEmissive : night ? GATE_LOOK.cpEmissiveNight : GATE_LOOK.cpEmissiveDay;
  const mat = new THREE.MeshStandardMaterial({
    color: postCol,
    emissive: emit,
    emissiveIntensity: finish ? 0.42 : night ? 1.15 : 0.85,
    roughness: 0.22,
    metalness: 0.55,
  });
  mats.push(mat);
  const postW = finish ? 0.22 : 0.18;
  const p1 = new THREE.Mesh(new THREE.BoxGeometry(postW, h, postW), mat);
  const p2 = p1.clone();
  p1.position.set(-w, h / 2, 0);
  p2.position.set(w, h / 2, 0);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(w * 2 + postW, finish ? 0.2 : 0.16, 0.16), mat);
  bar.position.set(0, h, 0);
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x16181e,
    roughness: 0.55,
    metalness: 0.25,
  });
  mats.push(baseMat);
  const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.42), baseMat);
  const b2 = b1.clone();
  b1.position.set(-w, 0.07, 0);
  b2.position.set(w, 0.07, 0);
  group.add(p1, p2, bar, b1, b2);

  const glow = new THREE.MeshBasicMaterial({
    color: night ? 0x5ee8ff : finish ? 0xc4a574 : 0x3a80d0,
    transparent: true,
    opacity: night ? 0.85 : 0.72,
    fog: true,
  });
  mats.push(glow);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(w * 2 + 0.08, 0.05, 0.05), glow);
  rim.position.set(0, h - 0.14, 0.09);
  group.add(rim);

  if (finish) {
    const checker = makeCheckerTexture();
    checker.repeat.set(10, 2);
    textures.push(checker);
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 2 - 0.12, 0.92),
      new THREE.MeshBasicMaterial({ map: checker, fog: true }),
    );
    banner.position.set(0, h - 0.58, 0.04);
    group.add(banner);
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 2 - 0.08, 0.14),
      new THREE.MeshBasicMaterial({ color: 0xc4a574, fog: true }),
    );
    stripe.position.set(0, h - 0.16, 0.05);
    group.add(stripe);
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 1.15, 0.22),
      new THREE.MeshBasicMaterial({ color: 0x111113, fog: true }),
    );
    plate.position.set(0, h - 0.92, 0.05);
    group.add(plate);
  } else {
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(1.35, 0.38),
      new THREE.MeshBasicMaterial({ color: night ? 0x0c1020 : 0x111318, fog: true }),
    );
    panel.position.set(0, h - 0.42, 0.05);
    group.add(panel);
    const pin = new THREE.Mesh(
      new THREE.PlaneGeometry(1.12, 0.08),
      new THREE.MeshBasicMaterial({ color: night ? 0x5ee8ff : 0xf4f4f2, fog: true }),
    );
    pin.position.set(0, h - 0.42, 0.06);
    group.add(pin);
  }

  group.position.set(sm.x, sm.y, sm.z);
  _fwd.set(sm.tx, sm.ty, sm.tz);
  _up.set(sm.ux, sm.uy, sm.uz);
  group.quaternion.setFromRotationMatrix(lookMat(_fwd, _up));
  return { group, mats, textures };
}
