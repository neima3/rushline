import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isStockLapsSetting, resolveRaceLaps, scaleMedals, withRaceLaps } from "./laps.ts";
import { getTrack } from "./track.ts";

describe("isStockLapsSetting", () => {
  it("accepts Track plus 1 / 2 / 3", () => {
    assert.equal(isStockLapsSetting("track"), true);
    assert.equal(isStockLapsSetting(1), true);
    assert.equal(isStockLapsSetting(2), true);
    assert.equal(isStockLapsSetting(3), true);
    assert.equal(isStockLapsSetting(4), false);
    assert.equal(isStockLapsSetting("2"), false);
  });
});

describe("resolveRaceLaps", () => {
  it("keeps authored laps for Custom and Rush Cup", () => {
    assert.equal(resolveRaceLaps({ trackId: "custom", authored: 1, setting: 3, playMode: "trial" }), 1);
    assert.equal(resolveRaceLaps({ trackId: "circuit", authored: 2, setting: 3, playMode: "cup" }), 2);
  });

  it("uses Settings 1 / 2 / 3 on stock time trial and hotseat", () => {
    assert.equal(resolveRaceLaps({ trackId: "canyon", authored: 1, setting: "track", playMode: "trial" }), 1);
    assert.equal(resolveRaceLaps({ trackId: "canyon", authored: 1, setting: 2, playMode: "trial" }), 2);
    assert.equal(resolveRaceLaps({ trackId: "circuit", authored: 2, setting: 1, playMode: "hotseat" }), 1);
    assert.equal(resolveRaceLaps({ trackId: "helix", authored: 1, setting: 3, playMode: "hotseat" }), 3);
  });
});

describe("scaleMedals", () => {
  it("leaves authored medals alone when laps match", () => {
    const m = { author: 40_000, gold: 44_000, silver: 50_000, bronze: 58_000 };
    assert.deepEqual(scaleMedals(m, 1, 1), m);
  });

  it("scales medal windows with the lap count", () => {
    const m = { author: 40_000, gold: 44_000, silver: 50_000, bronze: 58_000 };
    const two = scaleMedals(m, 1, 2);
    assert.equal(two.author, 80_000);
    assert.equal(two.gold, 88_000);
    const half = scaleMedals(m, 2, 1);
    assert.equal(half.author, 20_000);
    assert.equal(half.bronze, 29_000);
  });
});

describe("withRaceLaps", () => {
  it("clones the def so the stock cache stays authored", () => {
    const built = getTrack("canyon");
    const authored = built.def.laps;
    const raced = withRaceLaps(built, 3);
    assert.equal(raced.def.laps, 3);
    assert.equal(built.def.laps, authored);
    assert.equal(getTrack("canyon").def.laps, authored);
    assert.ok(raced.def.medals.author > built.def.medals.author);
  });
});
