import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CANYON_PLANT_S,
  curbSnap,
  driftSteerThreshold,
  headingAlign,
  openingHeadingBleed,
  openingLandLock,
  plantLateral,
  shapeTouchSteer,
  stayPlanted,
  steerCurve,
  TOUCH_STEER_DEADZONE,
} from "./feel.ts";

describe("shapeTouchSteer", () => {
  it("deadzones a resting thumb and still reaches full lock", () => {
    assert.equal(shapeTouchSteer(0), 0);
    assert.equal(shapeTouchSteer(TOUCH_STEER_DEADZONE), 0);
    assert.equal(shapeTouchSteer(-TOUCH_STEER_DEADZONE * 0.9), 0);
    assert.ok(Math.abs(shapeTouchSteer(0.18)) > 0.04);
    assert.ok(Math.abs(shapeTouchSteer(0.18)) < 0.18);
    assert.equal(shapeTouchSteer(1), 1);
    assert.equal(shapeTouchSteer(-1), -1);
  });
});

describe("steerCurve + headingAlign", () => {
  it("ignores analog slop and snaps heading back on release", () => {
    assert.equal(steerCurve(0.04), 0);
    assert.ok(Math.abs(steerCurve(0.2)) > 0.1);
    assert.ok(headingAlign(0, false) > 7);
    assert.ok(headingAlign(0.15, false) > 1);
    assert.ok(headingAlign(0.15, false) > headingAlign(0.8, false));
    assert.equal(headingAlign(0.5, true), 0.26);
  });

  it("needs a committed steer before Slide becomes a drift", () => {
    assert.ok(driftSteerThreshold(true) > 0.2);
    assert.equal(driftSteerThreshold(false), 1);
  });
});

describe("Ridge opening plant helpers", () => {
  it("plants Ridge through the first curve and leaves other tracks alone", () => {
    assert.equal(stayPlanted("canyon", 80), true);
    assert.equal(stayPlanted("canyon", CANYON_PLANT_S), false);
    assert.equal(stayPlanted("circuit", 20), false);
    assert.equal(stayPlanted("helix", 20), false);
    assert.ok(openingLandLock("canyon") > 1);
    assert.equal(openingLandLock("helix"), 0);
    assert.ok(openingHeadingBleed("canyon", 40, 0.1, false) > 3);
    assert.equal(openingHeadingBleed("canyon", 40, 0.1, true), 0);
    const pulled = plantLateral(2.4, "canyon", 40, 0, 1 / 60);
    assert.ok(Math.abs(pulled) < 2.4);
    assert.equal(plantLateral(2.4, "canyon", 40, 0.5, 1 / 60), 2.4);
    assert.equal(plantLateral(2.4, "helix", 40, 0, 1 / 60), 2.4);
  });
});

describe("curbSnap", () => {
  it("pulls Circuit off the curb early and leaves Helix alone", () => {
    const wide = curbSnap({ n: 5.4, heading: -0.2, width: 12.5, trackId: "circuit", s: 40 });
    assert.equal(wide.hit, true);
    assert.equal(wide.early, true);
    assert.ok(wide.n < 5.4, `n ${wide.n}`);
    assert.ok(wide.heading > -0.2, `heading ${wide.heading}`);

    const center = curbSnap({ n: 0.4, heading: 0.05, width: 12.5, trackId: "circuit", s: 40 });
    assert.equal(center.hit, false);
    assert.equal(center.n, 0.4);

    const helix = curbSnap({ n: 5.4, heading: -0.2, width: 11.5, trackId: "helix", s: 40 });
    assert.equal(helix.hit, false);
    assert.equal(helix.n, 5.4);
    assert.equal(helix.heading, -0.2);
  });
});
