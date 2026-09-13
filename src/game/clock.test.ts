import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COUNTDOWN_S, countdownPausedAt, countdownRemaining, wallClockMs } from "./clock.ts";
import { pageIsHidden, shouldPauseForBackground } from "./lifecycle.ts";

describe("race clock", () => {
  it("tracks wall-clock from GO, not physics steps", () => {
    const go = 10_000;
    assert.equal(wallClockMs(0, go, go + 1500), 1500);
    assert.equal(wallClockMs(800, go, go + 200), 1000);
    assert.equal(wallClockMs(0, 0, 50_000), 0);
  });

  it("treats hidden, prerender, and pagehide as backgrounded", () => {
    assert.equal(pageIsHidden({ hidden: false, visibilityState: "visible" }), false);
    assert.equal(pageIsHidden({ hidden: true, visibilityState: "visible" }), true);
    assert.equal(pageIsHidden({ hidden: false, visibilityState: "hidden" }), true);
    assert.equal(pageIsHidden({ hidden: false, visibilityState: "prerender" }), true);
    assert.equal(shouldPauseForBackground({ hidden: false, visibilityState: "visible" }, true), true);
    assert.equal(shouldPauseForBackground({ hidden: false, visibilityState: "visible" }, false), false);
  });

  it("hidden-tab resume does not skip the race clock", () => {
    const go = 1_000;
    const hiddenAt = 4_000;
    const hold = wallClockMs(0, go, hiddenAt);
    const shown = 20_000;
    assert.equal(hold, 3_000);
    assert.equal(wallClockMs(hold, shown, shown + 100), hold + 100);
  });

  it("ticks countdown from Start without waiting for a later stamp", () => {
    const start = 4_000;
    assert.ok(countdownRemaining(start, start) > 2);
    assert.ok(countdownRemaining(start, start + 1000) < 1.5);
    assert.ok(countdownRemaining(start, start + COUNTDOWN_S * 1000) <= 0);
    const paused = countdownRemaining(start, start + 800);
    const resumedAt = 20_000;
    const at = countdownPausedAt(resumedAt, paused);
    assert.ok(Math.abs(countdownRemaining(at, resumedAt) - paused) < 1e-9);
  });
});
