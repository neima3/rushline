import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ghostDeltaSmooth, ghostLead } from "./feel.ts";
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
  stepGhostPassState,
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

  it("toasts on HUD-style smoothed AHEAD→BEHIND flips, not raw split in the even band", () => {
    const dt = 0.08;
    let smooth: number | null = 90;
    let decisive = nextDecisiveLead(null, ghostLead(smooth));
    assert.equal(decisive, "behind");

    for (let i = 0; i < 24; i++) {
      const raw = 25;
      decisive = nextDecisiveLead(decisive, ghostLead(raw));
      smooth = ghostDeltaSmooth(smooth, raw, dt);
      assert.equal(ghostPassKind(decisive, ghostLead(raw)), null);
    }
    assert.ok(ghostLead(smooth) === "behind" || ghostLead(smooth) === "even");

    smooth = -60;
    assert.equal(ghostLead(smooth), "ahead");
    assert.equal(ghostPassKind(decisive, ghostLead(25)), null);
    assert.equal(ghostPassKind(decisive, ghostLead(smooth)), "gained");

    decisive = nextDecisiveLead(decisive, ghostLead(smooth));
    smooth = 70;
    assert.equal(ghostLead(smooth), "behind");
    assert.equal(ghostPassKind(decisive, ghostLead(-25)), null);
    assert.equal(ghostPassKind(decisive, ghostLead(smooth)), "lost");
  });

  it("steps pass state from smoothed split each frame", () => {
    let state = stepGhostPassState({ decisive: "behind", smooth: 100 }, null, 0);
    let gained = false;
    for (let i = 0; i < 12; i++) {
      state = stepGhostPassState(state, -90, 0.016);
      if (state.pass === "gained") gained = true;
    }
    assert.ok(gained);
    assert.equal(state.lead, "ahead");

    let lost = false;
    for (let i = 0; i < 12; i++) {
      state = stepGhostPassState(state, 90, 0.016);
      if (state.pass === "lost") lost = true;
    }
    assert.ok(lost);
    assert.equal(state.lead, "behind");
  });

  it("does not toast on tiny smoothed oscillations inside the even band", () => {
    let state = stepGhostPassState({ decisive: "behind", smooth: 80 }, null, 0);
    const dt = 0.016;
    let passes = 0;
    for (let i = 0; i < 120; i++) {
      const raw = 40 + Math.sin(i * 0.7) * 6;
      const step = stepGhostPassState(state, raw, dt);
      state = step;
      if (step.pass) passes += 1;
    }
    assert.equal(passes, 0);
    assert.equal(state.decisive, "behind");
  });
});
