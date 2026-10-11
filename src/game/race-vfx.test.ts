import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as THREE from "three";
import {
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
import { GATE_LOOK } from "./presentation.ts";

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
  it("skid decal uses premultiplied multiply blending with fade-safe state", () => {
    const mat = createSkidDecalMaterial();
    assert.equal(mat.blending, THREE.MultiplyBlending);
    assert.equal(mat.premultipliedAlpha, true);
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
