import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
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
