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
  RaceVfx,
  raceVfxDensity,
  skidFadeAlpha,
  skidFadeTintColor,
  skidRingIndex,
  skidSurfaceTint,
  SKID_MAX_AGE,
} from "./race-vfx.ts";
import { getTrack } from "./track.ts";
import { QUALITY_PRESETS } from "./quality.ts";
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

describe("RaceVfx resetRun", () => {
  it("clears gate flash, finish burst, and boost scroll without unregistering gates", () => {
    const rv = new RaceVfx();
    rv.setQuality(QUALITY_PRESETS.high, 1);
    const track = getTrack("circuit");
    rv.bindTrack(track, "stadium");
    const cpLook = gateLookForTheme("stadium", false);
    const cpMat = new THREE.MeshStandardMaterial({ emissive: new THREE.Color(cpLook.emissive) });
    cpMat.emissiveIntensity = cpLook.emissiveBase;
    const cpRim = new THREE.MeshBasicMaterial({ transparent: true, color: 0xffffff, opacity: 0.8 });
    const finMat = new THREE.MeshStandardMaterial({
      emissive: new THREE.Color(gateLookForTheme("stadium", true).emissive),
    });
    finMat.emissiveIntensity = gateLookForTheme("stadium", true).emissiveBase;
    rv.registerGate(48, false, new THREE.Group(), [cpMat, cpRim]);
    rv.registerGate(11.2, true, new THREE.Group(), [finMat]);

    rv.onTimingGate(48, "cp");
    rv.step(0.05);
    assert.ok(cpMat.emissiveIntensity > cpLook.emissiveBase + 0.01, "gate mid-flash");

    rv.onTimingGate(11.2, "finish");
    const burstLife = (rv as unknown as { burstLife: Float32Array }).burstLife;
    assert.ok([...burstLife].some((l) => l > 0), "finish burst spawned");

    rv.resetRun();
    assert.ok([...burstLife].every((l) => l <= 0), "finish burst cleared");
    assert.equal(cpMat.emissiveIntensity, cpLook.emissiveBase);
    assert.equal(cpRim.color.getHex(), 0xffffff);
    assert.equal(cpRim.opacity, 0.8);

    const pad = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
    const chevron = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
    rv.registerBoostPad(20, pad, [chevron]);
    const boosts = (rv as unknown as { boosts: { scroll: number }[] }).boosts;
    boosts[0]!.scroll = 2.75;
    rv.resetRun();
    assert.equal(boosts[0]!.scroll, 0);
    rv.step(0.01);
    rv.dispose();
    cpMat.dispose();
    cpRim.dispose();
    finMat.dispose();
    pad.geometry.dispose();
    (pad.material as THREE.Material).dispose();
    chevron.geometry.dispose();
    (chevron.material as THREE.Material).dispose();
  });
});

describe("RaceVfx finish burst visibility", () => {
  type BurstView = { burstPoints: THREE.Points | null; burstLife: Float32Array };
  function setup() {
    const rv = new RaceVfx();
    rv.setQuality(QUALITY_PRESETS.high, 1);
    rv.bindTrack(getTrack("circuit"), "stadium");
    const finMat = new THREE.MeshStandardMaterial({
      emissive: new THREE.Color(gateLookForTheme("stadium", true).emissive),
    });
    rv.registerGate(11.2, true, new THREE.Group(), [finMat]);
    const view = rv as unknown as BurstView;
    return { rv, finMat, view };
  }
  function drawnPoints(view: BurstView) {
    const pts = view.burstPoints;
    if (!pts || !pts.visible) return 0;
    const pos = pts.geometry.getAttribute("position");
    const range = pts.geometry.drawRange;
    return Math.max(0, Math.min(range.count, pos.count - range.start));
  }

  it("draws nothing before any finish", () => {
    const { rv, finMat, view } = setup();
    assert.ok(view.burstPoints, "high quality has a burst pool");
    assert.equal(drawnPoints(view), 0);
    rv.step(0.016);
    assert.equal(drawnPoints(view), 0);
    rv.dispose();
    finMat.dispose();
  });

  it("restart after a finish leaves no visible burst points", () => {
    const { rv, finMat, view } = setup();
    rv.onTimingGate(11.2, "finish");
    rv.step(0.05);
    const live = [...view.burstLife].filter((l) => l > 0).length;
    assert.ok(live > 0, "finish burst spawned");
    assert.equal(drawnPoints(view), live, "only live particles are drawn");

    rv.resetRun();
    assert.equal(view.burstPoints!.visible, false, "burst hidden after resetRun");
    assert.equal(view.burstPoints!.geometry.drawRange.count, 0, "draw range empty after resetRun");
    assert.equal(drawnPoints(view), 0);
    // Countdown frames after the restart keep it hidden.
    for (let i = 0; i < 30; i++) rv.step(1 / 60);
    assert.equal(drawnPoints(view), 0);
    rv.dispose();
    finMat.dispose();
  });

  it("draws nothing once the burst life expires via step()", () => {
    const { rv, finMat, view } = setup();
    rv.onTimingGate(11.2, "finish");
    assert.ok(drawnPoints(view) > 0, "burst visible while live");
    // Max particle life is 0.9 s; step well past it in frame-sized steps.
    for (let i = 0; i < 90; i++) rv.step(1 / 60);
    assert.ok([...view.burstLife].every((l) => l <= 0), "all particles dead");
    assert.equal(view.burstPoints!.visible, false, "burst hidden after expiry");
    assert.equal(view.burstPoints!.geometry.drawRange.count, 0);
    assert.equal(drawnPoints(view), 0);
    rv.dispose();
    finMat.dispose();
  });

  it("dead particles are not drawn while others are still live", () => {
    const { rv, finMat, view } = setup();
    rv.onTimingGate(11.2, "finish");
    // Kill half the live slots by hand, then step a tiny dt.
    let killed = 0;
    view.burstLife.forEach((l, i) => {
      if (l > 0 && i % 2 === 0) {
        view.burstLife[i] = 0;
        killed++;
      }
    });
    assert.ok(killed > 0);
    rv.step(0.001);
    const live = [...view.burstLife].filter((l) => l > 0).length;
    assert.ok(live > 0);
    assert.equal(drawnPoints(view), live);
    rv.dispose();
    finMat.dispose();
  });

  it("low quality spawns no burst", () => {
    const rv = new RaceVfx();
    rv.setQuality(QUALITY_PRESETS.low);
    rv.bindTrack(getTrack("circuit"), "stadium");
    const finMat = new THREE.MeshStandardMaterial();
    rv.registerGate(11.2, true, new THREE.Group(), [finMat]);
    rv.onTimingGate(11.2, "finish");
    rv.step(0.05);
    assert.equal(drawnPoints(rv as unknown as BurstView), 0);
    rv.dispose();
    finMat.dispose();
  });
});
