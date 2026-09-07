import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isOnCurb, QUALITY_PRESETS, resolveQuality } from "./quality.ts";

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

  it("treats the ribbon edge as curb and ignores air", () => {
    assert.equal(isOnCurb(5.6, 12, false), true);
    assert.equal(isOnCurb(0, 12, false), false);
    assert.equal(isOnCurb(5.6, 12, true), false);
  });
});
