import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { BuiltTrack, CameraMode, CarSnap, GhostFrame, ThemeId } from "./types";
import { buildTrackMeshes, nearestSample, sampleAt } from "./track";
import { makeCar, type CarRig } from "./car";
import { applyGroundMaterial, buildEnvironment } from "./env";
import { bakeSkyEnvironment, SkyDome } from "./sky";
import { Vfx } from "./vfx";
import { PostFx } from "./postfx";
import type { Settings } from "./settings";
import {
  applyGraphicsKnobs,
  fogWindow,
  isOnCurb,
  QUALITY_PRESETS,
  resolveQuality,
  SETTINGS_TIER_COST,
  themeLightLevels,
  type GraphicsKnobs,
  type QualityProfile,
  type QualityTier,
} from "./quality";
import { camBoostPull, camFollowRate, camFovTarget, camFwdRate, camLandDrop, camLookAhead } from "./feel";

const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _look = new THREE.Vector3();
const _right = new THREE.Vector3();
const _camUpTarget = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);

type ThemePack = {
  fog: number;
  ground: number;
  hemiSky: number;
  hemiGround: number;
  sun: number;
  sunPos: [number, number, number];
  exposure: number;
  sky: string;
  skyTint: number;
};

const _snapCam = new THREE.Vector3();
const _snapLook = new THREE.Vector3();
const _snapFwd = new THREE.Vector3();
const _snapUp = new THREE.Vector3();
const _snapRight = new THREE.Vector3();

/** Chase/hood snap pose used by World.snapCamera — exported so respawn tests
 *  can prove Helix post-CP R keeps the camera above the ribbon on portrait. */
export function chaseSnapPlacement(
  snap: CarSnap,
  track: BuiltTrack | null,
  mode: CameraMode,
  aspect: number,
  chaseDistance = 1,
): { cam: THREE.Vector3; look: THREE.Vector3 } {
  const helixSnap = track?.def.id === "helix";
  _snapFwd.set(snap.fx, 0, snap.fz);
  if (_snapFwd.lengthSq() < 1e-6) _snapFwd.set(snap.fx, snap.fy, snap.fz);
  if (_snapFwd.lengthSq() < 1e-8) _snapFwd.set(0, 0, -1);
  else _snapFwd.normalize();
  _snapUp.copy(_worldUp);
  _snapRight.crossVectors(_snapUp, _snapFwd);
  if (_snapRight.lengthSq() < 1e-8) _snapRight.set(1, 0, 0);
  _snapRight.normalize();
  _snapUp.crossVectors(_snapFwd, _snapRight).normalize();

  const portrait = aspect > 0 && aspect < 0.72;
  const hood = mode === "hood";
  let lift = hood ? (portrait ? 1.4 : 1.18) : portrait ? (helixSnap ? 4.35 : 3.7) : helixSnap ? 3.8 : 2.55;
  let dist = hood ? 0.52 : ((helixSnap ? 4.6 : 6.8) + (portrait ? 0.35 : 0)) * chaseDistance;
  // Helix only: pre-CP R sits near the start. A 7m chase pull-back walks
  // through the finish seam and reads as under-geo at night.
  if (helixSnap && !hood && snap.s < dist + 6) {
    dist = Math.min(dist, Math.max(2.6, snap.s * 0.4));
    lift += 1.4;
  }
  _snapCam.set(
    snap.px - _snapFwd.x * dist + _snapUp.x * lift,
    Math.max(snap.py + (hood ? 1.05 : helixSnap ? 2.4 : 1.8), snap.py - _snapFwd.y * dist + _snapUp.y * lift),
    snap.pz - _snapFwd.z * dist + _snapUp.z * lift,
  );
  _snapLook.set(snap.px + _snapFwd.x * 12, snap.py + 0.7, snap.pz + _snapFwd.z * 12);
  return { cam: _snapCam, look: _snapLook };
}

export function clearChaseCamera(
  camPos: THREE.Vector3,
  snap: CarSnap,
  track: BuiltTrack | null,
  mode: CameraMode,
) {
  const helix = track?.def.id === "helix";
  const steep = THREE.MathUtils.clamp(1 - snap.uy, 0, 1);
  const minAboveCar = (mode === "hood" ? 0.95 : 2.05) + steep * (helix ? 0.25 : 1.15);
  camPos.y = Math.max(camPos.y, snap.py + minAboveCar);
  if (!track) return;

  const liftAlong = (ux: number, uy: number, uz: number, x: number, y: number, z: number, floor: number) => {
    if (helix && uy < 0.55) {
      camPos.y = Math.max(camPos.y, y + floor, snap.py + minAboveCar);
      return;
    }
    const height = (camPos.x - x) * ux + (camPos.y - y) * uy + (camPos.z - z) * uz;
    if (height >= floor) return;
    const push = floor - height;
    if (helix) {
      camPos.x += ux * push;
      camPos.y += uy * push;
      camPos.z += uz * push;
    } else {
      camPos.x += ux * push * 0.2;
      camPos.y += push;
      camPos.z += uz * push * 0.2;
    }
  };

  const road = sampleAt(track, snap.s);
  const roadFloor = (mode === "hood" ? 1.1 : 2.25) + steep * (helix ? 0.35 : 1.35);
  liftAlong(road.ux, road.uy, road.uz, road.x, road.y, road.z, roadFloor);

  const near = helix
    ? nearestSample(track, camPos.x, camPos.y, camPos.z, snap.s, {
        // Post-CP1 island sits under the loop in XZ. A wide wrap window
        // grabs the invert and pushes chase through the ribbon.
        noWrap: snap.s < 40 || (snap.s > 115 && snap.s < 190),
        minUy: 0.7,
        maxDs: 32,
        window: 36,
      })
    : nearestSample(track, camPos.x, camPos.y, camPos.z, snap.s);
  const nearFloor = mode === "hood" ? 0.9 : 1.75;
  liftAlong(near.ux, near.uy, near.uz, near.x, near.y, near.z, nearFloor);

  camPos.y = Math.max(
    camPos.y,
    snap.py + minAboveCar,
    road.y + (helix ? 2.6 : mode === "hood" ? 1.15 : 1.7),
    near.y + (helix && near.uy < 0.7 ? 0 : helix ? 2.2 : mode === "hood" ? 0.95 : 1.45),
  );
  if (helix && near.y > snap.py + 2.2 && near.uy > 0.7) {
    const horiz = Math.hypot(camPos.x - near.x, camPos.z - near.z);
    if (horiz < near.width * 0.7 + 5) camPos.y = Math.max(camPos.y, near.y + 2.4);
  }
  // Helix Night only: world-Y floor wins over any inverted-normal push so
  // R cannot leave the chase cam under the ribbon looking up at chevrons.
  if (helix) {
    camPos.y = Math.max(camPos.y, snap.py + (mode === "hood" ? 1.05 : 2.6), road.y + 2.6);
  }
}

const THEMES: Record<ThemeId, ThemePack> = {
  stadium: {
    fog: 0x9ec4e6,
    ground: 0x6ea05a,
    hemiSky: 0xc4dcf0,
    hemiGround: 0x8a9a6a,
    sun: 0xfff6e8,
    sunPos: [90, 110, 28],
    exposure: 1.06,
    sky: "/textures/sky-stadium.jpg",
    skyTint: 0xf4f7fb,
  },
  canyon: {
    fog: 0xd49268,
    ground: 0x8a4e2e,
    hemiSky: 0xffc090,
    hemiGround: 0x4a2818,
    sun: 0xffb070,
    sunPos: [-90, 22, 48],
    exposure: 1.06,
    sky: "/textures/sky-canyon.jpg",
    skyTint: 0xffe4cc,
  },
  night: {
    fog: 0x2c2848,
    ground: 0x1c1828,
    hemiSky: 0x7a6ab0,
    hemiGround: 0x4a3860,
    sun: 0xc8b8ff,
    sunPos: [20, 80, -40],
    exposure: 1.24,
    sky: "/textures/sky-night.jpg",
    skyTint: 0xe6dcff,
  },
};

export class World {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(62, 1, 0.28, 900);
  renderer: THREE.WebGLRenderer;
  private trackRoot = new THREE.Group();
  private envRoot = new THREE.Group();
  private car: CarRig;
  private ghost: CarRig;
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private fill: THREE.DirectionalLight;
  private fill2: THREE.DirectionalLight;
  private sky: SkyDome | null = null;
  private ground: THREE.Mesh;
  private vfx = new Vfx();
  private post: PostFx;
  private quality: QualityProfile = resolveQuality();
  private pmrem: THREE.PMREMGenerator | null = null;
  private roomEnvRT: THREE.WebGLRenderTarget | null = null;
  private skyEnvRT: THREE.WebGLRenderTarget | null = null;
  private skyTex: THREE.Texture | null = null;
  private viewW = 800;
  private viewH = 600;
  private disposables: { dispose: () => void }[] = [];
  private textures: THREE.Texture[] = [];
  private camPos = new THREE.Vector3(0, 8, 16);
  private lookPos = new THREE.Vector3();
  private camFwd = new THREE.Vector3(0, 0, -1);
  private camUp = new THREE.Vector3(0, 1, 0);
  trauma = 0;
  private camHold = 0;
  private clockT = 0;
  private loader = new THREE.TextureLoader();
  private nightLights: THREE.Object3D[] = [];
  private theme: ThemeId = "stadium";
  private builtTrack: BuiltTrack | null = null;
  private fogBase = { near: 80, far: 440 };
  private fogNearMul = 1;
  private fogFarMul = 1;
  private fogOn = true;
  private dprCap = 2;
  private camDistance = 1;
  private camFov = 58;
  private camShake = 1;
  private ghostOpacity = 0.46;
  private cameraFar = 900;
  private knobs: GraphicsKnobs | null = null;
  private landJuice = 0;
  private boostJuice = 0;
  private wasAir = false;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
    });
    this.viewW = canvas.clientWidth || 800;
    this.viewH = canvas.clientHeight || 600;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality.pixelRatioCap));
    this.renderer.setSize(this.viewW, this.viewH, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = this.quality.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene.background = new THREE.Color(0x8eb8dc);
    this.scene.fog = new THREE.Fog(0x8eb8dc, 80, 400);

    this.hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a9a6a, 0.75);
    this.sun = new THREE.DirectionalLight(0xfff4e0, 1.45);
    this.sun.position.set(80, 120, 40);
    this.fill = new THREE.DirectionalLight(0x8ab4d8, 0);
    this.fill.position.set(12, -42, 18);
    this.fill.castShadow = false;
    this.fill2 = new THREE.DirectionalLight(0xb8c8dc, 0);
    this.fill2.position.set(-22, 36, -14);
    this.fill2.castShadow = false;
    this.sun.castShadow = this.quality.shadows;
    this.sun.shadow.mapSize.set(this.quality.shadowMap, this.quality.shadowMap);
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 280;
    this.sun.shadow.camera.left = -70;
    this.sun.shadow.camera.right = 70;
    this.sun.shadow.camera.top = 70;
    this.sun.shadow.camera.bottom = -70;
    this.sun.shadow.bias = -0.00028;
    this.sun.shadow.normalBias = 0.028;
    this.scene.add(this.hemi, this.sun, this.sun.target, this.fill, this.fill.target, this.fill2, this.fill2.target);

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
    this.post = new PostFx(this.renderer, this.scene, this.camera);
    this.disposables.push(groundGeo, this.ground.material as THREE.Material);
    this.vfx.setQuality(this.quality);
    this.applyEnvironmentMap();
  }

  private currentKnobs(): GraphicsKnobs {
    return {
      quality: this.quality.tier,
      shadows: this.quality.shadows,
      bloom: this.quality.bloom,
      particleDensity: this.knobs?.particleDensity,
      dprCap: this.dprCap,
      fogNearMul: this.fogNearMul,
      fogFarMul: this.fogFarMul,
      cameraFar: this.cameraFar,
      fogEnabled: this.fogOn,
    };
  }

  private patchKnobs(partial: Partial<GraphicsKnobs>) {
    this.applySettings({ ...this.currentKnobs(), ...partial });
  }

  applySettings(s: Settings | GraphicsKnobs) {
    const cost = SETTINGS_TIER_COST[s.quality];
    const full = s as Settings;
    const extra = s as GraphicsKnobs;
    this.knobs = {
      quality: s.quality,
      shadows: s.shadows,
      bloom: s.bloom,
      particleDensity: extra.particleDensity ?? cost.particleDensity,
      dprCap: extra.dprCap ?? cost.dprCap,
      fogNearMul: extra.fogNearMul ?? cost.fogNearMul,
      fogFarMul: extra.fogFarMul ?? cost.fogFarMul,
      cameraFar: extra.cameraFar ?? cost.cameraFar,
      fogEnabled: extra.fogEnabled !== false,
    };
    this.quality = applyGraphicsKnobs(QUALITY_PRESETS[s.quality], this.knobs);
    this.fogNearMul = this.knobs.fogNearMul ?? 1;
    this.fogFarMul = this.knobs.fogFarMul ?? 1;
    this.fogOn = this.knobs.fogEnabled !== false;
    this.dprCap = this.knobs.dprCap ?? 2;
    this.cameraFar = this.knobs.cameraFar ?? 900;
    if (typeof full.chaseDistance === "number") this.camDistance = full.chaseDistance;
    if (typeof full.fov === "number") this.camFov = full.fov;
    if (typeof full.cameraShake === "number") this.camShake = full.cameraShake;
    if (typeof full.ghostOpacity === "number" && this.ghostOpacity !== full.ghostOpacity) {
      this.ghostOpacity = full.ghostOpacity;
      this.ghost.setOpacity(full.ghostOpacity);
    }
    this.vfx.setQuality(this.quality);
    this.vfx.density = this.knobs.particleDensity ?? this.quality.sparkScale;
    this.renderer.shadowMap.enabled = s.shadows;
    this.sun.castShadow = s.shadows;
    if (this.sun.shadow.mapSize.x !== this.quality.shadowMap) {
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
      this.sun.shadow.mapSize.set(this.quality.shadowMap, this.quality.shadowMap);
    }
    this.applyFog();
    this.post.configure(s.bloom, "motionBlur" in s ? Boolean(full.motionBlur) : false);
    this.tuneBloom(this.theme);
    this.applyEnvironmentMap();
    if (this.builtTrack) this.applyThemeLights(this.theme);
    const parent = this.renderer.domElement.parentElement || this.renderer.domElement;
    const r = parent.getBoundingClientRect();
    this.resize(Math.max(1, r.width), Math.max(1, r.height));
  }

  setQuality(tier: QualityTier) {
    const cost = SETTINGS_TIER_COST[tier];
    this.patchKnobs({
      quality: tier,
      shadows: QUALITY_PRESETS[tier].shadows,
      bloom: QUALITY_PRESETS[tier].bloom,
      particleDensity: cost.particleDensity,
      dprCap: cost.dprCap,
      fogNearMul: cost.fogNearMul,
      fogFarMul: cost.fogFarMul,
      cameraFar: cost.cameraFar,
    });
  }

  setShadows(on: boolean) {
    this.patchKnobs({ shadows: on });
  }

  setBloom(on: boolean) {
    this.patchKnobs({ bloom: on });
  }

  setFogEnabled(on: boolean) {
    this.patchKnobs({ fogEnabled: on });
  }

  /** Day themes only. Helix Night stays 88/460. */
  setFogDensity(nearMul: number, farMul = nearMul) {
    this.patchKnobs({
      fogEnabled: true,
      fogNearMul: Math.max(0.2, nearMul),
      fogFarMul: Math.max(0.2, farMul),
    });
  }

  setPixelRatioCap(cap: number) {
    this.patchKnobs({ dprCap: Math.max(0.75, Math.min(2.5, cap)) });
  }

  get shadows() {
    return this.quality.shadows;
  }

  get bloom() {
    return this.quality.bloom;
  }

  get fogEnabled() {
    return this.fogOn;
  }

  get pixelRatioCap() {
    return this.quality.pixelRatioCap;
  }

  getGraphics() {
    const fog = this.scene.fog as THREE.Fog;
    return {
      quality: this.quality.tier,
      shadows: this.quality.shadows,
      bloom: this.quality.bloom,
      dprCap: this.dprCap,
      pixelRatioCap: this.quality.pixelRatioCap,
      particleDensity: this.knobs?.particleDensity ?? this.quality.sparkScale,
      fogEnabled: this.fogOn,
      fogNearMul: this.fogNearMul,
      fogFarMul: this.fogFarMul,
      fogNear: fog?.near ?? 80,
      fogFar: fog?.far ?? 440,
    };
  }

  resize(w: number, h: number) {
    if (w < 1 || h < 1) return;
    this.viewW = w;
    this.viewH = h;
    const dpr = Math.min(window.devicePixelRatio || 1, this.dprCap);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.far = this.theme === "night" ? 900 : this.cameraFar;
    this.camera.updateProjectionMatrix();
    this.post.setSize(w, h, dpr);
  }

  private applyFog() {
    const fog = this.scene.fog as THREE.Fog | null;
    if (!fog) return;
    const win = fogWindow(this.theme, {
      fogNearMul: this.fogNearMul,
      fogFarMul: this.fogFarMul,
      fogEnabled: this.fogOn,
    });
    fog.near = win.near;
    fog.far = win.far;
    this.camera.far = this.theme === "night" ? 900 : this.cameraFar;
    this.camera.updateProjectionMatrix();
  }

  loadTrack(track: BuiltTrack, theme: ThemeId) {
    this.builtTrack = track;
    this.theme = theme;
    this.clearGroup(this.trackRoot);
    this.clearGroup(this.envRoot);
    for (const o of this.nightLights) this.scene.remove(o);
    this.nightLights = [];
    this.vfx.resetSkids();

    const pack = THEMES[theme];
    this.scene.background = new THREE.Color(pack.fog);
    (this.scene.fog as THREE.Fog).color.set(pack.fog);
    this.fogBase.near = theme === "night" ? 88 : 80;
    this.fogBase.far = theme === "night" ? 460 : 440;
    this.applyFog();
    this.applyThemeLights(theme);
    this.tuneBloom(theme);
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
    this.applyThemeLights(theme);
    this.car.setTheme(theme);
    this.ghost.setTheme(theme);
    this.car.setHeadlights(theme === "night");
    this.vfx.setTheme(theme);
    this.loadSky(pack.sky, pack.fog, pack.skyTint);

    const start = sampleAt(track, 6);
    this.camFwd.set(start.tx, start.ty, start.tz).normalize();
    if (this.camFwd.lengthSq() < 1e-6) this.camFwd.set(0, 0, -1);
    this.camUp.copy(_worldUp);
    this.camPos.set(start.x - start.tx * 10 + start.ux * 4, start.y + 4, start.z - start.tz * 10 + start.uz * 4);
    this.lookPos.set(start.x, start.y + 1, start.z);
    this.camera.position.copy(this.camPos);
    this.camera.up.copy(_worldUp);
    this.camera.lookAt(this.lookPos);
  }

  snapCamera(snap: CarSnap, mode: CameraMode) {
    this.trauma = 0;
    this.landJuice = 0;
    this.boostJuice = 0;
    this.wasAir = false;
    const helixSnap = this.builtTrack?.def.id === "helix";
    // Circuit keeps the #9 hold. Helix Night needs a longer snap so chase
    // cannot walk under the ribbon on the same frame as R.
    this.camHold = helixSnap ? 0.9 : 0.55;
    _fwd.set(snap.fx, 0, snap.fz);
    if (_fwd.lengthSq() < 1e-6) _fwd.set(snap.fx, snap.fy, snap.fz);
    if (_fwd.lengthSq() < 1e-8) _fwd.set(0, 0, -1);
    else _fwd.normalize();
    this.camFwd.copy(_fwd);
    this.camUp.copy(_worldUp);
    _right.crossVectors(this.camUp, this.camFwd);
    if (_right.lengthSq() < 1e-8) _right.set(1, 0, 0);
    _right.normalize();
    this.camUp.crossVectors(this.camFwd, _right).normalize();

    const portrait = this.camera.aspect > 0 && this.camera.aspect < 0.72;
    const pose = chaseSnapPlacement(snap, this.builtTrack, mode, this.camera.aspect, this.camDistance);
    this.camPos.copy(pose.cam);
    this.lookPos.copy(pose.look);
    this.keepCameraClear(snap, this.builtTrack, mode);
    this.camera.position.copy(this.camPos);
    this.camera.up.copy(_worldUp);
    if (helixSnap) this.camUp.copy(_worldUp);
    this.camera.lookAt(this.lookPos);
    this.camera.fov = portrait ? this.camFov + 2 : this.camFov;
    this.camera.updateProjectionMatrix();
  }

  private keepCameraClear(snap: CarSnap, track: BuiltTrack | null, mode: CameraMode) {
    clearChaseCamera(this.camPos, snap, track, mode);
  }

  private loadSky(url: string, fog: number, tint: number) {
    if (this.sky) {
      this.scene.remove(this.sky.mesh);
      this.sky.dispose();
      this.sky = null;
    }
    this.skyEnvRT?.dispose();
    this.skyEnvRT = null;
    this.skyTex = null;
    this.sky = new SkyDome(fog, tint);
    this.scene.add(this.sky.mesh);
    this.loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 6;
        this.skyTex = tex;
        this.sky?.setMap(tex);
        this.textures.push(tex);
        this.bakeSkyEnv(tex);
      },
      undefined,
      () => {
        this.applyEnvironmentMap();
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
    if (snap.justLand) {
      this.landJuice = 1;
      this.vfx.emitLand(snap, true);
    } else if (this.wasAir && !snap.airborne) {
      this.landJuice = Math.max(this.landJuice, 0.55);
      this.vfx.emitLand(snap, false);
    }
    if (snap.justTurbo) {
      this.boostJuice = 1;
      this.vfx.emitTurbo(snap);
    }
    if (snap.justBoost) {
      this.boostJuice = Math.max(this.boostJuice, 0.78);
      this.vfx.emitBoostBurst(snap);
    }
    this.wasAir = snap.airborne;
    this.landJuice = Math.max(0, this.landJuice - dt * 3.4);
    this.boostJuice = Math.max(0, this.boostJuice - dt * 2.5);
    this.car.applyPose(steer, snap.speed, snap.slide, snap.airborne, dt, this.landJuice, this.boostJuice);
    this.car.setBrakeLights(brake > 0.2);
    this.car.setBoostVisual(
      Math.max(snap.boost > 0.05 ? 0.7 + snap.boost * 0.5 : 0, snap.driftCharge * 0.4, this.boostJuice * 0.85),
    );
    const width = this.builtTrack ? sampleAt(this.builtTrack, snap.s).width : 12;
    const curb = isOnCurb(snap.n, width, snap.airborne);
    if (snap.boost > 0.05) this.vfx.emitTrail(snap, 9);
    if (snap.boost > 0.05 || snap.slide > 0.4 || snap.airborne) {
      this.vfx.emitSparks(snap, snap.boost > 0.05 ? 9 : snap.slide > 0.5 ? 4 : 2, snap.boost > 0.05);
    }
    if (curb && Math.abs(snap.speed) > 6) this.vfx.emitCurbSparks(snap);
    if (snap.slide > 0.32 && Math.abs(snap.speed) > 8 && !snap.airborne) this.vfx.emitSmoke(snap, 4);
    this.vfx.skid(snap, snap.slide > 0.35 && Math.abs(snap.speed) > 8);
  }

  applyGhost(track: BuiltTrack, frames: GhostFrame[] | null, time: number) {
    if (!frames || frames.length < 2 || this.ghostOpacity <= 0.01) {
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
    steer = 0,
  ) {
    this.clockT += dt;
    if (attract && track) {
      const sm = sampleAt(track, attractS);
      _desired.set(sm.x + sm.ux * 8 - sm.tx * 16, sm.y + 6.5, sm.z + sm.uz * 8 - sm.tz * 16);
      _look.set(sm.x, sm.y + 1.1, sm.z);
      const k = 1 - Math.exp(-1.4 * dt);
      this.camPos.lerp(_desired, k);
      this.lookPos.lerp(_look, k);
      this.camUp.copy(_worldUp);
      this.camera.position.copy(this.camPos);
      this.camera.up.copy(_worldUp);
      this.camera.lookAt(this.lookPos);
      this.camera.fov += (this.camFov - 2 - this.camera.fov) * (1 - Math.exp(-3 * dt));
      this.camera.updateProjectionMatrix();
      return;
    }

    this.camHold = Math.max(0, this.camHold - dt);
    if (this.camHold > 0) {
      this.camera.position.copy(this.camPos);
      this.camera.up.copy(_worldUp);
      this.camera.lookAt(this.lookPos);
      return;
    }

    const helix = track?.def.id === "helix";
    _fwd.set(snap.fx, snap.fy, snap.fz);
    if (_fwd.lengthSq() < 1e-8) _fwd.set(0, 0, -1);
    else _fwd.normalize();
    if (mode !== "hood") {
      _fwd.y *= helix ? 0.12 : 0.03;
      if (_fwd.lengthSq() < 1e-6) _fwd.set(snap.fx, 0, snap.fz);
      if (_fwd.lengthSq() < 1e-8) _fwd.set(0, 0, -1);
      else _fwd.normalize();
    } else if (!helix || snap.uy > 0.55) {
      _fwd.y = 0;
      if (_fwd.lengthSq() < 1e-6) _fwd.set(snap.fx, 0, snap.fz);
      if (_fwd.lengthSq() < 1e-8) _fwd.set(0, 0, -1);
      else _fwd.normalize();
    }
    _up.set(snap.ux, snap.uy, snap.uz);
    if (_up.lengthSq() < 1e-8) _up.copy(_worldUp);
    else _up.normalize();

    const upDot = THREE.MathUtils.clamp(_up.dot(_worldUp), -1, 1);
    const rollAmt = helix
      ? mode === "hood"
        ? snap.airborne
          ? 0.06
          : 0.1
        : snap.airborne
          ? 0.04
          : snap.uy > 0.55
            ? 0.08
            : THREE.MathUtils.clamp(0.12 + upDot * 0.1, 0.04, 0.18)
      : snap.airborne
        ? 0.03
        : 0.045;
    _camUpTarget.set(
      _worldUp.x + (_up.x - _worldUp.x) * rollAmt,
      _worldUp.y + (_up.y - _worldUp.y) * rollAmt,
      _worldUp.z + (_up.z - _worldUp.z) * rollAmt,
    );
    if (_camUpTarget.lengthSq() < 1e-8) _camUpTarget.copy(_worldUp);
    _camUpTarget.normalize();

    const steerAbs = Math.abs(steer);
    const fwdK = 1 - Math.exp(-camFwdRate(steerAbs, Math.abs(snap.heading), snap.airborne) * dt);
    const upK = 1 - Math.exp(-(snap.airborne ? 2.6 : 5.4) * dt);
    this.camFwd.lerp(_fwd, fwdK);
    if (this.camFwd.lengthSq() < 1e-8) this.camFwd.copy(_fwd);
    else this.camFwd.normalize();
    this.camUp.lerp(_camUpTarget, upK);
    if (this.camUp.lengthSq() < 1e-8) this.camUp.copy(_worldUp);
    else this.camUp.normalize();

    _right.crossVectors(this.camUp, this.camFwd);
    if (_right.lengthSq() < 1e-8) _right.set(1, 0, 0);
    _right.normalize();

    const spd = Math.abs(snap.speed);
    const steep = THREE.MathUtils.clamp(1 - snap.uy, 0, 1);
    const portrait = this.camera.aspect > 0 && this.camera.aspect < 0.72;
    const landDrop = camLandDrop(this.landJuice);
    const boostPull = camBoostPull(snap.boost);
    if (mode === "hood") {
      const back = 0.42 + (!helix ? steep * 0.55 : 0);
      const lift = 1.2 + steep * (helix ? 0.35 : 0.95);
      _desired.set(snap.px - _fwd.x * back, snap.py + lift, snap.pz - _fwd.z * back);
      _look.set(snap.px + _fwd.x * 16, snap.py + 0.38 + steep * 0.15 - landDrop, snap.pz + _fwd.z * 16);
    } else {
      const dist =
        (6.5 +
          spd * 0.02 +
          (snap.airborne ? 1.15 : 0) +
          (helix ? -steep * 0.5 : steep * 1.2) +
          boostPull +
          (portrait ? 0.4 : 0) +
          snap.slide * 0.35) *
        this.camDistance;
      const height =
        2.3 + spd * 0.01 + (snap.airborne ? 1.2 : 0) + steep * (helix ? 1.5 : 2.8) + (portrait ? 0.5 : 0) + landDrop * 0.35;
      const lean = -snap.heading * (snap.airborne ? 0.16 : helix ? 0.28 : 0.22 + snap.slide * 0.12);
      // Flats (including every R recovery) use world-up like Circuit. Only ride
      // helix cam-up through a real invert — otherwise chase dives under-geo.
      const helixInvert = helix && snap.uy < 0.55;
      const upx = helixInvert ? this.camUp.x : 0;
      const upy = helixInvert ? this.camUp.y : 1;
      const upz = helixInvert ? this.camUp.z : 0;
      _desired.set(
        snap.px - this.camFwd.x * dist + upx * height + _right.x * lean,
        snap.py - (helixInvert ? this.camFwd.y * dist : 0) + upy * height,
        snap.pz - this.camFwd.z * dist + upz * height + _right.z * lean,
      );
      const lookDist = camLookAhead(spd, snap.boost, snap.airborne);
      _look.set(
        snap.px + this.camFwd.x * lookDist,
        snap.py + 0.55 - (snap.airborne ? 0.7 : 0) + (!helix ? steep * 0.25 : 0) - landDrop,
        snap.pz + this.camFwd.z * lookDist,
      );
    }
    const follow = camFollowRate(snap.airborne, mode === "hood", snap.boost);
    const k = 1 - Math.exp(-follow * dt);
    this.camPos.lerp(_desired, k);
    this.lookPos.lerp(_look, k);
    this.keepCameraClear(snap, track, mode);

    this.trauma = Math.max(0, this.trauma - dt * 2.5);
    const shake = reduced ? 0 : this.trauma * this.trauma * 0.5 * this.camShake;
    this.camera.position.copy(this.camPos);
    this.camera.position.x += shake * Math.sin(this.clockT * 37) * 0.14;
    this.camera.position.y += shake * Math.cos(this.clockT * 29) * 0.1;
    this.camera.up.lerp(this.camUp, 1 - Math.exp(-7 * dt));
    if (!helix && this.camera.up.y < 0.82) {
      this.camera.up.lerp(_worldUp, 0.85);
      this.camUp.lerp(_worldUp, 0.85);
    } else if (helix && snap.uy > 0.55) {
      this.camera.up.lerp(_worldUp, 0.75);
      this.camUp.lerp(_worldUp, 0.75);
    } else if (this.camera.up.y < 0.55) {
      this.camera.up.lerp(_worldUp, 0.65);
      this.camUp.lerp(_worldUp, 0.65);
    }
    this.camera.lookAt(this.lookPos);

    const targetFov = camFovTarget(this.camFov, spd, snap.boost, this.landJuice);
    this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-4.2 * dt));
    this.camera.updateProjectionMatrix();
    this.sun.target.position.set(snap.px, snap.py, snap.pz);
    this.sun.position.set(snap.px + 60, snap.py + 95, snap.pz + 36);
    this.sun.shadow.camera.updateProjectionMatrix();
    if (this.fill.intensity > 0) {
      this.fill.target.position.set(snap.px, snap.py, snap.pz);
      this.fill.position.set(snap.px + 10, snap.py - 36, snap.pz + 16);
    }
    if (this.fill2.intensity > 0) {
      this.fill2.target.position.set(snap.px, snap.py, snap.pz);
      this.fill2.position.set(snap.px - 20, snap.py + 32, snap.pz - 12);
    }
  }

  addTrauma(v: number) {
    this.trauma = Math.min(1, this.trauma + v);
  }

  stepParticles(dt: number) {
    this.vfx.step(dt);
  }

  render() {
    if (this.sky) this.sky.mesh.position.copy(this.camera.position);
    this.post.render();
  }

  private applyThemeLights(theme: ThemeId) {
    const pack = THEMES[theme];
    const look = themeLightLevels(theme, this.quality);
    this.hemi.color.set(pack.hemiSky);
    this.hemi.groundColor.set(pack.hemiGround);
    this.sun.color.set(pack.sun);
    this.sun.position.set(...pack.sunPos);
    this.sun.target.position.set(0, 0, 0);
    this.sun.intensity = look.sun;
    this.hemi.intensity = look.hemi;
    this.renderer.toneMappingExposure = look.exposure;
    this.scene.environmentIntensity = look.env;
    const nightFill = theme === "night" && this.quality.nightFills;
    this.fill.color.set(theme === "night" ? 0xb878d8 : 0x8ab4d8);
    this.fill.intensity = nightFill ? 0.5 : 0;
    this.fill.position.set(12, -42, 18);
    this.fill.target.position.set(0, 0, 0);
    this.fill2.color.set(theme === "night" ? 0xe890c8 : 0xb8c8dc);
    this.fill2.intensity = nightFill ? 0.28 : 0;
    this.fill2.position.set(-22, 36, -14);
    this.fill2.target.position.set(0, 0, 0);
    for (const o of this.nightLights) {
      const pl = o as THREE.PointLight;
      if (pl.isPointLight) pl.visible = this.quality.nightFills || theme !== "night";
    }
  }

  private bakeSkyEnv(tex: THREE.Texture) {
    if (!this.quality.environment) return;
    if (!this.pmrem) this.pmrem = new THREE.PMREMGenerator(this.renderer);
    const rt = bakeSkyEnvironment(this.pmrem, tex);
    this.skyEnvRT?.dispose();
    this.skyEnvRT = rt;
    this.scene.environment = rt.texture;
  }

  private applyEnvironmentMap() {
    if (!this.quality.environment) {
      this.scene.environment = null;
      return;
    }
    if (!this.pmrem) this.pmrem = new THREE.PMREMGenerator(this.renderer);
    if (!this.skyEnvRT && this.skyTex) {
      this.bakeSkyEnv(this.skyTex);
      return;
    }
    if (this.skyEnvRT) {
      this.scene.environment = this.skyEnvRT.texture;
      return;
    }
    if (!this.roomEnvRT) {
      const room = new RoomEnvironment();
      this.roomEnvRT = this.pmrem.fromScene(room, 0.04);
      room.dispose();
    }
    this.scene.environment = this.roomEnvRT.texture;
  }

  private tuneBloom(theme: ThemeId) {
    const look = themeLightLevels(theme, this.quality);
    this.post.tuneBloom(
      this.quality.bloomStrength * look.bloomMul,
      this.quality.bloomRadius,
      look.bloomThreshold,
    );
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
    this.post.dispose();
    this.skyEnvRT?.dispose();
    this.roomEnvRT?.dispose();
    this.pmrem?.dispose();
    this.renderer.dispose();
    for (const d of this.disposables) d.dispose();
    for (const t of this.textures) t.dispose();
    this.car.mats.forEach((m) => m.dispose());
    this.ghost.mats.forEach((m) => m.dispose());
    this.sky?.dispose();
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
