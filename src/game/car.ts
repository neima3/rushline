import * as THREE from "three";
import type { ThemeId } from "./types";
import { makeLiveryTexture } from "./textures";
import { CAR_PAINT } from "./presentation";

export type CarRig = {
  group: THREE.Group;
  wheels: THREE.Mesh[];
  body: THREE.Group;
  mats: THREE.Material[];
  headlights: THREE.Mesh[];
  taillights: THREE.Mesh[];
  flames: THREE.Mesh[];
  setBrakeLights: (on: boolean) => void;
  setBoostVisual: (amount: number) => void;
  setHeadlights: (on: boolean) => void;
  setOpacity: (opacity: number) => void;
  setGhostRace: (splitMs: number | null, playerS: number, ghostS: number) => void;
  setTheme: (theme: ThemeId) => void;
  applyPose: (
    steer: number,
    speed: number,
    slide: number,
    airborne: boolean,
    dt: number,
    landJuice?: number,
    boostJuice?: number,
  ) => void;
};

type MatOpts = {
  color: number;
  roughness?: number;
  metalness?: number;
  emissive?: number;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  physical?: boolean;
  clearcoat?: number;
  clearcoatRoughness?: number;
  sheen?: number;
  sheenRoughness?: number;
  sheenColor?: number;
  envMapIntensity?: number;
  iridescence?: number;
};

export function makeCar(ghost: boolean): CarRig {
  const group = new THREE.Group();
  const body = new THREE.Group();
  const mats: THREE.Material[] = [];
  const wheels: THREE.Mesh[] = [];
  const headlights: THREE.Mesh[] = [];
  const taillights: THREE.Mesh[] = [];
  const flames: THREE.Mesh[] = [];
  const GHOST_BASE = 0.46;
  const op = ghost ? GHOST_BASE : 1;
  const baseOpacity: number[] = [];

  const mat = (opts: MatOpts) => {
    const base = {
      color: ghost ? 0xb8d4e8 : opts.color,
      roughness: opts.roughness ?? 0.4,
      metalness: opts.metalness ?? 0.4,
      emissive: ghost ? 0x3de8ff : (opts.emissive ?? 0x000000),
      emissiveIntensity: ghost ? 0.42 : (opts.emissiveIntensity ?? 0),
      transparent: Boolean(ghost || opts.transparent),
      opacity: ghost ? op : (opts.opacity ?? 1),
    };
    const m =
      opts.physical || opts.clearcoat
        ? new THREE.MeshPhysicalMaterial({
            ...base,
            transmission: opts.physical && !ghost ? 0.1 : 0,
            thickness: opts.physical ? 0.2 : 0,
            clearcoat: ghost ? 0 : (opts.clearcoat ?? 0),
            clearcoatRoughness: opts.clearcoatRoughness ?? 0.22,
            sheen: ghost ? 0 : (opts.sheen ?? 0),
            sheenRoughness: opts.sheenRoughness ?? 0.42,
            sheenColor: new THREE.Color(opts.sheenColor ?? 0xffe4c4),
            envMapIntensity: opts.envMapIntensity ?? 1,
            iridescence: ghost ? 0 : (opts.iridescence ?? 0),
            iridescenceIOR: 1.28,
            iridescenceThicknessRange: [120, 380],
          })
        : new THREE.MeshStandardMaterial(base);
    mats.push(m);
    baseOpacity.push(m.opacity);
    return m;
  };

  const dayLivery = ghost ? null : makeLiveryTexture(false);
  const nightLivery = ghost ? null : makeLiveryTexture(true);
  const bodyMat = mat({
    color: 0xffffff,
    roughness: CAR_PAINT.roughness,
    metalness: CAR_PAINT.metalness,
    clearcoat: CAR_PAINT.clearcoat,
    clearcoatRoughness: CAR_PAINT.clearcoatRoughness,
    sheen: CAR_PAINT.sheen,
    sheenRoughness: CAR_PAINT.sheenRoughness,
    sheenColor: 0xffe6cc,
    envMapIntensity: 1.12,
    iridescence: CAR_PAINT.iridescence,
  });
  if (dayLivery) {
    const bm = bodyMat as THREE.MeshPhysicalMaterial;
    bm.map = dayLivery;
    const rough = makePaintRoughness();
    bm.roughnessMap = rough;
    bm.needsUpdate = true;
  }
  const carbon = mat({
    color: 0x1a1a1e,
    roughness: 0.32,
    metalness: 0.62,
    clearcoat: 0.28,
    clearcoatRoughness: 0.22,
  });
  const glass = mat({
    color: 0x0c1218,
    roughness: 0.04,
    metalness: 0.22,
    transparent: true,
    opacity: ghost ? 0.18 : 0.56,
    physical: true,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.35,
  });
  const gold = mat({
    color: 0xd2ae62,
    roughness: 0.18,
    metalness: 0.86,
    emissive: 0x3a2a14,
    emissiveIntensity: 0.22,
    clearcoat: 0.55,
    clearcoatRoughness: 0.12,
    sheen: 0.2,
    sheenColor: 0xffd88a,
  });
  const accent = mat({
    color: 0xef5a24,
    roughness: 0.3,
    metalness: 0.5,
    emissive: 0x4a1808,
    emissiveIntensity: 0.2,
  });
  const rubber = mat({ color: 0x0c0c0e, roughness: 0.92, metalness: 0.04 });
  const rim = mat({
    color: 0xd0d4dc,
    roughness: 0.14,
    metalness: 0.92,
    clearcoat: 0.62,
    clearcoatRoughness: 0.1,
  });
  const headMat = mat({ color: 0xf2f0e4, roughness: 0.15, metalness: 0.4, emissive: 0xf2f0e4, emissiveIntensity: ghost ? 0.1 : 1.15 });
  const tailMat = mat({ color: 0xff2a22, roughness: 0.3, metalness: 0.2, emissive: 0xff2a22, emissiveIntensity: ghost ? 0.1 : 0.65 });
  const flameMat = mat({
    color: 0xff8a3a,
    roughness: 0.4,
    metalness: 0,
    emissive: 0xff6a20,
    emissiveIntensity: 1.8,
    transparent: true,
    opacity: 0.92,
  });
  flameMat.blending = THREE.AdditiveBlending;
  flameMat.depthWrite = false;

  const add = (mesh: THREE.Mesh, parent: THREE.Object3D = body) => {
    mesh.castShadow = !ghost;
    mesh.receiveShadow = !ghost;
    parent.add(mesh);
    return mesh;
  };

  add(mesh(new THREE.BoxGeometry(1.08, 0.22, 1.72), bodyMat)).position.set(0, 0.34, 0.02);
  add(mesh(new THREE.BoxGeometry(0.96, 0.16, 0.55), bodyMat)).position.set(0, 0.32, 0.92);
  add(mesh(new THREE.BoxGeometry(0.72, 0.12, 0.32), bodyMat)).position.set(0, 0.3, 1.12);
  add(mesh(new THREE.BoxGeometry(1.02, 0.18, 0.52), bodyMat)).position.set(0, 0.32, -0.88);
  add(mesh(new THREE.BoxGeometry(1.06, 0.14, 0.4), bodyMat)).position.set(0, 0.4, -0.94);
  add(mesh(new THREE.BoxGeometry(0.94, 0.26, 0.82), glass)).position.set(0, 0.54, -0.06);
  add(mesh(new THREE.BoxGeometry(0.84, 0.08, 0.44), glass)).position.set(0, 0.61, 0.3);
  add(mesh(new THREE.BoxGeometry(0.2, 0.04, 1.88), gold)).position.set(0, 0.46, 0.04);
  add(mesh(new THREE.BoxGeometry(0.05, 0.035, 1.7), accent)).position.set(0.18, 0.47, 0.02);
  add(mesh(new THREE.BoxGeometry(0.05, 0.035, 1.7), accent)).position.set(-0.18, 0.47, 0.02);
  for (const x of [-0.55, 0.55]) {
    const flank = add(mesh(new THREE.BoxGeometry(0.05, 0.16, 1.15), bodyMat));
    flank.position.set(x, 0.34, -0.02);
  }
  for (const x of [-0.42, 0.42]) {
    const pillar = add(mesh(new THREE.BoxGeometry(0.045, 0.22, 0.05), carbon));
    pillar.position.set(x, 0.52, 0.28);
  }
  add(mesh(new THREE.BoxGeometry(1.14, 0.08, 1.48), carbon)).position.set(0, 0.2, 0);
  add(mesh(new THREE.BoxGeometry(1.2, 0.05, 0.36), carbon)).position.set(0, 0.2, 1.18);
  add(mesh(new THREE.BoxGeometry(1.16, 0.055, 0.3), carbon)).position.set(0, 0.23, 1.14);
  add(mesh(new THREE.BoxGeometry(1.12, 0.05, 0.28), carbon)).position.set(0, 0.21, -1.08);
  for (const x of [-0.58, 0.58]) {
    const skirt = add(mesh(new THREE.BoxGeometry(0.08, 0.12, 1.42), carbon));
    skirt.position.set(x, 0.22, 0);
  }
  for (const [x, z] of [
    [-0.56, 0.68],
    [0.56, 0.68],
    [-0.56, -0.68],
    [0.56, -0.68],
  ] as const) {
    const flare = add(mesh(new THREE.BoxGeometry(0.2, 0.13, 0.4), bodyMat));
    flare.position.set(x, 0.36, z);
  }
  for (const x of [-0.28, -0.1, 0.1, 0.28]) {
    const fin = add(mesh(new THREE.BoxGeometry(0.04, 0.1, 0.22), carbon));
    fin.position.set(x, 0.18, -1.14);
  }
  const wing = add(mesh(new THREE.BoxGeometry(1.32, 0.05, 0.26), bodyMat));
  wing.position.set(0, 0.66, -1.06);
  add(mesh(new THREE.BoxGeometry(1.28, 0.02, 0.08), gold)).position.set(0, 0.69, -1.06);
  for (const x of [-0.62, 0.62]) {
    const plate = add(mesh(new THREE.BoxGeometry(0.045, 0.2, 0.26), carbon));
    plate.position.set(x, 0.68, -1.06);
  }
  for (const x of [-0.32, 0.32]) {
    const stay = add(mesh(new THREE.BoxGeometry(0.035, 0.22, 0.035), carbon));
    stay.position.set(x, 0.5, -1.0);
  }
  add(mesh(new THREE.BoxGeometry(0.16, 0.03, 0.2), gold)).position.set(0, 0.65, -1.05);
  if (ghost) {
    const halo = mat({
      color: 0x5ee8ff,
      roughness: 0.35,
      metalness: 0.1,
      emissive: 0x5ee8ff,
      emissiveIntensity: 0.95,
      transparent: true,
      opacity: 0.55,
    });
    add(mesh(new THREE.BoxGeometry(1.2, 0.035, 1.86), halo)).position.set(0, 0.48, 0.02);
  }
  for (const x of [-0.58, 0.58]) {
    const mirror = add(mesh(new THREE.BoxGeometry(0.16, 0.07, 0.1), carbon));
    mirror.position.set(x, 0.5, 0.18);
  }
  for (const x of [-0.56, 0.56]) {
    const disc = add(mesh(new THREE.CircleGeometry(0.13, 14), gold));
    disc.position.set(x, 0.4, 0.06);
    disc.rotation.y = x < 0 ? -Math.PI / 2 : Math.PI / 2;
    const ring = add(mesh(new THREE.RingGeometry(0.13, 0.155, 14), carbon));
    ring.position.set(x + (x < 0 ? -0.002 : 0.002), 0.4, 0.06);
    ring.rotation.y = x < 0 ? -Math.PI / 2 : Math.PI / 2;
  }

  for (const x of [-0.38, 0.38]) {
    const h = add(mesh(new THREE.BoxGeometry(0.22, 0.08, 0.08), headMat));
    h.position.set(x, 0.32, 1.16);
    headlights.push(h);
  }
  const bar = add(mesh(new THREE.BoxGeometry(0.92, 0.055, 0.05), tailMat));
  bar.position.set(0, 0.4, -1.16);
  taillights.push(bar);
  for (const x of [-0.36, 0.36]) {
    const t = add(mesh(new THREE.BoxGeometry(0.28, 0.08, 0.06), tailMat));
    t.position.set(x, 0.34, -1.14);
    taillights.push(t);
  }
  for (const x of [-0.18, 0.18]) {
    const pipe = add(mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.16, 8), carbon));
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(x, 0.2, -1.18);
  }

  let cabinGlow: THREE.PointLight | null = null;
  let boostLight: THREE.PointLight | null = null;
  if (!ghost) {
    const flameGeo = new THREE.ConeGeometry(0.07, 0.38, 7);
    flameGeo.rotateX(-Math.PI / 2);
    for (const x of [-0.18, 0.18]) {
      const f = new THREE.Mesh(flameGeo, flameMat);
      f.position.set(x, 0.2, -1.32);
      f.visible = false;
      f.castShadow = false;
      body.add(f);
      flames.push(f);
    }
    const glow = new THREE.PointLight(0xdde4ee, 0.45, 7, 2);
    glow.position.set(0, 0.45, 0.2);
    body.add(glow);
    cabinGlow = glow;
    boostLight = new THREE.PointLight(0xff7a2a, 0, 7.5, 2);
    boostLight.position.set(0, 0.22, -1.28);
    body.add(boostLight);
  }

  group.add(body);

  let contact: THREE.Mesh | null = null;
  if (!ghost) {
    const blobMat = new THREE.MeshBasicMaterial({
      color: 0x05060a,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      fog: true,
    });
    const blob = new THREE.Mesh(new THREE.CircleGeometry(0.92, 22), blobMat);
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.018;
    blob.renderOrder = -2;
    blob.castShadow = false;
    blob.receiveShadow = false;
    group.add(blob);
    contact = blob;
    mats.push(blobMat);
    baseOpacity.push(blobMat.opacity);
  }

  const tireGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.18, 14);
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.19, 12);
  rimGeo.rotateZ(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(0.04, 0.03, 0.22);
  const spots: [number, number, number][] = [
    [-0.52, 0.28, 0.68],
    [0.52, 0.28, 0.68],
    [-0.52, 0.28, -0.68],
    [0.52, 0.28, -0.68],
  ];
  const hubs: THREE.Group[] = [];
  const spins: THREE.Group[] = [];
  for (const [x, y, z] of spots) {
    const steerG = new THREE.Group();
    steerG.position.set(x, y, z);
    const spinG = new THREE.Group();
    const tire = new THREE.Mesh(tireGeo, rubber);
    tire.castShadow = !ghost;
    const dish = new THREE.Mesh(rimGeo, rim);
    spinG.add(tire, dish);
    for (let s = 0; s < 5; s++) {
      const sp = new THREE.Mesh(spokeGeo, rim);
      sp.rotation.x = (s / 5) * Math.PI;
      spinG.add(sp);
    }
    steerG.add(spinG);
    group.add(steerG);
    wheels.push(tire);
    hubs.push(steerG);
    spins.push(spinG);
  }

  const applyPose = (
    steer: number,
    speed: number,
    slide: number,
    airborne: boolean,
    dt: number,
    landJuice = 0,
    boostJuice = 0,
  ) => {
    const spin = (speed / 0.28) * dt;
    for (let i = 0; i < spins.length; i++) {
      spins[i]!.rotation.x -= spin;
      if (i < 2) hubs[i]!.rotation.y = steer * 0.38;
    }
    const squat = landJuice * 0.14;
    const roll = -steer * (0.1 + slide * 0.1);
    const pitch = airborne ? 0.07 : -slide * 0.08 + landJuice * 0.1 - boostJuice * 0.04;
    const k = 1 - Math.exp(-10 * dt);
    body.rotation.z += (roll - body.rotation.z) * k;
    body.rotation.x += (pitch - body.rotation.x) * k;
    body.position.y += (-squat - body.position.y) * k;
    const sy = 1 - squat * 0.55;
    const sx = 1 + squat * 0.35 + boostJuice * 0.04;
    body.scale.set(sx, sy, 1 + squat * 0.12);
    if (contact) {
      const planted = airborne ? 0.05 : 0.3 - squat * 0.12;
      (contact.material as THREE.MeshBasicMaterial).opacity = planted;
      contact.scale.setScalar(airborne ? 0.72 : 1 + slide * 0.08);
    }
  };

  const setBrakeLights = (on: boolean) => {
    const v = ghost ? 0.1 : on ? 2.4 : 0.65;
    for (const m of mats) {
      if (m === tailMat) (m as THREE.MeshStandardMaterial).emissiveIntensity = v;
    }
  };

  const setBoostVisual = (amount: number) => {
    const on = amount > 0.05 && !ghost;
    const flicker = on ? 0.82 + Math.random() * 0.36 : 1;
    for (const f of flames) {
      f.visible = on;
      f.scale.set(0.75 + amount * 0.55, 0.75 + amount * 0.55, (0.42 + amount * 2.15) * flicker);
    }
    if (!ghost) {
      (flameMat as THREE.MeshStandardMaterial).emissiveIntensity = 1.35 + amount * 3.1 * flicker;
      if (boostLight) boostLight.intensity = on ? 1.05 + amount * 2.6 : 0;
    }
  };

  const setHeadlights = (on: boolean) => {
    (headMat as THREE.MeshStandardMaterial).emissiveIntensity = ghost ? 0.1 : on ? 3.2 : 1.15;
    if (cabinGlow) cabinGlow.intensity = on ? 0.85 : 0.4;
  };

  const setTheme = (theme: ThemeId) => {
    if (ghost) return;
    const night = theme === "night";
    const bm = bodyMat as THREE.MeshStandardMaterial;
    const tex = night ? nightLivery : dayLivery;
    if (tex) {
      bm.map = tex;
      bm.needsUpdate = true;
    }
    bm.emissive.setHex(night ? 0x2a3a68 : 0x1a100c);
    bm.emissiveIntensity = night ? 0.28 : 0.04;
    const bodyPhys = bodyMat as THREE.MeshPhysicalMaterial;
    bodyPhys.sheenColor.setHex(night ? 0x9ad8ff : theme === "alpine" ? 0xd8e8f8 : 0xffe6cc);
    // Circuit High scene env stays 0.08 so asphalt does not wash. The car
    // multiplies that back up so clearcoat can still read the sky.
    const env = night ? CAR_PAINT.envNight : theme === "canyon" ? CAR_PAINT.envCanyon : CAR_PAINT.envDay;
    bodyPhys.envMapIntensity = env;
    bodyPhys.clearcoat = night ? 0.88 : CAR_PAINT.clearcoat;
    bodyPhys.iridescence = night ? 0.22 : CAR_PAINT.iridescence;
    (glass as THREE.MeshPhysicalMaterial).envMapIntensity = env * 1.1;
    (gold as THREE.MeshPhysicalMaterial).envMapIntensity = env;
    (carbon as THREE.MeshPhysicalMaterial).envMapIntensity = env * 0.7;
    (rim as THREE.MeshPhysicalMaterial).envMapIntensity = env * 0.85;
    (carbon as THREE.MeshStandardMaterial).color.setHex(night ? 0x12182a : 0x1a1a1e);
    (accent as THREE.MeshStandardMaterial).color.setHex(night ? 0x3de8ff : 0xef5a24);
    (accent as THREE.MeshStandardMaterial).emissive.setHex(night ? 0x146880 : 0x4a1808);
    (accent as THREE.MeshStandardMaterial).emissiveIntensity = night ? 0.85 : 0.22;
    (rim as THREE.MeshStandardMaterial).color.setHex(night ? 0x8a78c0 : 0xd0d4dc);
    if (boostLight) boostLight.color.setHex(night ? 0x4ef0ff : 0xff7a2a);
  };

  return {
    group,
    wheels,
    body,
    mats,
    headlights,
    taillights,
    flames,
    setBrakeLights,
    setBoostVisual,
    setHeadlights,
    setOpacity: (opacity: number) => {
      const k = ghost ? opacity / GHOST_BASE : 1;
      mats.forEach((m, i) => {
        const next = Math.max(0, Math.min(1, (baseOpacity[i] ?? 1) * k));
        m.opacity = next;
        m.transparent = next < 0.99;
        m.needsUpdate = true;
      });
    },
    setGhostRace: (splitMs, _playerS, _ghostS) => {
      if (!ghost) return;
      const behind = splitMs != null && splitMs > 48;
      const ahead = splitMs != null && splitMs < -48;
      const hex = ahead ? 0x6ee8b8 : behind ? 0xff7a9a : 0x5ee8ff;
      const glow = ahead ? 0.32 : behind ? 0.78 : 0.42;
      for (const m of mats) {
        const sm = m as THREE.MeshStandardMaterial;
        if (sm.emissive) {
          sm.emissive.setHex(hex);
          sm.emissiveIntensity = glow;
        }
      }
    },
    setTheme,
    applyPose,
  };
}

function mesh(geo: THREE.BufferGeometry, material: THREE.Material) {
  return new THREE.Mesh(geo, material);
}

function makePaintRoughness() {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const n = 36 + ((x * 13 + y * 7) % 38) + Math.sin((x + y) * 0.35) * 8;
      d[i] = d[i + 1] = d[i + 2] = Math.max(20, Math.min(90, n));
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}
