import * as THREE from "three";
import type { BuiltTrack, CarSnap, SurfaceKind, ThemeId } from "./types.ts";
import { sampleAt } from "./track.ts";
import { GATE_LOOK } from "./presentation.ts";
import { roadSurfaceTint, surfaceAlbedoBase, themeDefaultSurface } from "./look.ts";
import type { QualityProfile, QualityTier } from "./quality.ts";

/** Seconds before a skid decal fully fades out. */
export const SKID_MAX_AGE = 38;

const SKID_CAP_MAX = 320;

/** Longest gap (m) a skid decal will bridge; beyond this (respawn/teleport) a stub is placed. */
export const SKID_MAX_SEGMENT = 1.5;
/** Stub length (m) for the first point of a skid or after an unbridged gap. */
export const SKID_MIN_SEGMENT = 0.15;
/** Extra length (m) so consecutive segments overlap without seams. */
export const SKID_SEGMENT_OVERLAP = 0.05;
/** Skid plane is 1 m long (local Z) so instance scale.z is the world length in metres. */
export const SKID_PLANE_LENGTH = 1;
/** Skid plane base width (m, local X); instance scale.x multiplies it (unchanged look). */
export const SKID_PLANE_WIDTH = 0.52;
const FINISH_BURST_MAX = 96;

const _pos = new THREE.Vector3();
const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);
const _color = new THREE.Color();
const _skidRgba: [number, number, number, number] = [1, 1, 1, 0];
const _sample = {
  x: 0,
  y: 0,
  z: 0,
  tx: 0,
  ty: 0,
  tz: 0,
  ux: 0,
  uy: 1,
  uz: 0,
  rx: 0,
  ry: 0,
  rz: 0,
  width: 12,
  s: 0,
  boost: false,
  checkpoint: false,
  surface: "plastic" as SurfaceKind,
};

export function skidRingIndex(head: number, cap: number): number {
  if (cap <= 0) return 0;
  const h = head % cap;
  return h < 0 ? h + cap : h;
}

/**
 * World length (m) of a skid segment decal covering `dist` metres of travel.
 * Gaps beyond `cap` (respawn, teleport) or invalid distances give the `minLen` stub.
 */
export function skidSegmentLength(dist: number, cap: number, minLen: number, overlap: number): number {
  if (!Number.isFinite(dist) || dist < 0 || dist > cap) return minLen;
  return Math.max(minLen, dist + overlap);
}

/** True when a gap of `dist` metres should be bridged by one stretched decal. */
export function skidShouldBridge(dist: number, cap: number): boolean {
  return Number.isFinite(dist) && dist >= 0 && dist <= cap;
}

/**
 * Writes a skid decal instance matrix into `out`: centred at (cx, cy, cz), yawed so local +Z
 * points along (dirX, dirZ), `length` metres long and `widthScale` × SKID_PLANE_WIDTH wide.
 * Allocation-free (module scratch only).
 */
export function composeSkidDecalMatrix(
  out: THREE.Matrix4,
  cx: number,
  cy: number,
  cz: number,
  dirX: number,
  dirZ: number,
  length: number,
  widthScale: number,
): THREE.Matrix4 {
  _up.set(0, 1, 0);
  _quat.setFromAxisAngle(_up, Math.atan2(dirX, dirZ));
  _scale.set(widthScale, 1, length / SKID_PLANE_LENGTH);
  return out.compose(_pos.set(cx, cy, cz), _quat, _scale);
}

/** Shared skid decal geometry: flat plane, SKID_PLANE_WIDTH × SKID_PLANE_LENGTH, length on Z. */
export function createSkidDecalGeometry(): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(SKID_PLANE_WIDTH, SKID_PLANE_LENGTH);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/** Ease-out fade for skid decal alpha (0 = fresh, maxAge = gone). */
export function skidFadeAlpha(age: number, maxAge: number): number {
  if (!Number.isFinite(age) || age <= 0) return 1;
  if (age >= maxAge) return 0;
  const t = age / maxAge;
  const eased = t * t * (3 - 2 * t);
  return 1 - eased;
}

/** Multiply-blend instance colour: dark tint at fade=1, white (no mark) at fade=0. */
export function skidFadeTintColor(tintHex: number, strength: number, fade: number): number {
  const f = Math.max(0, Math.min(1, fade));
  const inv = 1 - f;
  const r0 = ((tintHex >> 16) & 255) / 255;
  const g0 = ((tintHex >> 8) & 255) / 255;
  const b0 = (tintHex & 255) / 255;
  const rOut = r0 * strength + (1 - r0 * strength) * inv;
  const gOut = g0 * strength + (1 - g0 * strength) * inv;
  const bOut = b0 * strength + (1 - b0 * strength) * inv;
  return (
    (Math.round(rOut * 255) << 16) | (Math.round(gOut * 255) << 8) | Math.round(bOut * 255)
  );
}

export function skidSurfaceTint(surface: SurfaceKind, night: boolean): number {
  switch (surface) {
    case "dirt":
      return night ? 0x3a3028 : 0x5a4838;
    case "ice":
      return night ? 0x8898a8 : 0xc8d8e8;
    case "tech":
      return night ? 0x283038 : 0x404850;
    default:
      return night ? 0x1a1c22 : 0x121318;
  }
}

/** 0 = off/minimal, 1 = full race VFX density. */
export function raceVfxDensity(tier: QualityTier): number {
  if (tier === "low") return 0;
  if (tier === "medium") return 0.55;
  return 1;
}

export function gateFlashPulse(elapsed: number, duration: number): number {
  if (duration <= 0 || elapsed < 0) return 0;
  const t = Math.min(1, elapsed / duration);
  const attack = Math.min(1, t / 0.12);
  const decay = 1 - (t - 0.12) / 0.88;
  return Math.max(0, attack * decay);
}

export type GateLookColors = {
  post: number;
  emissive: number;
  rim: number;
  emissiveBase: number;
};

export function gateLookForTheme(theme: ThemeId, finish: boolean): GateLookColors {
  const night = theme === "night";
  const works = theme === "works";
  const grove = theme === "grove";
  const mesa = theme === "mesa";
  const ember = theme === "ember";
  const storm = theme === "storm";
  const postCol = finish
    ? night
      ? 0xe8e4ff
      : works
        ? 0xffd0a0
        : grove
          ? 0xd8f4e0
          : mesa
            ? 0xffe8c0
            : ember
              ? 0xffd0a0
              : storm
                ? 0xd8eaf4
                : GATE_LOOK.startPost
    : night
      ? GATE_LOOK.cpNight
      : works
        ? 0x4ee8d4
        : grove
          ? 0x7ee090
          : mesa
            ? 0xffc050
            : ember
              ? 0xff7a30
              : storm
                ? 0x7ec8e8
                : GATE_LOOK.cpDay;
  const emit = finish
    ? GATE_LOOK.startEmissive
    : night
      ? GATE_LOOK.cpEmissiveNight
      : works
        ? 0x1aa890
        : grove
          ? 0x2a8850
          : mesa
            ? 0xc46a18
            : ember
              ? 0xc04010
              : storm
                ? 0x2a6088
                : GATE_LOOK.cpEmissiveDay;
  const rim = night
    ? 0x5ee8ff
    : works
      ? 0x4ee8d4
      : grove
        ? 0x7ee090
        : mesa
          ? 0xffc050
          : finish
            ? 0xc4a574
            : 0x3a80d0;
  const emissiveBase = finish ? (night ? 0.7 : 0.42) : night ? 1.15 : 0.85;
  return { post: postCol, emissive: emit, rim, emissiveBase };
}

type GateRef = {
  s: number;
  finish: boolean;
  group: THREE.Group;
  stdMats: THREE.MeshStandardMaterial[];
  rimMat: THREE.MeshBasicMaterial | null;
  rimColorOrig: number;
  rimOpacityOrig: number;
  look: GateLookColors;
  flashT: number;
};

type BoostRef = {
  s: number;
  pad: THREE.Mesh;
  chevrons: THREE.Mesh[];
  scroll: number;
};

type BurstSlot = {
  life: number;
  px: number;
  py: number;
  pz: number;
  vx: number;
  vy: number;
  vz: number;
};

/** Per-instance alpha attribute read by the skid material. */
export const SKID_ALPHA_ATTR = "skidAlpha";

/**
 * Skid decal material (all themes): plain alpha blend (SRC_ALPHA,
 * ONE_MINUS_SRC_ALPHA, no premultiply) of a per-theme target colour over the
 * road, with a per-instance alpha (SKID_ALPHA_ATTR) for strength and fade.
 * Alpha 0 = no change (faded out). Fog on so distant marks fog with the road;
 * tone-mapped like any surface; every target sits far below the bloom threshold.
 * Replaces the old Multiply (light roads) and Additive (dark roads) pair: both
 * were lerps toward a fixed colour that ignored High's grade (see skidMarkColorLinear).
 */
export function createSkidDecalMaterial(): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 1,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>\nattribute float ${SKID_ALPHA_ATTR};\nvarying float vSkidAlpha;`,
      )
      .replace("#include <begin_vertex>", `#include <begin_vertex>\nvSkidAlpha = ${SKID_ALPHA_ATTR};`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vSkidAlpha;")
      .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.a *= vSkidAlpha;");
  };
  mat.customProgramCacheKey = () => "rushline-skid-decal";
  return mat;
}

/**
 * darken: light roads; lerp toward the screen black point (a "multiply" that
 *   respects High's grade). tone: dark roads; lerp toward a mid-dark rubber tone.
 */
export type SkidMarkMode = "darken" | "tone";

/** Road lightness (CIE L* / 100) below which skids switch to the rubber tone. */
export const SKID_TONE_ROAD_L = 0.12;

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** CIE L* / 100 for a linear-light luminance Y. */
export function lightnessFromLinearY(y: number): number {
  const l = y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y;
  return l / 100;
}

function linearY(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Linear-light base colour of a theme's default road ribbon: canvas albedo
 * (surfaceAlbedoBase, sRGB) times the ribbon vertex tint (roadSurfaceTint, linear).
 * Writes [r, g, b] into `out`.
 */
export function skidRoadBaseLinear(theme: ThemeId, out: [number, number, number]): [number, number, number] {
  const surface = themeDefaultSurface(theme);
  const base = surfaceAlbedoBase(surface, theme);
  const tint = roadSurfaceTint(theme, surface);
  out[0] = srgbToLinear(base[0] / 255) * tint.r;
  out[1] = srgbToLinear(base[1] / 255) * tint.g;
  out[2] = srgbToLinear(base[2] / 255) * tint.b;
  return out;
}

/** Lightness (L* / 100) of a theme's default road albedo. */
export function skidRoadLightness(theme: ThemeId): number {
  const c = skidRoadBaseLinear(theme, [0, 0, 0]);
  return lightnessFromLinearY(linearY(c[0], c[1], c[2]));
}

/** Dark roads (Ridge, Helix, Black Hollow, Storm Dock, Works, Ember) use the rubber tone. */
export function skidMarkMode(theme: ThemeId): SkidMarkMode {
  return skidRoadLightness(theme) < SKID_TONE_ROAD_L ? "tone" : "darken";
}

/**
 * Light roads, High (graded): linear pre-post level where the theme's grade
 * (contrast about 0.5 in linear light) + ACES first lifts off black, +5%.
 * The grade crushes everything below it, which is why a plain linear multiply
 * (56f222dc, ≈×0.14) rendered (3,4,4) on Green's (34,36,43). Just above this
 * point the screen is ~linear in (level − black point), so lerping toward it
 * with alpha a leaves ≈ (1 − a) of the road's on-screen brightness.
 * Direct path (Low/Medium, no composer): the blend runs on the sRGB-encoded
 * framebuffer, the black point is 0, and the on-screen ratio is exactly 1 − a.
 */
export const SKID_BLACK_POINT: Record<ThemeId, number> = {
  stadium: 0.024,
  alpine: 0.027,
  mesa: 0.0305,
  // Dark themes use SKID_TONE; listed for completeness.
  canyon: 0.0345,
  storm: 0.035,
  night: 0.038,
  grove: 0.0305,
  works: 0.033,
  ember: 0.037,
};

/** Fresh-mark alpha on light roads: ~30% of the road left on screen (High captures, Green). */
export const SKID_DARKEN_ALPHA = { weak: 0.62, strong: 0.68 } as const;

/**
 * Rubber tone (sRGB hex; linear ≈ 0.045–0.075) per dark theme, drawn at alpha 1
 * when fresh. Cool roads (Storm, Grove) sit just above the High grade's black
 * point, so a mark is a dim scuff on unlit asphalt yet a near-black stroke over
 * sheen, headlight or sun patches; warm dusk roads (Ridge, Works, Ember) keep the
 * lighter grey scuff QA passed on Ridge. Helix (night) uses the same warm-grey
 * scuff: its old cool 0x3d3d41 landed on the grade's black point and rendered
 * blue-violet (4,5,18) on the (10,6,1) road (dL −0.008, QA on 150d3e2e); the
 * warmer, lighter tone cancels the grade's violet tint and reads as a grey
 * scuff above the road, still far below bloom.
 */
export const SKID_TONE: Record<ThemeId, number> = {
  // Light themes use SKID_BLACK_POINT; these are only a fallback.
  stadium: 0x3c3d40,
  alpine: 0x3c3d40,
  mesa: 0x3c3d40,
  storm: 0x3c3d40,
  night: 0x4a4846,
  grove: 0x393a39,
  canyon: 0x4d4a47,
  works: 0x4a4744,
  ember: 0x48443f,
};

/** Per-surface hue (sRGB hex, ≤ white) applied to the mark's target colour. */
export function skidMarkBaseColor(surface: SurfaceKind): number {
  switch (surface) {
    case "dirt":
      return 0xfff0dc;
    case "tech":
      return 0xf4f8ff;
    default:
      return 0xffffff;
  }
}

/**
 * Linear instance colour + alpha for a skid decal, written into `out` (no allocation).
 * darken: rgb = black point (High) or 0 (direct) · hue; alpha = a(strength) · fade,
 *   ice ×0.6 (lighter marks).
 * tone: rgb = theme rubber tone · hue (ice ×1.5); alpha = fade.
 * fade 0 → alpha 0 → road untouched. `strength` is 0.55 + driftCharge·0.25.
 */
export function skidMarkColorLinear(
  out: [number, number, number, number],
  mode: SkidMarkMode,
  theme: ThemeId,
  surface: SurfaceKind,
  strength: number,
  fade: number,
  graded: boolean,
): [number, number, number, number] {
  const f = Math.max(0, Math.min(1, fade));
  const sNorm = Math.max(0, Math.min(1, (strength - 0.55) / 0.25));
  const hue = skidMarkBaseColor(surface);
  const hr = srgbToLinear(((hue >> 16) & 255) / 255);
  const hg = srgbToLinear(((hue >> 8) & 255) / 255);
  const hb = srgbToLinear((hue & 255) / 255);
  const ice = surface === "ice";
  if (mode === "tone") {
    const t = SKID_TONE[theme];
    const k = ice ? 1.5 : 1;
    out[0] = srgbToLinear(((t >> 16) & 255) / 255) * hr * k;
    out[1] = srgbToLinear(((t >> 8) & 255) / 255) * hg * k;
    out[2] = srgbToLinear((t & 255) / 255) * hb * k;
    out[3] = f;
    return out;
  }
  const bp = graded ? SKID_BLACK_POINT[theme] : 0;
  out[0] = bp * hr;
  out[1] = bp * hg;
  out[2] = bp * hb;
  const a = SKID_DARKEN_ALPHA.weak + (SKID_DARKEN_ALPHA.strong - SKID_DARKEN_ALPHA.weak) * sNorm;
  out[3] = a * (ice ? 0.6 : 1) * f;
  return out;
}

/** three requires premultipliedAlpha for Multiply/Subtractive blending. */
export function blendingNeedsPremultipliedAlpha(blending: THREE.Blending): boolean {
  return blending === THREE.MultiplyBlending || blending === THREE.SubtractiveBlending;
}

export class RaceVfx {
  root = new THREE.Group();
  private skidMesh: THREE.InstancedMesh | null = null;
  private skidCap = 0;
  private skidHead = 0;
  private skidAge = new Float32Array(0);
  private skidStrength = new Float32Array(0);
  private skidSurface: SurfaceKind[] = [];
  private skidAlpha: THREE.InstancedBufferAttribute | null = null;
  /** High's composer + grade path (see SKID_BLACK_POINT). */
  private skidGraded = false;
  private skidLive = 0;
  private skidMode: SkidMarkMode = "darken";
  private skidMat: THREE.MeshBasicMaterial | null = null;
  /** Previous skid point (preallocated; valid only while hasLastSkid). */
  private readonly lastSkid = new THREE.Vector3();
  private hasLastSkid = false;
  private density = 1;
  private theme: ThemeId = "stadium";
  private track: BuiltTrack | null = null;
  private gates: GateRef[] = [];
  private boosts: BoostRef[] = [];
  private finishGate: GateRef | null = null;
  private burstPos: Float32Array = new Float32Array(0);
  private burstVel: Float32Array = new Float32Array(0);
  private burstLife: Float32Array = new Float32Array(0);
  private burstCap = 0;
  private burstPoints: THREE.Points | null = null;
  private burstMat: THREE.PointsMaterial | null = null;
  private clock = 0;
  private disposables: THREE.Material[] = [];
  private geos: THREE.BufferGeometry[] = [];

  setQuality(profile: QualityProfile, particleDensity?: number) {
    const tierDensity = raceVfxDensity(profile.tier);
    const mul = particleDensity ?? profile.sparkScale;
    this.density = tierDensity * mul;
    this.skidGraded = profile.grade === true;
    const cap =
      this.density <= 0.02
        ? 0
        : Math.max(24, Math.floor(SKID_CAP_MAX * this.density * (0.45 + profile.sparkScale * 0.55)));
    this.ensureSkidPool(cap);
    const burstCap =
      this.density <= 0.02 ? 0 : Math.max(12, Math.floor(FINISH_BURST_MAX * this.density));
    this.ensureBurstPool(burstCap);
    if (this.burstPoints) this.burstPoints.visible = burstCap > 0;
  }

  setTheme(theme: ThemeId) {
    this.theme = theme;
    this.syncSkidMode();
    for (const g of this.gates) {
      g.look = gateLookForTheme(theme, g.finish);
    }
    if (this.finishGate) this.finishGate.look = gateLookForTheme(theme, true);
    this.syncBoostColors();
  }

  bindTrack(track: BuiltTrack, theme: ThemeId) {
    this.track = track;
    this.theme = theme;
    this.syncSkidMode();
    this.clearGates();
    this.clearBoosts();
    this.resetRun();
  }

  /** Per-run VFX reset without tearing down gate / boost registrations. */
  resetRun() {
    this.clearMarks();
    this.resetGateFlash();
    this.resetBoostScroll();
  }

  registerGate(s: number, finish: boolean, group: THREE.Group, mats: THREE.Material[]) {
    const stdMats: THREE.MeshStandardMaterial[] = [];
    let rimMat: THREE.MeshBasicMaterial | null = null;
    for (const m of mats) {
      if (m instanceof THREE.MeshStandardMaterial) stdMats.push(m);
      if (m instanceof THREE.MeshBasicMaterial && m.transparent) rimMat = m;
    }
    const ref: GateRef = {
      s,
      finish,
      group,
      stdMats,
      rimMat,
      rimColorOrig: rimMat ? rimMat.color.getHex() : 0xffffff,
      rimOpacityOrig: rimMat ? rimMat.opacity : 1,
      look: gateLookForTheme(this.theme, finish),
      flashT: -1,
    };
    this.gates.push(ref);
    if (finish) this.finishGate = ref;
  }

  registerBoostPad(s: number, pad: THREE.Mesh, chevrons: THREE.Mesh[]) {
    this.boosts.push({ s, pad, chevrons, scroll: 0 });
  }

  clearMarks() {
    this.skidHead = 0;
    this.skidLive = 0;
    this.hasLastSkid = false;
    if (this.skidMesh) {
      this.skidMesh.count = 0;
      for (let i = 0; i < this.skidCap; i++) this.skidAge[i] = -1;
    }
    for (let i = 0; i < this.burstCap; i++) this.burstLife[i] = 0;
    if (this.burstPoints) {
      (this.burstPoints.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  skid(snap: CarSnap, active: boolean) {
    if (!this.skidMesh || this.skidCap <= 0 || this.density < 0.08) {
      this.hasLastSkid = false;
      return;
    }
    if (!active || snap.airborne) {
      this.hasLastSkid = false;
      return;
    }
    const x = snap.px - snap.fx * 0.62;
    const y = snap.py + snap.uy * 0.02 - 0.34;
    const z = snap.pz - snap.fz * 0.62;
    if (this.hasLastSkid) {
      const dx = x - this.lastSkid.x;
      const dz = z - this.lastSkid.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 0.035) return;
      const dist = Math.sqrt(d2);
      if (skidShouldBridge(dist, SKID_MAX_SEGMENT)) {
        // Stretch from the previous point to this one, centred on the midpoint.
        this.placeSkidDecal(
          (x + this.lastSkid.x) * 0.5,
          (y + this.lastSkid.y) * 0.5,
          (z + this.lastSkid.z) * 0.5,
          dx,
          dz,
          skidSegmentLength(dist, SKID_MAX_SEGMENT, SKID_MIN_SEGMENT, SKID_SEGMENT_OVERLAP),
          snap,
        );
      } else {
        this.placeSkidStub(x, y, z, snap);
      }
    } else {
      this.placeSkidStub(x, y, z, snap);
    }
    this.lastSkid.set(x, y, z);
    this.hasLastSkid = true;
  }

  onTimingGate(playerS: number, kind: "cp" | "lap" | "finish") {
    if (this.density <= 0.02) return;
    const gate = this.pickGate(playerS, kind === "finish");
    if (!gate) return;
    gate.flashT = this.clock;
    if (kind === "finish") this.spawnFinishBurst(gate.group.position);
  }

  step(dt: number) {
    this.clock += dt;
    this.stepSkidFade(dt);
    this.stepGateFlash(dt);
    this.stepBoostPads(dt);
    this.stepFinishBurst(dt);
  }

  dispose() {
    for (const g of this.geos) g.dispose();
    for (const m of this.disposables) m.dispose();
    this.skidMesh = null;
    this.burstPoints = null;
  }

  private ensureSkidPool(cap: number) {
    if (cap === this.skidCap) return;
    if (this.skidMesh) {
      this.root.remove(this.skidMesh);
      this.skidMesh.geometry.dispose();
      this.skidMat?.dispose();
      this.skidMat = null;
      this.skidAlpha = null;
    }
    this.skidCap = cap;
    this.skidHead = 0;
    this.skidLive = 0;
    this.hasLastSkid = false;
    if (cap <= 0) {
      this.skidMesh = null;
      this.skidAge = new Float32Array(0);
      this.skidStrength = new Float32Array(0);
      this.skidSurface = [];
      return;
    }
    this.skidAge = new Float32Array(cap);
    this.skidStrength = new Float32Array(cap);
    this.skidSurface = new Array<SurfaceKind>(cap).fill("plastic");
    for (let i = 0; i < cap; i++) this.skidAge[i] = -1;
    const geo = createSkidDecalGeometry();
    const alpha = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
    alpha.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute(SKID_ALPHA_ATTR, alpha);
    this.skidAlpha = alpha;
    // One skid material per pool for every theme; setTheme only changes instance colours.
    const mat = createSkidDecalMaterial();
    this.skidMat = mat;
    this.skidMode = skidMarkMode(this.theme);
    this.skidMesh = new THREE.InstancedMesh(geo, mat, cap);
    this.skidMesh.frustumCulled = false;
    this.skidMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.skidMesh.count = 0;
    this.root.add(this.skidMesh);
    this.geos.push(geo);
    this.disposables.push(mat);
  }

  /** Pick darken vs rubber tone for the current theme; clears marks if the mode flips. */
  private syncSkidMode() {
    const mode = skidMarkMode(this.theme);
    if (mode === this.skidMode) return;
    this.skidMode = mode;
    if (this.skidMesh) this.clearMarks();
  }

  private ensureBurstPool(cap: number) {
    if (cap === this.burstCap) return;
    if (this.burstPoints) {
      this.root.remove(this.burstPoints);
      this.burstPoints.geometry.dispose();
      this.burstMat?.dispose();
    }
    this.burstCap = cap;
    if (cap <= 0) {
      this.burstPoints = null;
      this.burstMat = null;
      this.burstPos = new Float32Array(0);
      this.burstVel = new Float32Array(0);
      this.burstLife = new Float32Array(0);
      return;
    }
    this.burstPos = new Float32Array(cap * 3);
    this.burstVel = new Float32Array(cap * 3);
    this.burstLife = new Float32Array(cap);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.burstPos, 3));
    this.burstMat = new THREE.PointsMaterial({
      color: 0xffe8a8,
      size: 0.38,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.burstPoints = new THREE.Points(geo, this.burstMat);
    this.burstPoints.frustumCulled = false;
    this.root.add(this.burstPoints);
    this.geos.push(geo);
    this.disposables.push(this.burstMat);
  }

  /** Minimum-length stub at a point (first point of a skid, or an unbridged gap). */
  private placeSkidStub(x: number, y: number, z: number, snap: CarSnap) {
    _fwd.set(snap.fx, 0, snap.fz);
    if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, 1);
    this.placeSkidDecal(x, y, z, _fwd.x, _fwd.z, SKID_MIN_SEGMENT, snap);
  }

  private placeSkidDecal(
    x: number,
    y: number,
    z: number,
    dirX: number,
    dirZ: number,
    length: number,
    snap: CarSnap,
  ) {
    const idx = skidRingIndex(this.skidHead, this.skidCap);
    this.skidHead++;
    this.skidLive = Math.min(this.skidCap, this.skidLive + 1);
    this.skidAge[idx] = 0;
    this.skidStrength[idx] = 0.55 + snap.driftCharge * 0.25;
    this.skidSurface[idx] = snap.surface;
    const width = 0.42 + snap.driftCharge * 0.18;
    composeSkidDecalMatrix(_mat4, x, y, z, dirX, dirZ, length, width);
    this.skidMesh!.setMatrixAt(idx, _mat4);
    this.writeSkidColor(idx, 1);
    this.skidMesh!.count = Math.max(this.skidMesh!.count, idx + 1);
    this.skidMesh!.instanceMatrix.needsUpdate = true;
    if (this.skidMesh!.instanceColor) this.skidMesh!.instanceColor.needsUpdate = true;
    if (this.skidAlpha) this.skidAlpha.needsUpdate = true;
  }

  private stepSkidFade(dt: number) {
    if (!this.skidMesh || this.skidCap <= 0) return;
    let any = false;
    const mesh = this.skidMesh;
    for (let i = 0; i < this.skidCap; i++) {
      let age = this.skidAge[i]!;
      if (age < 0) continue;
      age += dt;
      this.skidAge[i] = age;
      const fade = skidFadeAlpha(age, SKID_MAX_AGE);
      if (fade <= 0.01) {
        this.skidAge[i] = -1;
        if (this.skidAlpha) this.skidAlpha.setX(i, 0);
        _quat.set(0, 0, 0, 1);
        _scale.set(0, 0, 0);
        _mat4.compose(_pos.set(0, -999, 0), _quat, _scale);
        mesh.setMatrixAt(i, _mat4);
        any = true;
        continue;
      }
      this.writeSkidColor(i, fade);
      any = true;
    }
    if (any && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (any && this.skidAlpha) this.skidAlpha.needsUpdate = true;
    if (any) mesh.instanceMatrix.needsUpdate = true;
  }

  /** Instance colour + alpha for slot `i` at `fade` (allocation-free). */
  private writeSkidColor(i: number, fade: number) {
    const c = skidMarkColorLinear(
      _skidRgba,
      this.skidMode,
      this.theme,
      this.skidSurface[i] ?? "plastic",
      this.skidStrength[i]!,
      fade,
      this.skidGraded,
    );
    this.skidMesh!.setColorAt(i, _color.setRGB(c[0], c[1], c[2], THREE.LinearSRGBColorSpace));
    if (this.skidAlpha) this.skidAlpha.setX(i, c[3]);
  }

  private stepGateFlash(dt: number) {
    const duration = 0.55;
    for (const g of this.gates) {
      if (g.flashT < 0) continue;
      const elapsed = this.clock - g.flashT;
      const pulse = gateFlashPulse(elapsed, duration);
      if (pulse <= 0.001) {
        g.flashT = -1;
        for (const m of g.stdMats) {
          m.emissiveIntensity = g.look.emissiveBase;
          m.emissive.setHex(g.look.emissive);
        }
        if (g.rimMat) {
          g.rimMat.color.setHex(g.rimColorOrig);
          g.rimMat.opacity = g.rimOpacityOrig;
        }
        continue;
      }
      const boost = 1 + pulse * (g.finish ? 1.8 : 1.35);
      for (const m of g.stdMats) {
        m.emissive.setHex(g.look.emissive);
        m.emissiveIntensity = g.look.emissiveBase * boost;
      }
      if (g.rimMat) {
        g.rimMat.color.setHex(g.look.rim);
        g.rimMat.opacity = Math.min(1, g.rimOpacityOrig + pulse * 0.28);
      }
    }
  }

  private stepBoostPads(dt: number) {
    if (this.density <= 0.08 || !this.boosts.length) return;
    const shimmer = 0.42 + Math.sin(this.clock * 4.2) * 0.18;
    const scrollSpeed = 2.8 * this.density;
    for (const b of this.boosts) {
      b.scroll = (b.scroll + dt * scrollSpeed) % 3;
      const padMat = b.pad.material as THREE.MeshStandardMaterial;
      padMat.emissiveIntensity = 0.45 + shimmer * 0.35 * this.density;
      padMat.opacity = 0.32 + shimmer * 0.14;
      for (let k = 0; k < b.chevrons.length; k++) {
        const ch = b.chevrons[k]!;
        const mat = ch.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 1.1 + shimmer * 0.65;
        if (!this.track) continue;
        const sm = sampleAt(this.track, b.s, _sample);
        const along = (k - 1) * 1.15 - b.scroll * 0.55;
        ch.position.set(
          sm.x + sm.tx * along + sm.ux * 0.05,
          sm.y + sm.ty * along + sm.uy * 0.05,
          sm.z + sm.tz * along + sm.uz * 0.05,
        );
      }
    }
  }

  private syncBoostColors() {
    const night = this.theme === "night";
    const works = this.theme === "works";
    const grove = this.theme === "grove";
    const ember = this.theme === "ember";
    const storm = this.theme === "storm";
    for (const b of this.boosts) {
      const padMat = b.pad.material as THREE.MeshStandardMaterial;
      padMat.color.setHex(night ? 0x3a80c8 : ember ? 0xc05018 : 0xc9a44a);
      padMat.emissive.setHex(
        night ? 0x1a4a88 : works ? 0x0a6058 : ember ? 0x801808 : storm ? 0x184060 : 0x6a4a10,
      );
      for (const ch of b.chevrons) {
        const mat = ch.material as THREE.MeshStandardMaterial;
        mat.color.setHex(
          night ? 0x6ec8ff : works ? 0x4ee8d4 : grove ? 0x7ee8a0 : ember ? 0xff7a30 : storm ? 0x7ec8e8 : 0xe8c56a,
        );
        mat.emissive.setHex(
          night ? 0x3a8cff : works ? 0x1aa890 : grove ? 0x2a8850 : ember ? 0xc04010 : storm ? 0x2a6088 : 0xc9a44a,
        );
      }
    }
  }

  private spawnFinishBurst(origin: THREE.Vector3) {
    if (!this.burstPoints || this.burstCap <= 0 || this.density < 0.12) return;
    const n = Math.floor(24 + 40 * this.density);
    for (let i = 0; i < n; i++) {
      const slot = this.pickBurstSlot();
      this.burstLife[slot] = 0.55 + Math.random() * 0.35;
      const a = Math.random() * Math.PI * 2;
      const pitch = (Math.random() - 0.5) * 0.8;
      const spd = 4 + Math.random() * 9;
      this.burstPos[slot * 3] = origin.x + (Math.random() - 0.5) * 2.4;
      this.burstPos[slot * 3 + 1] = origin.y + 1.2 + Math.random() * 1.6;
      this.burstPos[slot * 3 + 2] = origin.z + (Math.random() - 0.5) * 2.4;
      this.burstVel[slot * 3] = Math.cos(a) * Math.cos(pitch) * spd;
      this.burstVel[slot * 3 + 1] = 2.5 + Math.random() * 5.5;
      this.burstVel[slot * 3 + 2] = Math.sin(a) * Math.cos(pitch) * spd;
    }
    (this.burstPoints.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    if (this.burstMat) {
      const look = gateLookForTheme(this.theme, true);
      this.burstMat.color.setHex(look.rim);
    }
  }

  private stepFinishBurst(dt: number) {
    if (!this.burstPoints || this.burstCap <= 0) return;
    let live = 0;
    for (let i = 0; i < this.burstCap; i++) {
      let life = this.burstLife[i]!;
      if (life <= 0) continue;
      life -= dt;
      this.burstLife[i] = life;
      if (life <= 0) continue;
      live++;
      this.burstPos[i * 3]! += this.burstVel[i * 3]! * dt;
      this.burstPos[i * 3 + 1]! += this.burstVel[i * 3 + 1]! * dt;
      this.burstPos[i * 3 + 2]! += this.burstVel[i * 3 + 2]! * dt;
      this.burstVel[i * 3 + 1]! -= 9.5 * dt;
    }
    if (live > 0) {
      (this.burstPoints.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
      if (this.burstMat) this.burstMat.opacity = Math.min(0.95, 0.35 + live / this.burstCap);
    }
  }

  private pickBurstSlot() {
    for (let i = 0; i < this.burstCap; i++) {
      if (this.burstLife[i]! <= 0) return i;
    }
    return Math.floor(Math.random() * this.burstCap);
  }

  private pickGate(playerS: number, finish: boolean): GateRef | null {
    if (finish && this.finishGate) return this.finishGate;
    let best: GateRef | null = null;
    let bestD = 1e9;
    for (const g of this.gates) {
      if (g.finish) continue;
      const d = Math.abs(g.s - playerS);
      if (d < bestD) {
        bestD = d;
        best = g;
      }
    }
    return bestD < 28 ? best : null;
  }

  private clearGates() {
    this.gates = [];
    this.finishGate = null;
  }

  private clearBoosts() {
    this.boosts = [];
  }

  private resetGateFlash() {
    for (const g of this.gates) {
      g.flashT = -1;
      for (const m of g.stdMats) {
        m.emissive.setHex(g.look.emissive);
        m.emissiveIntensity = g.look.emissiveBase;
      }
      if (g.rimMat) {
        g.rimMat.color.setHex(g.rimColorOrig);
        g.rimMat.opacity = g.rimOpacityOrig;
      }
    }
  }

  private resetBoostScroll() {
    for (const b of this.boosts) b.scroll = 0;
  }
}
