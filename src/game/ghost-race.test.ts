import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  alongDelta,
  ghostLightsOutMul,
  ghostLiveOpacity,
  ghostPassHoldMs,
  ghostPassKind,
  ghostPassLabel,
  ghostProximityMul,
  GHOST_LIGHTS_FADE_MS,
  nextDecisiveLead,
} from "./ghost-race.ts";

describe("alongDelta", () => {
  it("is signed along the ribbon and wraps a closed loop", () => {
    assert.equal(alongDelta(40, 20, 200, false), 20);
    assert.equal(alongDelta(20, 40, 200, false), -20);
    const wrap = alongDelta(5, 190, 200, true);
    assert.ok(wrap > 10 && wrap < 20);
    const back = alongDelta(190, 5, 200, true);
    assert.ok(back < -10 && back > -20);
  });
});

describe("ghostProximityMul", () => {
  it("keeps distant rivals opaque and fades a stack", () => {
    assert.equal(ghostProximityMul(40, 0), 1);
    assert.equal(ghostProximityMul(0, 8), 1);
    const stacked = ghostProximityMul(0, 0);
    assert.ok(stacked > 0.15 && stacked < 0.25);
    const near = ghostProximityMul(4, 0.4);
    assert.ok(near > stacked && near < 1);
  });
});

describe("ghostLightsOutMul", () => {
  it("hides the ghost through countdown and fades in on GO", () => {
    assert.equal(ghostLightsOutMul(3, 0), 0);
    assert.equal(ghostLightsOutMul(0.2, 0), 0);
    assert.equal(ghostLightsOutMul(null, 0), 0);
    assert.equal(ghostLightsOutMul(null, GHOST_LIGHTS_FADE_MS), 1);
    assert.equal(ghostLightsOutMul(null, 2000), 1);
    const mid = ghostLightsOutMul(null, GHOST_LIGHTS_FADE_MS / 2);
    assert.ok(Math.abs(mid - 0.5) < 1e-9);
  });
});

describe("ghostLiveOpacity", () => {
  it("multiplies setting, proximity, and lights-out", () => {
    assert.equal(ghostLiveOpacity(0.46, 1, 1), 0.46);
    assert.equal(ghostLiveOpacity(0.46, 0.5, 1), 0.23);
    assert.equal(ghostLiveOpacity(0.46, 1, 0), 0);
    assert.equal(ghostLiveOpacity(2, 1, 1), 1);
    assert.equal(ghostLiveOpacity(0.46, Number.NaN, 1), 0.46);
  });
});

describe("ghost pass", () => {
  it("toasts only after the first decisive lock flips", () => {
    assert.equal(ghostPassKind(null, "behind"), null);
    assert.equal(ghostPassKind(null, "ahead"), null);
    assert.equal(nextDecisiveLead(null, "even"), null);
    assert.equal(nextDecisiveLead(null, "behind"), "behind");
    assert.equal(ghostPassKind("behind", "even"), null);
    assert.equal(ghostPassKind("behind", "ahead"), "gained");
    assert.equal(ghostPassKind("ahead", "behind"), "lost");
    assert.equal(ghostPassKind("ahead", "ahead"), null);
    assert.equal(ghostPassLabel("gained"), "PASSED");
    assert.equal(ghostPassLabel("lost"), "OVERTAKEN");
    assert.ok(ghostPassHoldMs() > 800);
  });
});
