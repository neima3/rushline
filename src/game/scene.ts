import * as THREE from "three";
import type { BuiltTrack, CameraMode, CarSnap, GhostFrame, ThemeId } from "./types";
import { buildTrackMeshes, sampleAt } from "./track";
import { makeCar, type CarRig } from "./car";
import { applyGroundMaterial, buildEnvironment } from "./env";
import { Vfx } from "./vfx";

const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _look = new THREE.Vector3();
const _right = new THREE.Vector3();

type ThemePack = {
  fog: number;
  ground: number;
  hemiSky: number;
  hemiGround: number;
  sun: number;
  sunPos: [number, number, number];
  exposure: number;
  hemiIntensity: number;
  sunIntensity: number;
  fogNear: number;
  fogFar: number;
  sky: string;
};

const THEMES: Record<ThemeId, ThemePack> = {
  stadium: {
    fog: 0xa8c4de,
    ground: 0x6ea05a,
    hemiSky: 0x8ec4ff,
    hemiGround: 0x8a9688,
    sun: 0xffeed4,
    sunPos: [80, 130, 36],
    exposure: 1.06,
    hemiIntensity: 0.78,
    sunIntensity: 1.22,
    fogNear: 100,
    fogFar: 500,
    sky: "/textures/sky-stadium.jpg",
  },
  canyon: {
    fog: 0xd4a070,
    ground: 0x8a5a38,
    hemiSky: 0xffb878,
    hemiGround: 0x8a4a28,
    sun: 0xffb060,
    sunPos: [-70, 28, 90],
    exposure: 1.06,
    hemiIntensity: 0.74,
    sunIntensity: 1.38,
    fogNear: 80,
    fogFar: 420,
    sky: "/textures/sky-canyon.jpg",
  },
  night: {
    fog: 0x1c2238,
    ground: 0x161820,
    hemiSky: 0x3a4a78,
    hemiGround: 0x2c3a52,
    sun: 0x7ab8d8,
    sunPos: [-40, 70, 20],
    exposure: 1.0,
    hemiIntensity: 0.78,
    sunIntensity: 0.52,
    fogNear: 85,
    fogFar: 460,
    sky: "/textures/sky-night.jpg",
  },
};

export class World {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);
  renderer: THREE.WebGLRenderer;
  private trackRoot = new THREE.Group();
  private envRoot = new THREE.Group();
  private car: CarRig;
  private ghost: CarRig;
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private skyMesh: THREE.Mesh | null = null;
  private ground: THREE.Mesh;
  private vfx = new Vfx();
  private disposables: { dispose: () => void }[] = [];
  private textures: THREE.Texture[] = [];
  private camPos = new THREE.Vector3(0, 8, 16);
  private lookPos = new THREE.Vector3();
  trauma = 0;
  private clockT = 0;
  private loader = new THREE.TextureLoader();
  private nightLights: THREE.Object3D[] = [];
  private theme: ThemeId = "stadium";
  private loadedKey: string | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(canvas.clientWidth || 800, canvas.clientHeight || 600, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene.background = new THREE.Color(0x8eb8dc);
    this.scene.fog = new THREE.Fog(0x8eb8dc, 80, 400);

    this.hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a9a6a, 0.75);
    this.sun = new THREE.DirectionalLight(0xfff4e0, 1.45);
    this.sun.position.set(80, 120, 40);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1536, 1536);
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 280;
    this.sun.shadow.camera.left = -70;
    this.sun.shadow.camera.right = 70;
    this.sun.shadow.camera.top = 70;
    this.sun.shadow.camera.bottom = -70;
    this.sun.shadow.bias = -0.0003;
    this.scene.add(this.hemi, this.sun, this.sun.target);

    const groundGeo = new THREE.PlaneGeometry(900, 900);
    groundGeo.rotateX(-Math.PI / 2);
    this.ground = new THREE.Mesh(
      groundGeo,
      new THREE.MeshStandardMaterial({ color: 0x6ea05a, roughness: 1, metalness: 0 }),
    );
    this.ground.position.y = -0.4;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    this.scene.add(this.trackRoot, this.envRoot);

    this.car = makeCar(false);
    this.ghost = makeCar(true);
    this.ghost.group.visible = false;
    this.scene.add(this.car.group, this.ghost.group, this.vfx.root);
    this.disposables.push(groundGeo, this.ground.material as THREE.Material);
  }

  resize(w: number, h: number) {
    if (w < 1 || h < 1) return;
    const mobile = w < 720;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  loadTrack(track: BuiltTrack, theme: ThemeId) {
    const key = `${track.def.id}:${theme}`;
    if (this.loadedKey === key && this.trackRoot.children.length > 0) {
      this.theme = theme;
      this.car.setThemeLivery(theme);
      this.car.setHeadlights(theme === "night");
      return;
    }
    this.loadedKey = key;
    this.theme = theme;
    this.clearGroup(this.trackRoot);
    this.clearGroup(this.envRoot);
    for (const o of this.nightLights) this.scene.remove(o);
    this.nightLights = [];
    this.vfx.resetSkids();

    const pack = THEMES[theme];
    this.scene.background = new THREE.Color(pack.fog);
    (this.scene.fog as THREE.Fog).color.set(pack.fog);
    (this.scene.fog as THREE.Fog).near = pack.fogNear;
    (this.scene.fog as THREE.Fog).far = pack.fogFar;
    this.hemi.color.set(pack.hemiSky);
    this.hemi.groundColor.set(pack.hemiGround);
    this.hemi.intensity = pack.hemiIntensity;
    this.sun.color.set(pack.sun);
    this.sun.position.set(...pack.sunPos);
    this.sun.target.position.set(0, 0, 0);
    this.sun.intensity = pack.sunIntensity;
    this.renderer.toneMappingExposure = pack.exposure;
    (this.ground.material as THREE.MeshStandardMaterial).color.set(pack.ground);
    this.ground.position.y = theme === "canyon" ? -18 : theme === "night" ? -8 : -0.6;
    applyGroundMaterial(this.ground, theme, this.textures);

    const built = buildTrackMeshes(track, theme);
    this.trackRoot.add(built.group);
    this.disposables.push(...built.geos, ...built.materials);
    if ("textures" in built && Array.isArray(built.textures)) {
      this.textures.push(...(built.textures as THREE.Texture[]));
    }

    this.addGates(track, theme);
    const env = buildEnvironment(track, theme);
    this.envRoot.add(env.group);
    this.disposables.push(...env.geos, ...env.mats);
    this.textures.push(...env.textures);
    this.nightLights = env.lights;
    this.car.setThemeLivery(theme);
    this.car.setHeadlights(theme === "night");
    this.loadSky(pack.sky, pack.fog);

    const start = sampleAt(track, 6);
    this.camPos.set(start.x - start.tx * 10 + start.ux * 4, start.y + 4, start.z - start.tz * 10 + start.uz * 4);
    this.camera.position.copy(this.camPos);
  }

  private skyUrl: string | null = null;

  private loadSky(url: string, fog: number) {
    if (this.skyMesh && this.skyUrl === url) {
      const mat = this.skyMesh.material as THREE.MeshBasicMaterial;
      if (!mat.map) mat.color.set(fog);
      return;
    }
    if (this.skyMesh) {
      this.scene.remove(this.skyMesh);
      this.skyMesh.geometry.dispose();
      const old = this.skyMesh.material as THREE.MeshBasicMaterial;
      if (old.map) old.map.dispose();
      old.dispose();
      if (this.skyUrl) THREE.Cache.remove(this.skyUrl);
      this.skyMesh = null;
    }
    this.skyUrl = url;
    const geo = new THREE.SphereGeometry(420, 32, 20);
    const mat = new THREE.MeshBasicMaterial({
      color: fog,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    });
    this.skyMesh = new THREE.Mesh(geo, mat);
    this.scene.add(this.skyMesh);
    this.loader.load(
      url,
      (tex) => {
        if (this.skyUrl !== url) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        mat.map = tex;
        mat.color.set(0xffffff);
        mat.needsUpdate = true;
        this.textures.push(tex);
      },
      undefined,
      () => {
        /* keep solid color */
      },
    );
  }

  private addGates(track: BuiltTrack, theme: ThemeId) {
    const arch = (s: number, finish: boolean) => {
      const sm = sampleAt(track, s);
      const g = new THREE.Group();
      const col = finish ? 0xf4f4f2 : theme === "night" ? 0x7ea0c8 : 0xdde4ee;
      const mat = new THREE.MeshStandardMaterial({
        color: col,
        emissive: finish ? 0x8890a0 : 0x3a80d0,
        emissiveIntensity: finish ? 0.25 : 0.7,
        roughness: 0.32,
        metalness: 0.45,
      });
      const h = 3.4;
      const w = sm.width * 0.5 + 0.35;
      const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, h, 0.16), mat);
      const p2 = p1.clone();
      p1.position.set(-w, h / 2, 0);
      p2.position.set(w, h / 2, 0);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w * 2 + 0.16, 0.14, 0.14), mat);
      bar.position.set(0, h, 0);
      g.add(p1, p2, bar);
      if (finish) {
        const banner = new THREE.Mesh(
          new THREE.PlaneGeometry(w * 2, 0.72),
          new THREE.MeshBasicMaterial({ color: 0x111113, fog: true }),
        );
        banner.position.set(0, h - 0.48, 0.02);
        g.add(banner);
        const stripe = new THREE.Mesh(
          new THREE.PlaneGeometry(w * 2, 0.12),
          new THREE.MeshBasicMaterial({ color: 0xc4a574, fog: true }),
        );
        stripe.position.set(0, h - 0.18, 0.03);
        g.add(stripe);
      }
      g.position.set(sm.x, sm.y, sm.z);
      _fwd.set(sm.tx, sm.ty, sm.tz);
      _up.set(sm.ux, sm.uy, sm.uz);
      g.quaternion.setFromRotationMatrix(_lookMat(_fwd, _up));
      this.trackRoot.add(g);
      this.disposables.push(mat);
    };
    arch(2.2, true);
    for (const s of track.checkpoints) arch(s, false);
  }

  applyCar(snap: CarSnap, dt: number, steer: number, brake: number) {
    this.car.group.position.set(snap.px, snap.py, snap.pz);
    this.car.group.quaternion.set(snap.qx, snap.qy, snap.qz, snap.qw);
    this.car.applyPose(steer, snap.speed, snap.slide, snap.airborne, dt);
    this.car.setBrakeLights(brake > 0.2);
    this.car.setBoostVisual(Math.max(snap.boost > 0.05 ? 0.6 + snap.boost * 0.4 : 0, snap.driftCharge * 0.35));
    if (snap.boost > 0.05 || snap.slide > 0.4 || snap.airborne) {
      this.vfx.emitSparks(snap, snap.boost > 0.05 ? 7 : snap.slide > 0.5 ? 4 : 2, snap.boost > 0.05);
    }
    this.vfx.skid(snap, snap.slide > 0.35 && Math.abs(snap.speed) > 8);
  }

  applyGhost(track: BuiltTrack, frames: GhostFrame[] | null, time: number) {
    if (!frames || frames.length < 2) {
      this.ghost.group.visible = false;
      return;
    }
    this.ghost.group.visible = true;
    let i = 0;
    while (i < frames.length - 1 && frames[i + 1]!.t < time) i++;
    const a = frames[i]!;
    const b = frames[Math.min(frames.length - 1, i + 1)]!;
    const span = b.t - a.t || 1;
    const t = Math.max(0, Math.min(1, (time - a.t) / span));
    const s = a.s + (b.s - a.s) * t;
    const n = a.n + (b.n - a.n) * t;
    const heading = a.heading + (b.heading - a.heading) * t;
    const sm = sampleAt(track, s);
    const ch = Math.cos(heading);
    const sh = Math.sin(heading);
    const fx = sm.tx * ch - sm.rx * sh;
    const fy = sm.ty * ch - sm.ry * sh;
    const fz = sm.tz * ch - sm.rz * sh;
    this.ghost.group.position.set(
      sm.x + sm.rx * n + sm.ux * 0.38,
      sm.y + sm.ry * n + sm.uy * 0.38,
      sm.z + sm.rz * n + sm.uz * 0.38,
    );
    _fwd.set(fx, fy, fz);
    _up.set(sm.ux, sm.uy, sm.uz);
    this.ghost.group.quaternion.setFromRotationMatrix(_lookMat(_fwd, _up));
  }

  updateCamera(
    snap: CarSnap,
    dt: number,
    mode: CameraMode,
    attract: boolean,
    attractS: number,
    track: BuiltTrack | null,
    reduced: boolean,
  ) {
    this.clockT += dt;
    if (attract && track) {
      const sm = sampleAt(track, attractS);
      _desired.set(sm.x + sm.ux * 8 - sm.tx * 16, sm.y + 6.5, sm.z + sm.uz * 8 - sm.tz * 16);
      _look.set(sm.x, sm.y + 1.1, sm.z);
      const k = 1 - Math.exp(-1.4 * dt);
      this.camPos.lerp(_desired, k);
      this.lookPos.lerp(_look, k);
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.lookPos);
      this.camera.fov += (56 - this.camera.fov) * (1 - Math.exp(-3 * dt));
      this.camera.updateProjectionMatrix();
      return;
    }

    _fwd.set(snap.fx, snap.fy, snap.fz);
    _up.set(snap.ux, snap.uy, snap.uz);
    _right.crossVectors(_fwd, _up).normalize();
    if (mode === "hood") {
      _desired.set(
        snap.px + snap.ux * 1.08 - snap.fx * 0.35,
        snap.py + 0.82,
        snap.pz + snap.uz * 1.08 - snap.fz * 0.35,
      );
      _look.set(snap.px + snap.fx * 14 + snap.ux * 0.15, snap.py + 0.25, snap.pz + snap.fz * 14 + snap.uz * 0.15);
    } else {
      const dist = 7.6 + Math.abs(snap.speed) * 0.05;
      const height = 2.2 + Math.abs(snap.speed) * 0.014 + (snap.airborne ? 0.8 : 0);
      const lean = -snap.heading * 0.9;
      _desired.set(
        snap.px - snap.fx * dist + snap.ux * height + _right.x * lean,
        snap.py - snap.fy * dist + snap.uy * height,
        snap.pz - snap.fz * dist + snap.uz * height + _right.z * lean,
      );
      _look.set(
        snap.px + snap.fx * 10 + snap.ux * 0.5,
        snap.py + snap.fy * 10 + snap.uy * 0.5,
        snap.pz + snap.fz * 10 + snap.uz * 0.5,
      );
    }
    const k = 1 - Math.exp(-(mode === "hood" ? 9 : 5.2) * dt);
    this.camPos.lerp(_desired, k);
    this.lookPos.lerp(_look, k);

    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    const shake = reduced ? 0 : this.trauma * this.trauma;
    this.camera.position.copy(this.camPos);
    this.camera.position.x += shake * Math.sin(this.clockT * 37) * 0.22;
    this.camera.position.y += shake * Math.cos(this.clockT * 29) * 0.16;
    this.camera.up.lerp(_up.set(snap.ux, snap.uy, snap.uz), 1 - Math.exp(-4 * dt));
    this.camera.lookAt(this.lookPos);

    const targetFov = 56 + Math.abs(snap.speed) * 0.32 + (snap.boost > 0 ? 8 : 0);
    this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-4 * dt));
    this.camera.updateProjectionMatrix();
    this.sun.target.position.set(snap.px, snap.py, snap.pz);
    this.sun.position.set(snap.px + 60, snap.py + 95, snap.pz + 36);
    this.sun.shadow.camera.updateProjectionMatrix();
  }

  addTrauma(v: number) {
    this.trauma = Math.min(1, this.trauma + v);
  }

  stepParticles(dt: number) {
    this.vfx.step(dt);
  }

  render() {
    if (this.skyMesh) this.skyMesh.position.copy(this.camera.position);
    this.renderer.render(this.scene, this.camera);
  }

  private clearGroup(g: THREE.Group) {
    while (g.children.length) {
      const ch = g.children[0]!;
      g.remove(ch);
      ch.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat) (mat as THREE.Material).dispose();
      });
    }
  }

  dispose() {
    this.clearGroup(this.trackRoot);
    this.clearGroup(this.envRoot);
    this.vfx.dispose();
    this.renderer.dispose();
    for (const d of this.disposables) d.dispose();
    for (const t of this.textures) t.dispose();
    this.car.mats.forEach((m) => m.dispose());
    this.ghost.mats.forEach((m) => m.dispose());
    if (this.skyMesh) {
      this.skyMesh.geometry.dispose();
      (this.skyMesh.material as THREE.Material).dispose();
    }
  }
}

function _lookMat(fwd: THREE.Vector3, up: THREE.Vector3) {
  const m = new THREE.Matrix4();
  const x = new THREE.Vector3().crossVectors(up, fwd);
  if (x.lengthSq() < 1e-8) x.set(1, 0, 0);
  x.normalize();
  const y = new THREE.Vector3().crossVectors(fwd, x).normalize();
  m.makeBasis(x, y, fwd.clone().normalize());
  return m;
}
