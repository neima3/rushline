import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { autoThrottleCap } from "./auto-throttle.ts";

describe("autoThrottleCap", () => {
  it("holds the car during countdown", () => {
    assert.equal(
      autoThrottleCap({
        trackId: "canyon",
        s: 6,
        speed: 0,
        firstCp: 147,
        touchMode: false,
        countdown: true,
      }),
      0,
    );
  });

  it("keeps Ridge opening auto-throttle well below full send", () => {
    const opening = autoThrottleCap({
      trackId: "canyon",
      s: 20,
      speed: 8,
      firstCp: 147,
      touchMode: false,
      countdown: false,
    });
    const held = autoThrottleCap({
      trackId: "canyon",
      s: 40,
      speed: 22,
      firstCp: 147,
      touchMode: false,
      countdown: false,
    });
    assert.ok(opening <= 0.38);
    assert.ok(held <= 0.14);
  });

  it("restores full auto-throttle after the Ridge settle", () => {
    const after = autoThrottleCap({
      trackId: "canyon",
      s: 200,
      speed: 30,
      firstCp: 147,
      touchMode: false,
      countdown: false,
    });
    assert.equal(after, 1);
  });

  it("does not cap desktop Circuit auto-throttle after countdown", () => {
    assert.equal(
      autoThrottleCap({
        trackId: "circuit",
        s: 10,
        speed: 5,
        firstCp: 80,
        touchMode: false,
        countdown: false,
      }),
      1,
    );
  });

  it("keeps existing mobile Circuit opening cap", () => {
    const early = autoThrottleCap({
      trackId: "circuit",
      s: 20,
      speed: 20,
      firstCp: 80,
      touchMode: true,
      countdown: false,
    });
    assert.equal(early, 0.14);
  });
});
