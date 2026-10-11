import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as THREE from "three";
import {
  SKID_MAX_AGE as SKID_FADE_SECONDS,
  SKID_BLACK_POINT,
  SKID_DARKEN_ALPHA,
  skidMarkColorLinear,
  skidMarkMode,
  SKID_ALPHA_ATTR,
  RaceVfx,
  SKID_MAX_SEGMENT,
  SKID_MIN_SEGMENT,
  SKID_SEGMENT_OVERLAP,
  blendingNeedsPremultipliedAlpha,
  composeSkidDecalMatrix,
  createSkidDecalGeometry,
  skidSegmentLength,
  skidShouldBridge,
  createSkidDecalMaterial,
  gateFlashPulse,
  gateLookForTheme,
  raceVfxDensity,
  skidFadeAlpha,
  skidFadeTintColor,
  skidRingIndex,
  skidSurfaceTint,
  SKID_MAX_AGE,
} from "./race-vfx.ts";
import { GATE_LOOK, GRADE } from "./presentation.ts";
import { QUALITY_PRESETS, themeLightLevels } from "./quality.ts";
import type { SurfaceKind, ThemeId } from "./types.ts";

describe("race vfx helpers", () => {
  it("wraps skid ring indices", () => {
    assert.equal(skidRingIndex(0, 64), 0);
    assert.equal(skidRingIndex(64, 64), 0);
    assert.equal(skidRingIndex(65, 64), 1);
    assert.equal(skidRingIndex(-1, 64), 63);
  });

  it("fades skids to zero at max age", () => {
    assert.equal(skidFadeAlpha(0, SKID_MAX_AGE), 1);
    assert.ok(skidFadeAlpha(SKID_MAX_AGE * 0.5, SKID_MAX_AGE) > 0.2);
    assert.equal(skidFadeAlpha(SKID_MAX_AGE, SKID_MAX_AGE), 0);
    assert.equal(skidFadeAlpha(SKID_MAX_AGE + 2, SKID_MAX_AGE), 0);
  });

  it("lerps multiply-blend skid colour toward white as fade drops", () => {
    const ice = skidSurfaceTint("ice", false);
    assert.equal(skidFadeTintColor(ice, 0.7, 0), 0xffffff);
    const fresh = skidFadeTintColor(ice, 0.7, 1);
    assert.ok(fresh < 0xffffff, "fresh mark darkens under multiply");
    const mid = skidFadeTintColor(ice, 0.7, 0.5);
    assert.ok(mid > fresh && mid < 0xffffff);
  });

  it("tints skid marks per surface", () => {
    assert.notEqual(skidSurfaceTint("plastic", false), skidSurfaceTint("dirt", false));
    assert.notEqual(skidSurfaceTint("ice", true), skidSurfaceTint("ice", false));
    assert.notEqual(skidSurfaceTint("tech", false), skidSurfaceTint("plastic", false));
  });

  it("maps quality tiers to race vfx density", () => {
    assert.equal(raceVfxDensity("low"), 0);
    assert.ok(raceVfxDensity("medium") > 0 && raceVfxDensity("medium") < 1);
    assert.equal(raceVfxDensity("high"), 1);
  });

  it("peaks gate flash pulse mid animation", () => {
    assert.equal(gateFlashPulse(-0.1, 0.55), 0);
    const mid = gateFlashPulse(0.2, 0.55);
    const end = gateFlashPulse(0.55, 0.55);
    assert.ok(mid > end);
    assert.ok(mid > 0.4);
    assert.equal(end, 0);
  });

  it("uses GATE_LOOK for stadium checkpoint day/night", () => {
    const day = gateLookForTheme("stadium", false);
    const night = gateLookForTheme("night", false);
    assert.equal(day.post, GATE_LOOK.cpDay);
    assert.equal(night.post, GATE_LOOK.cpNight);
    assert.equal(day.emissive, GATE_LOOK.cpEmissiveDay);
    assert.equal(night.emissive, GATE_LOOK.cpEmissiveNight);
    const start = gateLookForTheme("stadium", true);
    assert.equal(start.post, GATE_LOOK.startPost);
    assert.equal(start.emissive, GATE_LOOK.startEmissive);
  });
});

describe("race vfx materials", () => {
  it("skid decal uses plain alpha blending with fade-safe decal state", () => {
    const mat = createSkidDecalMaterial();
    assert.equal(mat.blending, THREE.NormalBlending);
    assert.equal(mat.premultipliedAlpha, false);
    assert.equal(mat.transparent, true);
    assert.equal(mat.opacity, 1);
    assert.equal(mat.depthWrite, false);
    assert.equal(mat.polygonOffset, true);
    assert.equal(mat.polygonOffsetFactor, -1);
    assert.equal(mat.polygonOffsetUnits, -4);
    mat.dispose();
  });

  it("every Multiply/Subtractive VFX material sets premultipliedAlpha", () => {
    const mats: THREE.Material[] = [createSkidDecalMaterial()];
    for (const m of mats) {
      if (blendingNeedsPremultipliedAlpha(m.blending)) assert.equal(m.premultipliedAlpha, true);
      m.dispose();
    }
    assert.equal(blendingNeedsPremultipliedAlpha(THREE.MultiplyBlending), true);
    assert.equal(blendingNeedsPremultipliedAlpha(THREE.SubtractiveBlending), true);
    assert.equal(blendingNeedsPremultipliedAlpha(THREE.AdditiveBlending), false);
    assert.equal(blendingNeedsPremultipliedAlpha(THREE.NormalBlending), false);
  });

  it("faded skid colour is white so premultiplied multiply leaves the road untouched", () => {
    assert.equal(skidFadeTintColor(0x202020, 0.7, 0), 0xffffff);
    assert.notEqual(skidFadeTintColor(0x202020, 0.7, 1), 0xffffff);
  });
});

describe("skid segment length", () => {
  it("30 m/s at 60 fps gives a ~0.55 m segment", () => {
    const len = skidSegmentLength(
      30 / 60,
      SKID_MAX_SEGMENT,
      SKID_MIN_SEGMENT,
      SKID_SEGMENT_OVERLAP,
    );
    assert.ok(Math.abs(len - 0.55) < 1e-9, `len=${len}`);
    assert.equal(skidShouldBridge(30 / 60, SKID_MAX_SEGMENT), true);
  });

  it("a gap over the cap gives the minimum stub and is not bridged", () => {
    const gap = SKID_MAX_SEGMENT + 0.01;
    assert.equal(
      skidSegmentLength(gap, SKID_MAX_SEGMENT, SKID_MIN_SEGMENT, SKID_SEGMENT_OVERLAP),
      SKID_MIN_SEGMENT,
    );
    assert.equal(
      skidSegmentLength(40, SKID_MAX_SEGMENT, SKID_MIN_SEGMENT, SKID_SEGMENT_OVERLAP),
      SKID_MIN_SEGMENT,
    );
    assert.equal(skidShouldBridge(gap, SKID_MAX_SEGMENT), false);
    assert.equal(
      skidSegmentLength(Number.NaN, SKID_MAX_SEGMENT, SKID_MIN_SEGMENT, SKID_SEGMENT_OVERLAP),
      SKID_MIN_SEGMENT,
    );
  });

  it("never shorter than the stub and caps at max + overlap", () => {
    assert.equal(
      skidSegmentLength(0.01, SKID_MAX_SEGMENT, SKID_MIN_SEGMENT, SKID_SEGMENT_OVERLAP),
      SKID_MIN_SEGMENT,
    );
    assert.ok(
      Math.abs(
        skidSegmentLength(
          SKID_MAX_SEGMENT,
          SKID_MAX_SEGMENT,
          SKID_MIN_SEGMENT,
          SKID_SEGMENT_OVERLAP,
        ) -
          (SKID_MAX_SEGMENT + SKID_SEGMENT_OVERLAP),
      ) < 1e-9,
    );
  });

  it("decal world length equals the helper length (no double scale) and width is unchanged", () => {
    const geo = createSkidDecalGeometry();
    const m = new THREE.Matrix4();
    const pos = geo.getAttribute("position");
    const v = new THREE.Vector3();
    const dir = new THREE.Vector3(3, 0, 4).normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    for (const widthScale of [0.42, 0.6]) {
      const len = skidSegmentLength(0.5, SKID_MAX_SEGMENT, SKID_MIN_SEGMENT, SKID_SEGMENT_OVERLAP);
      composeSkidDecalMatrix(m, 10, 2, -5, dir.x, dir.z, len, widthScale);
      let minA = Infinity,
        maxA = -Infinity,
        minW = Infinity,
        maxW = -Infinity;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i)
          .applyMatrix4(m)
          .sub(new THREE.Vector3(10, 2, -5));
        const a = v.dot(dir);
        const w = v.dot(side);
        minA = Math.min(minA, a);
        maxA = Math.max(maxA, a);
        minW = Math.min(minW, w);
        maxW = Math.max(maxW, w);
        assert.ok(Math.abs(v.y) < 1e-9);
      }
      assert.ok(Math.abs(maxA - minA - len) < 1e-6, `world length ${maxA - minA} vs ${len}`);
      assert.ok(Math.abs(maxA + minA) < 1e-6, "centred on the midpoint");
      assert.ok(Math.abs(maxW - minW - 0.52 * widthScale) < 1e-6, `width ${maxW - minW}`);
    }
    geo.dispose();
  });
});

/*
 * On-screen model of High's post chain (postfx.ts): linear HDR target →
 * GradeShader (contrast about 0.5 in linear, saturation, tint; vignette ignored =
 * frame centre) → OutputPass (three ACESFilmic with theme exposure, sRGB encode).
 * Road inputs are linear pre-post colours recovered from High 1280×720 captures
 * (inverting this same chain): they carry the real lighting, specular and fog.
 */
const ACES_IN = [
  [0.59719, 0.35458, 0.04823],
  [0.076, 0.90834, 0.01566],
  [0.0284, 0.13383, 0.83777],
];
const ACES_OUT = [
  [1.60475, -0.53108, -0.07367],
  [-0.10208, 1.10813, -0.00605],
  [-0.00327, -0.07276, 1.07602],
];
type V3 = [number, number, number];
const mul3 = (m: number[][], v: V3): V3 => [
  m[0]![0]! * v[0] + m[0]![1]! * v[1] + m[0]![2]! * v[2],
  m[1]![0]! * v[0] + m[1]![1]! * v[1] + m[1]![2]! * v[2],
  m[2]![0]! * v[0] + m[2]![1]! * v[1] + m[2]![2]! * v[2],
];
const rrt = (v: number) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);
const lumY = (c: V3) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** sRGB 0–255 on screen for a linear pre-post colour on High. */
function screenHigh(theme: ThemeId, c: V3): V3 {
  const g = GRADE[theme];
  const ends = Math.abs(lumY(c) - 0.5) * 2;
  let v = c.map((x) => x + ends * ((x - 0.5) * g.contrast + 0.5 - x)) as V3;
  const l = lumY(v);
  const tint = new THREE.Color(g.tint);
  v = [
    (l + (v[0] - l) * g.saturation) * tint.r,
    (l + (v[1] - l) * g.saturation) * tint.g,
    (l + (v[2] - l) * g.saturation) * tint.b,
  ];
  const exp = themeLightLevels(theme, QUALITY_PRESETS.high).exposure / 0.6;
  const t = mul3(ACES_OUT, mul3(ACES_IN, v.map((x) => x * exp) as V3).map(rrt) as V3);
  return t.map((x) => toSrgb(clamp01(x)) * 255) as V3;
}
const lumaSrgb = (s: V3) => 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
const lstar = (s: V3) => {
  const y = lumY(s.map((x) => toLin(x / 255)) as V3);
  return (y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y) / 100;
};

/** Road with a skid on top, linear pre-post (what the blend writes into the HDR target). */
function markedRoad(theme: ThemeId, road: V3, strength: number, fade: number, surface: SurfaceKind = "plastic"): V3 {
  const mode = skidMarkMode(theme);
  const c = skidMarkColorLinear([0, 0, 0, 0], mode, theme, surface, strength, fade, true);
  void mode;
  const a = c[3];
  return [road[0] * (1 - a) + c[0] * a, road[1] * (1 - a) + c[1] * a, road[2] * (1 - a) + c[2] * a];
}

/** Linear pre-post road colours recovered from High captures. */
const ROADS = {
  // Green Circuit asphalt, top-down / look-back (screen ≈ (34,36,43), (27,32,42), (37,41,50)).
  green: [
    [0.0556, 0.058, 0.0672],
    [0.048, 0.0537, 0.0666],
    [0.0587, 0.0638, 0.0763],
  ] as V3[],
  // Storm Dock: unlit asphalt (crushed to black on screen) and the wet sheen /
  // headlight patch where live shows crisp dark strokes (screen ≈ (89,102,113)).
  stormShade: [0.03, 0.031, 0.035] as V3,
  stormSun: [0.178, 0.179, 0.181] as V3,
  // Darker Green patches under marks in the 2nd capture (screen ≈ (23,22,26), (13,12,16)).
  greenDim: [
    [0.0446, 0.0435, 0.048],
    [0.0355, 0.0346, 0.0384],
  ] as V3[],
  // Ridge Drop dusk asphalt (screen ≈ (28,14,8)).
  ridge: [0.0563, 0.0453, 0.0414] as V3,
};
const FRESH_MIN = 0.55; // weakest fresh mark (driftCharge 0)
const FRESH_MAX = 0.8; // strongest (driftCharge 1)

describe("skid mark visibility on screen (High)", () => {
  const THEMES = ["stadium", "canyon", "night", "alpine", "works", "mesa", "grove", "ember", "storm"] as const;

  it("dark roads use the rubber tone, light roads darken toward the black point", () => {
    for (const theme of ["canyon", "night", "grove", "storm", "works", "ember"] as const)
      assert.equal(skidMarkMode(theme), "tone", theme);
    for (const theme of ["stadium", "alpine", "mesa"] as const) assert.equal(skidMarkMode(theme), "darken", theme);
  });

  it("black points match where each theme's grade + ACES first lifts off black", () => {
    for (const theme of THEMES) {
      let g = 0.08;
      while (g > 0 && lumaSrgb(screenHigh(theme, [g, g, g])) >= 0.5) g -= 0.0005;
      const bp = SKID_BLACK_POINT[theme];
      assert.ok(bp >= g && bp <= g * 1.12, `${theme}: table ${bp} vs model edge ${g.toFixed(4)}`);
    }
  });

  it("model reproduces the near-black Green mark QA measured on 56f222dc", () => {
    // 56f222dc's linear ×0.14 multiplier rendered (3,4,4) on (34,36,43).
    const road = ROADS.green[0]!;
    const s = screenHigh("stadium", road);
    assert.ok(Math.abs(s[0] - 34) < 1.5 && Math.abs(s[2] - 43) < 1.5, `road ${s.map(Math.round)}`);
    const old = screenHigh("stadium", road.map((x) => x * 0.14) as V3);
    assert.ok(Math.max(...old) < 6, `old mark ${old.map(Math.round)}`);
  });

  it("Green: a fresh mark reads ~30% of the road's on-screen brightness, never black", () => {
    for (const road of [...ROADS.green, ...ROADS.greenDim]) {
      const rs = screenHigh("stadium", road);
      for (const strength of [FRESH_MIN, 0.675, FRESH_MAX]) {
        const ms = screenHigh("stadium", markedRoad("stadium", road, strength, 1));
        const ratio = lumaSrgb(ms) / lumaSrgb(rs);
        assert.ok(ratio >= 0.2 && ratio <= 0.45, `road ${rs.map(Math.round)} mark ${ms.map(Math.round)} ratio ${ratio.toFixed(2)}`);
        if (lumaSrgb(rs) >= 30) assert.ok(Math.max(...ms) >= 8, `mark ${ms.map(Math.round)} is near-black`);
        const minDL = lumaSrgb(rs) >= 30 ? 0.07 : 0.02;
        assert.ok(lstar(rs) - lstar(ms) >= minDL, `contrast ${(lstar(rs) - lstar(ms)).toFixed(3)}`);
      }
      const mid = screenHigh("stadium", markedRoad("stadium", ROADS.green[0]!, 0.675, 1));
      const r0 = lumaSrgb(mid) / lumaSrgb(screenHigh("stadium", ROADS.green[0]!));
      assert.ok(r0 >= 0.25 && r0 <= 0.38, `reference ratio ${r0.toFixed(2)}`);
    }
  });

  it("Alpine and Mesa land in the same on-screen band on their own black points", () => {
    for (const theme of ["alpine", "mesa"] as const) {
      for (const k of [1.3, 1.8, 2.5, 4]) {
        const g = SKID_BLACK_POINT[theme] * k;
        const road: V3 = [g, g, g];
        const rs = screenHigh(theme, road);
        for (const strength of [FRESH_MIN, FRESH_MAX]) {
          const ms = screenHigh(theme, markedRoad(theme, road, strength, 1));
          const ratio = lumaSrgb(ms) / lumaSrgb(rs);
          assert.ok(ratio >= 0.18 && ratio <= 0.48, `${theme} road ${rs.map(Math.round)} mark ${ms.map(Math.round)} ratio ${ratio.toFixed(2)}`);
        }
      }
    }
  });

  it("Storm Dock: dim scuff on unlit asphalt, dark stroke on the sunlit / sheen patch", () => {
    for (const strength of [FRESH_MIN, FRESH_MAX]) {
      const shade = lstar(screenHigh("storm", markedRoad("storm", ROADS.stormShade, strength, 1))) -
        lstar(screenHigh("storm", ROADS.stormShade));
      // Live (multiply) measured +0.011 here; 56f222dc's additive +0.038.
      assert.ok(shade >= 0.025 && shade <= 0.08, `shade dL ${shade.toFixed(3)}`);
      const sunRoad = screenHigh("storm", ROADS.stormSun);
      const sunMark = screenHigh("storm", markedRoad("storm", ROADS.stormSun, strength, 1));
      const sun = lstar(sunMark) - lstar(sunRoad);
      // Live measured -0.42 (black strokes); 56f222dc was +0.10.
      assert.ok(sun <= -0.36, `sun dL ${sun.toFixed(3)} mark ${sunMark.map(Math.round)} on ${sunRoad.map(Math.round)}`);
    }
  });

  it("Ridge: keeps the passed lighter grey scuff (~+0.1) without glow", () => {
    const rs = screenHigh("canyon", ROADS.ridge);
    const ms = screenHigh("canyon", markedRoad("canyon", ROADS.ridge, FRESH_MAX, 1));
    const dl = lstar(ms) - lstar(rs);
    assert.ok(dl >= 0.07 && dl <= 0.2, `ridge dL ${dl.toFixed(3)} mark ${ms.map(Math.round)}`);
    assert.ok(Math.max(...ms) < 90, "no bright stripe");
  });

  it("rubber tone stays far below bloom threshold on every dark theme", () => {
    for (const theme of THEMES) {
      if (skidMarkMode(theme) !== "tone") continue;
      for (const surface of ["plastic", "dirt", "ice", "tech"] as const) {
        const c = skidMarkColorLinear([0, 0, 0, 0], "tone", theme, surface, FRESH_MAX, 1, true);
        assert.ok(Math.max(c[0], c[1], c[2]) < 0.2, `${theme}/${surface} tone ${c.slice(0, 3)}`);
        assert.ok(Math.min(c[0], c[1], c[2]) > 0.02, `${theme}/${surface} tone not black`);
      }
    }
  });

  it("fully faded marks are invisible on every theme and pipeline", () => {
    for (const theme of THEMES) {
      const mode = skidMarkMode(theme);
      for (const graded of [true, false]) {
        for (const surface of ["plastic", "dirt", "ice", "tech"] as const) {
          const c = skidMarkColorLinear([0, 0, 0, 0], mode, theme, surface, FRESH_MAX, 0, graded);
          assert.equal(c[3], 0, `${theme}/${surface} (${mode})`);
        }
      }
      const road = ROADS.green[0]!;
      assert.deepEqual(markedRoad(theme, road, FRESH_MAX, 0), road, theme);
    }
    assert.equal(skidFadeAlpha(SKID_FADE_SECONDS, SKID_FADE_SECONDS), 0);
    assert.ok(SKID_FADE_SECONDS <= 39);
  });

  it("direct path (Low/Medium): light roads keep exactly 1 − alpha of the sRGB road", () => {
    for (const strength of [FRESH_MIN, FRESH_MAX]) {
      const c = skidMarkColorLinear([0, 0, 0, 0], "darken", "stadium", "plastic", strength, 1, false);
      assert.deepEqual(c.slice(0, 3), [0, 0, 0]);
      assert.ok(1 - c[3] >= 0.28 && 1 - c[3] <= 0.4, `left ${(1 - c[3]).toFixed(2)}`);
    }
    assert.ok(SKID_DARKEN_ALPHA.strong > SKID_DARKEN_ALPHA.weak);
  });

  it("skid material reads a per-instance alpha and keeps decal state", () => {
    const mat = createSkidDecalMaterial();
    assert.equal(mat.blending, THREE.NormalBlending);
    assert.equal(blendingNeedsPremultipliedAlpha(mat.blending), false);
    assert.equal(mat.premultipliedAlpha, false);
    assert.equal(mat.transparent, true);
    assert.equal(mat.depthWrite, false);
    assert.equal(mat.polygonOffset, true);
    assert.equal(mat.polygonOffsetFactor, -1);
    assert.equal(mat.polygonOffsetUnits, -4);
    const shader = {
      vertexShader: THREE.ShaderLib.basic.vertexShader,
      fragmentShader: THREE.ShaderLib.basic.fragmentShader,
      uniforms: {},
    } as unknown as THREE.WebGLProgramParametersWithUniforms;
    mat.onBeforeCompile(shader, null as unknown as THREE.WebGLRenderer);
    assert.match(shader.vertexShader, new RegExp(`attribute float ${SKID_ALPHA_ATTR};`));
    assert.match(shader.vertexShader, /vSkidAlpha = skidAlpha;/);
    assert.match(shader.fragmentShader, /diffuseColor\.a \*= vSkidAlpha;/);
    mat.dispose();
  });

  it("pool builds one material once and keeps it across theme changes", () => {
    const vfx = new RaceVfx();
    vfx.setQuality(QUALITY_PRESETS.high);
    const mesh = (vfx as unknown as { skidMesh: THREE.InstancedMesh }).skidMesh;
    assert.ok(mesh.geometry.getAttribute(SKID_ALPHA_ATTR) instanceof THREE.InstancedBufferAttribute);
    const mat = mesh.material;
    for (const theme of THEMES) {
      vfx.setTheme(theme);
      assert.equal(mesh.material, mat, theme);
    }
    // Restart fast path re-applies the same theme every run: mode and material hold.
    vfx.setTheme("storm");
    const mode = (vfx as unknown as { skidMode: string }).skidMode;
    for (let i = 0; i < 3; i++) {
      vfx.setTheme("storm");
      assert.equal((vfx as unknown as { skidMode: string }).skidMode, mode);
      assert.equal(mesh.material, mat);
    }
    assert.equal(mode, "tone");
    const low = new RaceVfx();
    low.setQuality(QUALITY_PRESETS.low);
    assert.equal((low as unknown as { skidMesh: THREE.InstancedMesh | null }).skidMesh, null, "Low has no skids");
    vfx.dispose();
    low.dispose();
  });
});
