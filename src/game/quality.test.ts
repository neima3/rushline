import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyGraphicsKnobs,
  cycleQuality,
  fogWindow,
  isOnCurb,
  NIGHT_FOG,
  QUALITY_PRESETS,
  SETTINGS_KEY,
  SETTINGS_TIER_COST,
  resolveQuality,
} from "./quality.ts";

describe("quality presets", () => {
  it("caps bloom and shadows on Low", () => {
    const low = QUALITY_PRESETS.low;
    assert.equal(low.bloom, false);
    assert.equal(low.shadows, false);
    assert.ok(low.sparkScale < QUALITY_PRESETS.medium.sparkScale);
    assert.ok(QUALITY_PRESETS.medium.sparkScale < QUALITY_PRESETS.high.sparkScale);
  });

  it("resolveQuality honors an explicit tier", () => {
    assert.equal(resolveQuality("low").tier, "low");
    assert.equal(resolveQuality("high").bloom, true);
  });

  it("cycles Low → Med → High → Low", () => {
    assert.equal(cycleQuality("low"), "medium");
    assert.equal(cycleQuality("medium"), "high");
    assert.equal(cycleQuality("high"), "low");
  });

  it("never tightens Helix Night fog below 88/460", () => {
    assert.deepEqual(fogWindow("night"), NIGHT_FOG);
    assert.deepEqual(fogWindow("night", { fogNearMul: 0.52, fogFarMul: 0.5, fogEnabled: false }), NIGHT_FOG);
    const dayLow = fogWindow("stadium", { fogNearMul: 0.52, fogFarMul: 0.5 });
    assert.ok(dayLow.near < 80);
    assert.ok(dayLow.far < 440);
  });

  it("matches Settings #17 Low/Med/High cost table", () => {
    assert.equal(QUALITY_PRESETS.low.shadows, false);
    assert.equal(QUALITY_PRESETS.low.bloom, false);
    assert.equal(QUALITY_PRESETS.low.pixelRatioCap, 1);
    assert.equal(QUALITY_PRESETS.low.sparkScale, SETTINGS_TIER_COST.low.particleDensity);
    assert.equal(QUALITY_PRESETS.medium.shadows, true);
    assert.equal(QUALITY_PRESETS.medium.bloom, false);
    assert.equal(QUALITY_PRESETS.medium.pixelRatioCap, 1.5);
    assert.equal(QUALITY_PRESETS.medium.sparkScale, SETTINGS_TIER_COST.medium.particleDensity);
    assert.equal(QUALITY_PRESETS.high.shadows, true);
    assert.equal(QUALITY_PRESETS.high.bloom, true);
    assert.equal(QUALITY_PRESETS.high.pixelRatioCap, 2);
    assert.equal(QUALITY_PRESETS.high.sparkScale, SETTINGS_TIER_COST.high.particleDensity);
  });

  it("maps Settings store fields onto scene knobs", () => {
    const low = SETTINGS_TIER_COST.low;
    const profile = applyGraphicsKnobs(QUALITY_PRESETS.high, {
      quality: "low",
      shadows: false,
      bloom: false,
      particleDensity: low.particleDensity,
      dprCap: low.dprCap,
    });
    assert.equal(profile.tier, "low");
    assert.equal(profile.shadows, false);
    assert.equal(profile.bloom, false);
    assert.equal(profile.pixelRatioCap, 1);
    assert.equal(profile.smokeScale, low.particleDensity);
    assert.equal(SETTINGS_KEY, "rushline-settings-v1");
  });

  it("treats the ribbon edge as curb and ignores air", () => {
    assert.equal(isOnCurb(5.6, 12, false), true);
    assert.equal(isOnCurb(0, 12, false), false);
    assert.equal(isOnCurb(5.6, 12, true), false);
  });
});
