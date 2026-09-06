import * as THREE from "three";

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
  applyPose: (steer: number, speed: number, slide: number, airborne: boolean, dt: number) => void;
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
};

export function makeCar(ghost: boolean): CarRig {
  const group = new THREE.Group();
  const body = new THREE.Group();
  const mats: THREE.Material[] = [];
  const wheels: THREE.Mesh[] = [];
  const headlights: THREE.Mesh[] = [];
  const taillights: THREE.Mesh[] = [];
  const flames: THREE.Mesh[] = [];
  const op = ghost ? 0.34 : 1;

  const mat = (opts: MatOpts) => {
    const base = {
      color: ghost ? 0x9aa7b5 : opts.color,
      roughness: opts.roughness ?? 0.4,
      metalness: opts.metalness ?? 0.4,
      emissive: ghost ? 0x4a5a70 : (opts.emissive ?? 0x000000),
      emissiveIntensity: ghost ? 0.25 : (opts.emissiveIntensity ?? 0),
      transparent: Boolean(ghost || opts.transparent),
      opacity: ghost ? op : (opts.opacity ?? 1),
    };
    const m = opts.physical
      ? new THREE.MeshPhysicalMaterial({ ...base, transmission: ghost ? 0 : 0.15, thickness: 0.2 })
      : new THREE.MeshStandardMaterial(base);
    mats.push(m);
    return m;
  };

  const bodyMat = mat({ color: 0xe8e9ed, roughness: 0.28, metalness: 0.55 });
  const carbon = mat({ color: 0x141418, roughness: 0.42, metalness: 0.7 });
  const glass = mat({
    color: 0x1a2430,
    roughness: 0.08,
    metalness: 0.85,
    transparent: true,
    opacity: ghost ? 0.2 : 0.62,
    physical: true,
  });
  const gold = mat({ color: 0xc4a574, roughness: 0.35, metalness: 0.65, emissive: 0x3a2a14, emissiveIntensity: 0.2 });
  const rubber = mat({ color: 0x111113, roughness: 0.88, metalness: 0.08 });
  const rim = mat({ color: 0x9aa3ae, roughness: 0.28, metalness: 0.82 });
  const headMat = mat({ color: 0xf2f0e4, roughness: 0.15, metalness: 0.4, emissive: 0xf2f0e4, emissiveIntensity: ghost ? 0.1 : 1.15 });
  const tailMat = mat({ color: 0xff2a22, roughness: 0.3, metalness: 0.2, emissive: 0xff2a22, emissiveIntensity: ghost ? 0.1 : 0.65 });
  const flameMat = mat({
    color: 0xff8a3a,
    roughness: 0.4,
    metalness: 0,
    emissive: 0xff6a20,
    emissiveIntensity: 1.8,
    transparent: true,
    opacity: 0.85,
  });

  const add = (mesh: THREE.Mesh, parent: THREE.Object3D = body) => {
    mesh.castShadow = !ghost;
    mesh.receiveShadow = !ghost;
    parent.add(mesh);
    return mesh;
  };

  add(mesh(new THREE.BoxGeometry(1.08, 0.22, 1.72), bodyMat)).position.set(0, 0.32, 0.02);
  add(mesh(new THREE.BoxGeometry(0.96, 0.16, 0.55), bodyMat)).position.set(0, 0.3, 0.92);
  add(mesh(new THREE.BoxGeometry(0.72, 0.12, 0.32), bodyMat)).position.set(0, 0.28, 1.12);
  add(mesh(new THREE.BoxGeometry(1.02, 0.18, 0.52), bodyMat)).position.set(0, 0.3, -0.88);
  add(mesh(new THREE.BoxGeometry(0.9, 0.24, 0.78), glass)).position.set(0, 0.52, -0.08);
  add(mesh(new THREE.BoxGeometry(0.82, 0.08, 0.42), glass)).position.set(0, 0.58, 0.28);
  add(mesh(new THREE.BoxGeometry(0.16, 0.035, 1.85), gold)).position.set(0, 0.44, 0.04);
  add(mesh(new THREE.BoxGeometry(1.14, 0.05, 0.28), carbon)).position.set(0, 0.22, 1.12);
  add(mesh(new THREE.BoxGeometry(1.16, 0.06, 0.32), carbon)).position.set(0, 0.22, -1.08);
  for (const x of [-0.28, -0.1, 0.1, 0.28]) {
    const fin = add(mesh(new THREE.BoxGeometry(0.04, 0.1, 0.22), carbon));
    fin.position.set(x, 0.18, -1.14);
  }
  const wing = add(mesh(new THREE.BoxGeometry(1.18, 0.04, 0.22), carbon));
  wing.position.set(0, 0.62, -1.05);
  for (const x of [-0.58, 0.58]) {
    const plate = add(mesh(new THREE.BoxGeometry(0.04, 0.16, 0.24), carbon));
    plate.position.set(x, 0.66, -1.05);
  }
  for (const x of [-0.32, 0.32]) {
    const stay = add(mesh(new THREE.BoxGeometry(0.035, 0.22, 0.035), carbon));
    stay.position.set(x, 0.5, -1.0);
  }
  add(mesh(new THREE.BoxGeometry(0.16, 0.03, 0.2), gold)).position.set(0, 0.65, -1.05);
  for (const x of [-0.58, 0.58]) {
    const mirror = add(mesh(new THREE.BoxGeometry(0.16, 0.07, 0.1), carbon));
    mirror.position.set(x, 0.5, 0.18);
  }
  add(mesh(new THREE.BoxGeometry(1.12, 0.08, 1.4), carbon)).position.set(0, 0.2, 0);
  const numL = add(mesh(new THREE.CircleGeometry(0.1, 12), gold));
  numL.position.set(-0.55, 0.38, 0.05);
  numL.rotation.y = -Math.PI / 2;
  const numR = add(mesh(new THREE.CircleGeometry(0.1, 12), gold));
  numR.position.set(0.55, 0.38, 0.05);
  numR.rotation.y = Math.PI / 2;

  for (const x of [-0.38, 0.38]) {
    const h = add(mesh(new THREE.BoxGeometry(0.22, 0.08, 0.08), headMat));
    h.position.set(x, 0.32, 1.16);
    headlights.push(h);
  }
  for (const x of [-0.36, 0.36]) {
    const t = add(mesh(new THREE.BoxGeometry(0.28, 0.07, 0.06), tailMat));
    t.position.set(x, 0.34, -1.14);
    taillights.push(t);
  }
  for (const x of [-0.18, 0.18]) {
    const pipe = add(mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.16, 8), carbon));
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(x, 0.2, -1.18);
  }

  let cabinGlow: THREE.PointLight | null = null;
  if (!ghost) {
    const flameGeo = new THREE.ConeGeometry(0.06, 0.32, 6);
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
  }

  group.add(body);

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

  const applyPose = (steer: number, speed: number, slide: number, airborne: boolean, dt: number) => {
    const spin = (speed / 0.28) * dt;
    for (let i = 0; i < spins.length; i++) {
      spins[i]!.rotation.x -= spin;
      if (i < 2) hubs[i]!.rotation.y = steer * 0.38;
    }
    const roll = -steer * (0.1 + slide * 0.08);
    const pitch = airborne ? 0.06 : -slide * 0.07;
    const k = 1 - Math.exp(-10 * dt);
    body.rotation.z += (roll - body.rotation.z) * k;
    body.rotation.x += (pitch - body.rotation.x) * k;
  };

  const setBrakeLights = (on: boolean) => {
    const v = ghost ? 0.1 : on ? 2.4 : 0.65;
    for (const m of mats) {
      if (m === tailMat) (m as THREE.MeshStandardMaterial).emissiveIntensity = v;
    }
  };

  const setBoostVisual = (amount: number) => {
    for (const f of flames) {
      f.visible = amount > 0.05 && !ghost;
      f.scale.set(1, 1, 0.4 + amount * 1.8);
    }
    if (!ghost) (flameMat as THREE.MeshStandardMaterial).emissiveIntensity = 1.2 + amount * 2.2;
  };

  const setHeadlights = (on: boolean) => {
    (headMat as THREE.MeshStandardMaterial).emissiveIntensity = ghost ? 0.1 : on ? 3.4 : 1.05;
    if (cabinGlow) cabinGlow.intensity = on ? 0.95 : 0.45;
    if (!ghost) {
      (bodyMat as THREE.MeshStandardMaterial).emissive.setHex(on ? 0x243044 : 0x000000);
      (bodyMat as THREE.MeshStandardMaterial).emissiveIntensity = on ? 0.16 : 0;
    }
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
    applyPose,
  };
}

function mesh(geo: THREE.BufferGeometry, material: THREE.Material) {
  return new THREE.Mesh(geo, material);
}
