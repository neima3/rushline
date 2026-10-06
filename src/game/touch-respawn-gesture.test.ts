import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  peekTouchRespawnGesture,
  resetTouchRespawnGesture,
  touchRespawnHoldRestart,
  touchRespawnPointerDown,
  touchRespawnPointerRelease,
  touchRespawnPointerUp,
  touchRespawnSuppressed,
} from "./touch-respawn-gesture.ts";
import {
  DEFAULT_HOLD_MS,
  simulateLegacyComponentHold,
  simulateModuleRemountHold,
  simulateModuleTap,
  simulateStuckThenTap,
} from "./touch-respawn-sim.ts";

afterEach(() => resetTouchRespawnGesture());

describe("touch respawn gesture", () => {
  it("tap: down then up respawns once", () => {
    assert.equal(touchRespawnPointerDown(7), "new");
    assert.equal(touchRespawnSuppressed(), false);
    assert.equal(touchRespawnPointerUp(7), "respawn");
    assert.equal(peekTouchRespawnGesture(), null);
  });

  it("hold restart: suppresses respawn on release for the same pointer", () => {
    touchRespawnPointerDown(3);
    touchRespawnHoldRestart(3);
    assert.equal(touchRespawnSuppressed(), true);
    assert.equal(touchRespawnPointerUp(3), "none");
    assert.equal(touchRespawnSuppressed(), false);
  });

  it("duplicate pointerdown returns duplicate and keeps restartFired", () => {
    assert.equal(touchRespawnPointerDown(9), "new");
    touchRespawnHoldRestart(9);
    assert.equal(touchRespawnPointerDown(9), "duplicate");
    assert.equal(peekTouchRespawnGesture()?.restartFired, true);
    assert.equal(touchRespawnPointerUp(9), "none");
  });

  it("orphan pointer release clears stuck suppression", () => {
    touchRespawnPointerDown(1);
    touchRespawnHoldRestart(1);
    assert.equal(touchRespawnSuppressed(), true);
    touchRespawnPointerRelease(1);
    assert.equal(touchRespawnSuppressed(), false);
    assert.equal(touchRespawnPointerDown(1), "new");
    assert.equal(touchRespawnPointerUp(1), "respawn");
  });

  it("mismatched pointer up does not clear an active hold-restart gesture", () => {
    touchRespawnPointerDown(1);
    touchRespawnHoldRestart(1);
    assert.equal(touchRespawnPointerUp(2), "none");
    assert.equal(touchRespawnSuppressed(), true);
    assert.equal(touchRespawnPointerUp(1), "none");
  });
});

describe("remount hold simulation", () => {
  const holdMs = DEFAULT_HOLD_MS;
  const remountAt = holdMs + 40;
  const longRelease = 3000;
  const shortRelease = holdMs + 120;

  it("legacy component model: remount re-arms timer (double restart on long hold)", () => {
    const legacy = simulateLegacyComponentHold(holdMs, remountAt, longRelease);
    assert.ok(legacy.restarts >= 2, `expected ≥2 restarts, got ${legacy.restarts}`);
  });

  it("legacy component model: remount before second timer → spurious respawn on release", () => {
    const legacy = simulateLegacyComponentHold(holdMs, remountAt, shortRelease);
    assert.equal(legacy.restarts, 1);
    assert.equal(legacy.respawns, 1);
  });

  it("module model: 3s hold with duplicate down → one restart, zero respawns", () => {
    const fixed = simulateModuleRemountHold(5, holdMs, remountAt, longRelease);
    assert.equal(fixed.restarts, 1);
    assert.equal(fixed.respawns, 0);
  });

  it("module tap still respawns once", () => {
    const tap = simulateModuleTap(2);
    assert.equal(tap.restarts, 0);
    assert.equal(tap.respawns, 1);
  });

  it("tap after stuck gesture (window release) still respawns", () => {
    const after = simulateStuckThenTap(1);
    assert.equal(after.restarts, 0);
    assert.equal(after.respawns, 1);
  });
});
