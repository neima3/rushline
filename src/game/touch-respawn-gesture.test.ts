import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  peekTouchRespawnGesture,
  resetTouchRespawnGesture,
  touchRespawnHoldRestart,
  touchRespawnPointerDown,
  touchRespawnPointerUp,
  touchRespawnSuppressed,
} from "./touch-respawn-gesture.ts";

afterEach(() => resetTouchRespawnGesture());

describe("touch respawn gesture", () => {
  it("tap: down then up respawns once", () => {
    touchRespawnPointerDown(7);
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

  it("ignores duplicate pointerdown after remount (same pointer id)", () => {
    touchRespawnPointerDown(9);
    touchRespawnHoldRestart(9);
    touchRespawnPointerDown(9);
    assert.equal(peekTouchRespawnGesture()?.restartFired, true);
    assert.equal(touchRespawnPointerUp(9), "none");
  });

  it("mismatched pointer up does not clear an active hold-restart gesture", () => {
    touchRespawnPointerDown(1);
    touchRespawnHoldRestart(1);
    assert.equal(touchRespawnPointerUp(2), "none");
    assert.equal(touchRespawnSuppressed(), true);
    assert.equal(touchRespawnPointerUp(1), "none");
  });
});
