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
  trackAssistScale,
} from "./feel.ts";
import type { TrackAssist } from "./settings.ts";

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

const LEVELS: TrackAssist[] = ["off", "low", "medium", "high"];

function curbPull(assist: TrackAssist) {
  const start = { n: 5.4, heading: -0.2, width: 12.5, trackId: "circuit" as const, s: 40, assist };
  const out = curbSnap(start);
  return { dn: start.n - out.n, dHeading: out.heading - start.heading, hit: out.hit };
}

describe("trackAssistScale", () => {
  it("is monotonic Off < Low < Medium < High on every knob", () => {
    const scales = LEVELS.map((level) => trackAssistScale(level));
    for (const key of ["heading", "plant", "curbPull", "curbHeading"] as const) {
      assert.equal(scales[0]![key], 0, `${key} off`);
      assert.ok(scales[1]![key] > 0 && scales[1]![key] < 1, `${key} low`);
      assert.equal(scales[2]![key], 1, `${key} medium`);
      assert.ok(scales[3]![key] > 1, `${key} high`);
    }
  });
});

describe("track assist heading + plant + curb", () => {
  it("Off gates heading snap, plant, and curb pull", () => {
    assert.equal(headingAlign(0, false, "off"), 0);
    assert.equal(headingAlign(0.5, true, "off"), 0);
    assert.equal(openingHeadingBleed("canyon", 40, 0.1, false, "off"), 0);
    assert.equal(openingLandLock("canyon", "off"), 0);
    assert.equal(stayPlanted("canyon", 80, "off"), false);
    assert.equal(plantLateral(2.4, "canyon", 40, 0, 1 / 60, "off"), 2.4);
    const curb = curbSnap({ n: 5.4, heading: -0.2, width: 12.5, trackId: "circuit", s: 40, assist: "off" });
    assert.equal(curb.hit, false);
    assert.equal(curb.n, 5.4);
    assert.equal(curb.heading, -0.2);
  });

  it("Low is a light fraction of Medium", () => {
    const low = trackAssistScale("low");
    assert.ok(Math.abs(headingAlign(0, false, "low") - headingAlign(0, false, "medium") * low.heading) < 1e-9);
    assert.ok(
      Math.abs(openingHeadingBleed("canyon", 40, 0.1, false, "low") - openingHeadingBleed("canyon", 40, 0.1, false, "medium") * low.heading) <
        1e-9,
    );
    assert.ok(Math.abs(openingLandLock("canyon", "low") - openingLandLock("canyon", "medium") * low.plant) < 1e-9);
    assert.equal(stayPlanted("canyon", 80, "low"), true);

    const medN = plantLateral(2.4, "canyon", 40, 0, 1 / 60, "medium");
    const lowN = plantLateral(2.4, "canyon", 40, 0, 1 / 60, "low");
    assert.ok(Math.abs(lowN) > Math.abs(medN), `low plant ${lowN} vs med ${medN}`);
    assert.ok(Math.abs(lowN) < 2.4);

    const lowCurb = curbPull("low");
    const medCurb = curbPull("medium");
    assert.equal(lowCurb.hit, true);
    assert.ok(lowCurb.dn < medCurb.dn);
    assert.ok(lowCurb.dHeading < medCurb.dHeading);
  });

  it("Medium matches the shipped phone feel (unscaled helpers)", () => {
    assert.equal(headingAlign(0, false, "medium"), headingAlign(0, false));
    assert.equal(headingAlign(0.5, true, "medium"), 0.26);
    assert.equal(openingLandLock("canyon", "medium"), 1.85);
    assert.equal(openingHeadingBleed("canyon", 40, 0.1, false, "medium"), 3.6);
    assert.equal(plantLateral(2.4, "canyon", 40, 0, 1 / 60, "medium"), plantLateral(2.4, "canyon", 40, 0, 1 / 60));
    const a = curbSnap({ n: 5.4, heading: -0.2, width: 12.5, trackId: "circuit", s: 40, assist: "medium" });
    const b = curbSnap({ n: 5.4, heading: -0.2, width: 12.5, trackId: "circuit", s: 40 });
    assert.equal(a.n, b.n);
    assert.equal(a.heading, b.heading);
  });

  it("High is stronger plant, heading align, and curb snap than Medium", () => {
    const high = trackAssistScale("high");
    assert.ok(headingAlign(0, false, "high") > headingAlign(0, false, "medium"));
    assert.ok(headingAlign(0.15, false, "high") > headingAlign(0.15, false, "medium"));
    assert.ok(Math.abs(headingAlign(0, false, "high") - 8.4 * high.heading) < 1e-9);
    assert.ok(openingHeadingBleed("canyon", 40, 0.1, false, "high") > openingHeadingBleed("canyon", 40, 0.1, false, "medium"));
    assert.ok(openingLandLock("canyon", "high") > openingLandLock("canyon", "medium"));
    assert.equal(stayPlanted("canyon", 80, "high"), true);

    const medN = plantLateral(2.4, "canyon", 40, 0, 1 / 60, "medium");
    const highN = plantLateral(2.4, "canyon", 40, 0, 1 / 60, "high");
    assert.ok(Math.abs(highN) < Math.abs(medN), `high plant ${highN} vs med ${medN}`);

    const highCurb = curbPull("high");
    const medCurb = curbPull("medium");
    assert.ok(highCurb.dn > medCurb.dn);
    assert.ok(highCurb.dHeading > medCurb.dHeading);

    const helix = curbSnap({ n: 5.4, heading: -0.2, width: 11.5, trackId: "helix", s: 40, assist: "high" });
    assert.equal(helix.hit, false);
    assert.equal(helix.n, 5.4);
  });
});
