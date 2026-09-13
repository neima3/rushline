import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fogWindow, NIGHT_FOG, QUALITY_PRESETS, themeLightLevels } from "./quality.ts";
import { CAR_PAINT, CIRCUIT_HIGH_LOCK, GRADE, HELIX_FOG_LOCK, SKY_LOOK } from "./presentation.ts";

describe("look polish 3 presentation locks", () => {
  it("keeps Circuit High sun / hemi / exposure / env / bloomMul", () => {
    const high = themeLightLevels("stadium", QUALITY_PRESETS.high);
    assert.equal(high.sun, CIRCUIT_HIGH_LOCK.sun);
    assert.equal(high.hemi, CIRCUIT_HIGH_LOCK.hemi);
    assert.equal(high.exposure, CIRCUIT_HIGH_LOCK.exposure);
    assert.equal(high.env, CIRCUIT_HIGH_LOCK.env);
    assert.equal(high.bloomMul, CIRCUIT_HIGH_LOCK.bloomMul);
    assert.ok(high.bloomThreshold >= 0.96);
  });

  it("keeps Helix Night fog 88/460", () => {
    assert.deepEqual(HELIX_FOG_LOCK, NIGHT_FOG);
    assert.deepEqual(fogWindow("night", { fogNearMul: 0.4, fogFarMul: 0.4, fogEnabled: false }), NIGHT_FOG);
  });

  it("grades Circuit with a light vignette and midtone-safe contrast", () => {
    assert.ok(GRADE.stadium.vignette <= 0.18);
    assert.ok(GRADE.stadium.contrast <= 1.06);
    assert.ok(GRADE.stadium.saturation <= 1.04);
    assert.equal(GRADE.stadium.tint, 0xffffff);
    assert.ok(GRADE.canyon.vignette > GRADE.stadium.vignette);
    assert.ok(GRADE.night.saturation > GRADE.stadium.saturation);
  });

  it("keeps stadium sky haze weaker than Ridge dusk", () => {
    assert.ok(SKY_LOOK.stadium.haze < SKY_LOOK.canyon.haze);
    assert.ok(SKY_LOOK.stadium.sunGlow < SKY_LOOK.canyon.sunGlow);
    assert.ok(SKY_LOOK.alpine.haze > SKY_LOOK.stadium.haze);
    assert.ok(SKY_LOOK.alpine.haze < SKY_LOOK.canyon.haze);
  });

  it("gives alpine its own cool grade without rewriting Circuit or Helix", () => {
    assert.equal(GRADE.stadium.tint, 0xffffff);
    assert.ok(GRADE.alpine.saturation < GRADE.stadium.saturation);
    assert.ok(GRADE.alpine.vignette > GRADE.stadium.vignette);
    assert.ok(GRADE.alpine.vignette < GRADE.canyon.vignette);
    assert.equal(themeLightLevels("stadium", QUALITY_PRESETS.high).sun, CIRCUIT_HIGH_LOCK.sun);
    assert.deepEqual(fogWindow("night"), NIGHT_FOG);
  });

  it("keeps car paint in a clearcoat / low-roughness range", () => {
    assert.ok(CAR_PAINT.clearcoat >= 0.9);
    assert.ok(CAR_PAINT.clearcoatRoughness <= 0.06);
    assert.ok(CAR_PAINT.roughness <= 0.14);
    assert.ok(CAR_PAINT.envDay > 3);
  });
});
