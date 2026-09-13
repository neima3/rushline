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
  textureBudget,
  themeLightLevels,
  wantsGrade,
  wantsMsaa,
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

  it("caps Low/Med GPU work and keeps High shadow / texture / grade", () => {
    assert.equal(QUALITY_PRESETS.low.grade, false);
    assert.equal(QUALITY_PRESETS.medium.grade, false);
    assert.equal(QUALITY_PRESETS.high.grade, true);
    assert.equal(wantsGrade("high"), true);
    assert.equal(wantsGrade("medium"), false);
    assert.equal(wantsMsaa("high"), true);
    assert.equal(wantsMsaa("low"), false);
    assert.ok(QUALITY_PRESETS.medium.shadowMap <= 512);
    assert.equal(QUALITY_PRESETS.high.shadowMap, 1536);
    assert.equal(QUALITY_PRESETS.high.shadowExtent, 70);
    assert.ok(QUALITY_PRESETS.medium.shadowExtent < QUALITY_PRESETS.high.shadowExtent);
    assert.ok(textureBudget("low").size <= 128);
    assert.ok(textureBudget("medium").size <= 128);
    assert.equal(textureBudget("low").roughnessMap, false);
    assert.equal(textureBudget("high").size, 256);
    assert.equal(textureBudget("high").anisotropy, 8);
    assert.equal(SETTINGS_TIER_COST.high.shadowMap, QUALITY_PRESETS.high.shadowMap);
    assert.equal(SETTINGS_TIER_COST.medium.texSize, QUALITY_PRESETS.medium.texSize);
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
    assert.equal(profile.grade, false);
    assert.equal(profile.texSize, 128);
    assert.equal(SETTINGS_KEY, "rushline-settings-v1");
  });

  it("pulls Circuit day exposure at Medium/High without touching Ridge or Helix", () => {
    const low = themeLightLevels("stadium", QUALITY_PRESETS.low);
    const med = themeLightLevels("stadium", QUALITY_PRESETS.medium);
    const high = themeLightLevels("stadium", QUALITY_PRESETS.high);
    assert.ok(high.sun < med.sun && med.sun < low.sun);
    assert.ok(high.hemi < med.hemi && med.hemi < low.hemi);
    assert.ok(high.exposure < med.exposure && med.exposure <= low.exposure);
    assert.ok(high.sun < 1.52 && high.hemi < 0.88 && high.exposure < 1.06);
    assert.ok(high.bloomMul < 0.35 && high.bloomThreshold >= 0.96);
    assert.equal(high.env, 0.08);

    const ridge = themeLightLevels("canyon", QUALITY_PRESETS.high);
    assert.equal(ridge.sun, 1.44);
    assert.equal(ridge.hemi, 0.76);
    assert.equal(ridge.exposure, 1.0);
    assert.equal(ridge.bloomMul, 0.48);
    assert.ok(ridge.sun > themeLightLevels("stadium", QUALITY_PRESETS.high).sun);
    assert.ok(ridge.exposure > themeLightLevels("stadium", QUALITY_PRESETS.high).exposure);

    const helix = themeLightLevels("night", QUALITY_PRESETS.high);
    assert.equal(helix.sun, 0.95);
    assert.equal(helix.hemi, 1.32);
    assert.equal(helix.exposure, 1.24);
    assert.deepEqual(fogWindow("night", { fogNearMul: 0.5, fogFarMul: 0.5 }), NIGHT_FOG);

    const alpine = themeLightLevels("alpine", QUALITY_PRESETS.high);
    assert.notEqual(alpine.sun, high.sun);
    assert.notEqual(alpine.exposure, helix.exposure);
    assert.ok(alpine.bloomMul < 0.4);
    const alpineLow = fogWindow("alpine", { fogNearMul: 0.52, fogFarMul: 0.5 });
    assert.ok(alpineLow.near < 80);
    assert.ok(alpineLow.far < 440);
    assert.deepEqual(fogWindow("night", { fogNearMul: 0.52, fogFarMul: 0.5 }), NIGHT_FOG);

    const works = themeLightLevels("works", QUALITY_PRESETS.high);
    assert.notEqual(works.sun, high.sun);
    assert.notEqual(works.exposure, helix.exposure);
    assert.ok(works.bloomMul < 0.5 && works.bloomMul > alpine.bloomMul);
    const worksLow = fogWindow("works", { fogNearMul: 0.52, fogFarMul: 0.5 });
    assert.ok(worksLow.near < 80);
    assert.ok(worksLow.far < 440);
    assert.deepEqual(fogWindow("night", { fogNearMul: 0.52, fogFarMul: 0.5 }), NIGHT_FOG);
  });

  it("treats the ribbon edge as curb and ignores air", () => {
    assert.equal(isOnCurb(5.6, 12, false), true);
    assert.equal(isOnCurb(0, 12, false), false);
    assert.equal(isOnCurb(5.6, 12, true), false);
  });
});
