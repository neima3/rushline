import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyTouchDrive,
  autoThrottleCap,
  clampTouchSpeed,
  HOLD_CANCEL_GRACE_MS,
  isSpuriousHoldEnd,
  latchBrake,
  reduceHold,
  shouldReleaseHold,
  stepLongitudinalSpeed,
} from "./auto-throttle.ts";

describe("autoThrottleCap", () => {
  it("holds the car during countdown", () => {
    assert.equal(
      autoThrottleCap({
        trackId: "canyon",
        s: 6,
        speed: 0,
        firstCp: 147,
        touchMode: true,
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
      touchMode: true,
      countdown: false,
    });
    const held = autoThrottleCap({
      trackId: "canyon",
      s: 40,
      speed: 22,
      firstCp: 147,
      touchMode: true,
      countdown: false,
    });
    assert.ok(opening <= 0.38);
    assert.ok(held <= 0.14);
  });

  it("restores touch cruise after the Ridge settle", () => {
    const after = autoThrottleCap({
      trackId: "canyon",
      s: 200,
      speed: 30,
      firstCp: 147,
      touchMode: true,
      countdown: false,
    });
    assert.equal(after, 0.5);
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

  it("keeps mobile Circuit opening cap", () => {
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

describe("isSpuriousHoldEnd", () => {
  it("ignores canvas-focus and Safari cancel events so Accel stays held", () => {
    assert.equal(isSpuriousHoldEnd("pointercancel"), true);
    assert.equal(isSpuriousHoldEnd("touchcancel"), true);
    assert.equal(isSpuriousHoldEnd("lostpointercapture"), true);
    assert.equal(isSpuriousHoldEnd("pointerup"), false);
    assert.equal(isSpuriousHoldEnd("touchend"), false);
  });
});

describe("clampTouchSpeed", () => {
  it("does not let touch brake reverse from a crawl", () => {
    assert.equal(clampTouchSpeed(-2, true), 0);
    assert.equal(clampTouchSpeed(4, true), 4);
    assert.equal(clampTouchSpeed(-2, false), -2);
  });
});

describe("latchBrake", () => {
  it("cuts throttle and holds brake through a brief pointer drop", () => {
    const down = latchBrake(1000, 1, 0);
    assert.equal(down.cutThrottle, true);
    assert.equal(down.brake, 1);
    const blip = latchBrake(1200, 0, down.latchUntil);
    assert.equal(blip.cutThrottle, true);
    assert.equal(blip.brake, 1);
    const after = latchBrake(1600, 0, blip.latchUntil);
    assert.equal(after.cutThrottle, false);
    assert.equal(after.brake, 0);
  });
});

describe("shouldReleaseHold", () => {
  it("keeps Accel/Brake held through Safari cancel then ghost touchend", () => {
    const cancelUntil = 1000 + HOLD_CANCEL_GRACE_MS;
    assert.equal(shouldReleaseHold("pointercancel", 1010, cancelUntil), false);
    assert.equal(shouldReleaseHold("touchcancel", 1010, cancelUntil), false);
    assert.equal(shouldReleaseHold("lostpointercapture", 1010, cancelUntil), false);
    assert.equal(shouldReleaseHold("touchend", 1100, cancelUntil), false);
    assert.equal(shouldReleaseHold("touchend", 1100, cancelUntil, 1), false);
    assert.equal(shouldReleaseHold("pointerup", 1100, cancelUntil), false);
    assert.equal(shouldReleaseHold("pointerup", 1800, cancelUntil), true);
    assert.equal(shouldReleaseHold("touchend", 1800, cancelUntil), true);
  });
});

describe("reduceHold", () => {
  it("stays latched through an iOS cancel storm including ghost pointerup", () => {
    let s = { held: false, cancelUntil: 0 };
    s = reduceHold(s, { type: "pointerdown", now: 1000 });
    assert.equal(s.held, true);
    s = reduceHold(s, { type: "pointercancel", now: 1012 });
    s = reduceHold(s, { type: "lostpointercapture", now: 1013 });
    s = reduceHold(s, { type: "pointerup", now: 1015, remainingTouches: 0 });
    s = reduceHold(s, { type: "touchend", now: 1018, remainingTouches: 0 });
    assert.equal(s.held, true);
    s = reduceHold(s, { type: "pointercancel", now: 8400 });
    s = reduceHold(s, { type: "pointerup", now: 8410, remainingTouches: 0 });
    assert.equal(s.held, true);
    s = reduceHold(s, { type: "pointerup", now: 31000, remainingTouches: 0 });
    assert.equal(s.held, false);
  });

  it("still ends Accel/Brake on a clean pointerup (no cancel)", () => {
    let s = reduceHold({ held: false, cancelUntil: 0 }, { type: "pointerdown", now: 0 });
    s = reduceHold(s, { type: "pointerup", now: 80, remainingTouches: 0 });
    assert.equal(s.held, false);
  });
});

describe("applyTouchDrive + auto-throttle", () => {
  it("keeps throttle at 0 and speed falling while touchBrake is latched", () => {
    let speed = 17.5;
    let prev = speed;
    let latchUntil = 0;
    const touchBrake = 1;
    for (let i = 0; i < 180; i++) {
      const now = 1000 + i * (1000 / 60);
      const latched = latchBrake(now, touchBrake, latchUntil);
      latchUntil = latched.latchUntil;
      const filled = latched.cutThrottle ? 0 : 0.5;
      const drive = applyTouchDrive({
        throttle: filled,
        brake: latched.brake,
        touchBrake,
        autoThrottle: true,
        manualThrottle: 0,
        cap: 0.5,
      });
      assert.equal(drive.throttle, 0, `throttle re-armed at step ${i}`);
      assert.equal(drive.brake, 1);
      speed = stepLongitudinalSpeed(speed, drive.throttle, drive.brake, 1 / 60);
      if (speed > 0.4) {
        assert.ok(speed < prev, `speed rose at step ${i}: ${prev} → ${speed}`);
      }
      prev = speed;
    }
    assert.ok(speed < 8, `expected a continuous drop from ~63 km/h, got ${speed}`);
  });

  it("does not cut Accel when touchBrake is up", () => {
    const drive = applyTouchDrive({
      throttle: 1,
      brake: 0,
      touchBrake: 0,
      autoThrottle: true,
      manualThrottle: 1,
      cap: 0.5,
    });
    assert.equal(drive.throttle, 1);
    assert.equal(drive.brake, 0);
  });
});
