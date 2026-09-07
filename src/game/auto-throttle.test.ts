import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyTouchDrive,
  autoThrottleCap,
  clampTouchSpeed,
  hitDrivePad,
  HOLD_CANCEL_GRACE_MS,
  isSpuriousHoldEnd,
  latchBrake,
  reduceHold,
  resolveRaceDrive,
  resolveSampleDrive,
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
    const cruise = autoThrottleCap({
      trackId: "canyon",
      s: 200,
      speed: 18,
      firstCp: 147,
      touchMode: true,
      countdown: false,
    });
    const held = autoThrottleCap({
      trackId: "canyon",
      s: 200,
      speed: 30,
      firstCp: 147,
      touchMode: true,
      countdown: false,
    });
    assert.ok(cruise >= 0.48 && cruise <= 0.5, `cruise ${cruise}`);
    assert.ok(held < cruise, "high-speed cruise should bleed instead of cliffing");
    assert.ok(held >= 0.2 && held <= 0.28, `held ${held}`);
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
    const faster = autoThrottleCap({
      trackId: "circuit",
      s: 20,
      speed: 26,
      firstCp: 80,
      touchMode: true,
      countdown: false,
    });
    assert.ok(early < 0.28, `early ${early}`);
    assert.ok(faster <= 0.16, `faster ${faster}`);
    assert.ok(faster < early);
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
    assert.equal(shouldReleaseHold("pointerup", 1800, cancelUntil), false);
    assert.equal(shouldReleaseHold("pointerup", 1800, cancelUntil, 0, "touch"), false);
    assert.equal(shouldReleaseHold("pointerup", 1800, cancelUntil, 0, "mouse"), true);
    assert.equal(shouldReleaseHold("touchend", 1800, cancelUntil), true);
  });

  it("never releases on a solitary ghost pointerup when grace is unarmed", () => {
    assert.equal(shouldReleaseHold("pointerup", 80, 0, 0), false);
    assert.equal(shouldReleaseHold("pointerup", 80, 0, 0, "touch"), false);
    assert.equal(shouldReleaseHold("touchend", 80, 0, 0), false);
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
    s = reduceHold(s, { type: "pointerup", now: 8410, remainingTouches: 0, pointerType: "touch" });
    assert.equal(s.held, true);
    s = reduceHold(s, { type: "pointerup", now: 31000, remainingTouches: 0, pointerType: "touch" });
    assert.equal(s.held, true, "late ghost pointerup must not release a touch hold");
    s = reduceHold(s, { type: "touchend", now: 31100, remainingTouches: 0 });
    assert.equal(s.held, false);
  });

  it("stays held on ghost pointerup with no prior cancel, then releases on a real lift after 1s", () => {
    let s = reduceHold({ held: false, cancelUntil: 0 }, { type: "pointerdown", now: 1000, pointerId: 7 });
    assert.ok(s.cancelUntil > 1000, "down must arm grace even without cancel");
    s = reduceHold(s, { type: "pointerup", now: 1016, remainingTouches: 0, pointerType: "touch", pointerId: 7 });
    assert.equal(s.held, true, "ghost pointerup (no cancel) must not clear the latch");
    s = reduceHold(s, { type: "pointercancel", now: 1100 });
    s = reduceHold(s, { type: "lostpointercapture", now: 1101 });
    s = reduceHold(s, { type: "pointerup", now: 1104, remainingTouches: 0, pointerType: "touch", pointerId: 7 });
    s = reduceHold(s, { type: "touchend", now: 1108, remainingTouches: 0 });
    assert.equal(s.held, true, "cancel storm must not clear the latch");
    s = reduceHold(s, { type: "pointerup", now: 4000, remainingTouches: 0, pointerType: "touch", pointerId: 7 });
    assert.equal(s.held, true, "late solitary pointerup after grace is still ghost");
    s = reduceHold(s, { type: "touchend", now: 4100, remainingTouches: 0 });
    assert.equal(s.held, false, "confirmed touchend after 1s with zero touches must release");
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

  it("ghost pointerup without cancel keeps touchBrake latched so Auto speed falls", () => {
    let hold = reduceHold({ held: false, cancelUntil: 0 }, { type: "pointerdown", now: 1000 });
    hold = reduceHold(hold, { type: "pointerup", now: 1016, remainingTouches: 0 });
    assert.equal(hold.held, true);

    let speed = 17.2;
    let prev = speed;
    for (let i = 0; i < 180; i++) {
      const now = 1020 + i * (1000 / 60);
      if (i === 20) {
        hold = reduceHold(hold, { type: "pointercancel", now });
        hold = reduceHold(hold, { type: "lostpointercapture", now: now + 1 });
        hold = reduceHold(hold, { type: "pointerup", now: now + 2, remainingTouches: 0, pointerType: "touch" });
      }
      if (i === 120) {
        hold = reduceHold(hold, { type: "pointerup", now, remainingTouches: 0, pointerType: "touch" });
      }
      const touchBrake = hold.held ? 1 : 0;
      const filled = touchBrake > 0 ? 0 : 0.5;
      const drive = applyTouchDrive({
        throttle: filled,
        brake: touchBrake,
        touchBrake,
        autoThrottle: true,
        manualThrottle: 0,
        cap: 0.5,
      });
      assert.equal(hold.held, true, `latch dropped at step ${i}`);
      assert.equal(drive.throttle, 0, `auto-throttle re-armed at step ${i}`);
      assert.equal(drive.brake, 1);
      speed = stepLongitudinalSpeed(speed, drive.throttle, drive.brake, 1 / 60);
      if (speed > 0.4) {
        assert.ok(speed < prev, `speed rose at step ${i}: ${prev} → ${speed}`);
      }
      prev = speed;
    }
    assert.ok(speed < 8, `expected a continuous drop from ~62 km/h, got ${speed}`);
  });

  // Manual QA: toggle Auto accel off and hold Accel — do not treat Auto cruise
  // as an Accel PASS. Same latch as Brake; ghost pointerup must keep throttle=1.
  it("Manual Accel hold stays latched through ghost pointerup (not Auto smoke)", () => {
    let hold = reduceHold({ held: false, cancelUntil: 0 }, { type: "pointerdown", now: 1000 });
    hold = reduceHold(hold, { type: "pointerup", now: 1016, remainingTouches: 0 });
    assert.equal(hold.held, true);
    const drive = applyTouchDrive({
      throttle: hold.held ? 1 : 0,
      brake: 0,
      touchBrake: 0,
      autoThrottle: false,
      manualThrottle: hold.held ? 1 : 0,
      cap: 0.5,
    });
    assert.equal(drive.throttle, 1);
    assert.equal(drive.brake, 0);
  });

  it("mouse pointerup after grace is a confirmed lift", () => {
    let s = reduceHold({ held: false, cancelUntil: 0 }, { type: "pointerdown", now: 1000, pointerType: "mouse" });
    s = reduceHold(s, { type: "pointerup", now: 2000, remainingTouches: 0, pointerType: "mouse" });
    assert.equal(s.held, false);
  });
});

const QA_PADS = {
  slide: { left: 0, top: 0, right: 96, bottom: 56 },
  brake: { left: 0, top: 64, right: 96, bottom: 120 },
  accel: { left: 0, top: 128, right: 96, bottom: 184 },
};

describe("hitDrivePad", () => {
  it("prefers Brake on the Accel/Brake seam so Accel cannot steal", () => {
    assert.equal(hitDrivePad(48, 148, QA_PADS), "accel");
    assert.equal(hitDrivePad(48, 92, QA_PADS), "brake");
    assert.equal(hitDrivePad(48, 124, QA_PADS), "brake");
  });

  it("inflates Accel/Slide but still loses the seam to Brake", () => {
    assert.equal(hitDrivePad(48, 132, QA_PADS), "brake", "inside Accel but in Brake slop");
    assert.equal(hitDrivePad(-6, 148, QA_PADS), "accel", "fat-finger just left of Accel");
    assert.equal(hitDrivePad(48, -6, QA_PADS), "slide");
    assert.equal(hitDrivePad(48, 188, QA_PADS), "accel");
  });
});

describe("resolveSampleDrive + resolveRaceDrive (post-#13 wiring)", () => {
  it("touchBrake is not inverted: 1 means brake, 0 lets Auto fill", () => {
    const held = resolveSampleDrive({
      throttle: 0,
      brake: 0,
      touchThrottle: 0,
      touchBrake: 1,
      autoThrottle: true,
      touchMode: true,
      now: 0,
      latchUntil: 0,
    });
    assert.equal(held.throttle, 0, "inverted wiring would treat hold as throttle");
    assert.equal(held.brake, 1);

    const released = resolveSampleDrive({
      throttle: 0,
      brake: 0,
      touchThrottle: 0,
      touchBrake: 0,
      autoThrottle: true,
      touchMode: true,
      now: 10_000,
      latchUntil: 0,
    });
    assert.ok(released.throttle >= 0.5, "Auto must still fill when Brake is up");
    assert.equal(released.brake, 0);
  });

  it("Auto does not refill after applyTouchDrive while touchBrake is asserted", () => {
    const race = resolveRaceDrive({
      throttle: 0.5,
      brake: 0,
      touchThrottle: 0,
      touchBrake: 1,
      autoThrottle: true,
      touchMode: true,
      now: 0,
      latchUntil: 0,
      cap: 1,
    });
    assert.equal(race.throttle, 0);
    assert.equal(race.brake, 1);
  });

  it("zeros throttle every frame while touchBrake is held under Auto, even if Accel is also 1", () => {
    let latchUntil = 0;
    for (let i = 0; i < 180; i++) {
      const now = 1000 + i * (1000 / 60);
      const sampled = resolveSampleDrive({
        throttle: 0,
        brake: 0,
        touchThrottle: 1,
        touchBrake: 1,
        autoThrottle: true,
        touchMode: true,
        now,
        latchUntil,
      });
      latchUntil = sampled.latchUntil;
      assert.equal(sampled.throttle, 0, `sample throttle at ${i}`);
      assert.equal(sampled.brake, 1, `sample brake at ${i}`);
      assert.equal(sampled.touchThrottle, 0);
      const drive = applyTouchDrive({
        throttle: sampled.throttle,
        brake: sampled.brake,
        touchBrake: 1,
        autoThrottle: true,
        manualThrottle: sampled.manualThrottle,
        cap: 0.5,
      });
      assert.equal(drive.throttle, 0, `loop throttle at ${i}`);
      assert.equal(drive.brake, 1);
    }
  });

  it("post-#13 FAIL: speed falls for 3s after Accel→Brake move + late touch pointerup (no touchend)", () => {
    let hold = reduceHold({ held: false, cancelUntil: 0 }, { type: "pointerdown", now: 0, pointerType: "touch" });
    let kind = hitDrivePad(48, 148, QA_PADS);
    assert.equal(kind, "accel");

    let speed = 17.8;
    let prev = speed;
    let latchUntil = 0;

    for (let i = 0; i < 180; i++) {
      const now = i * (1000 / 60);
      if (i === 18) kind = hitDrivePad(48, 92, QA_PADS);
      if (i === 20) {
        hold = reduceHold(hold, { type: "pointercancel", now, pointerType: "touch" });
        hold = reduceHold(hold, { type: "lostpointercapture", now: now + 1, pointerType: "touch" });
        hold = reduceHold(hold, { type: "pointerup", now: now + 2, remainingTouches: 0, pointerType: "touch" });
      }
      if (i === 90) {
        hold = reduceHold(hold, { type: "pointerup", now, remainingTouches: 0, pointerType: "touch" });
      }
      assert.equal(hold.held, true, `hold dropped at frame ${i}`);

      const touchBrake = hold.held && kind === "brake" ? 1 : 0;
      const touchThrottle = hold.held && kind === "accel" ? 1 : 0;
      const race = resolveRaceDrive({
        throttle: 0,
        brake: 0,
        touchThrottle,
        touchBrake,
        autoThrottle: true,
        touchMode: true,
        now,
        latchUntil,
        cap: 0.5,
      });
      latchUntil = race.latchUntil;

      if (i >= 18) {
        assert.equal(kind, "brake");
        assert.equal(race.throttle, 0, `Auto/Accel wrote throttle at frame ${i}`);
        assert.equal(race.brake, 1, `brake not latched at frame ${i}`);
        speed = stepLongitudinalSpeed(speed, race.throttle, race.brake, 1 / 60);
        if (speed > 0.4) {
          assert.ok(speed < prev + 1e-9, `speed rose ${prev} → ${speed} at frame ${i}`);
        }
        prev = speed;
      } else {
        speed = stepLongitudinalSpeed(speed, race.throttle, race.brake, 1 / 60);
        prev = speed;
      }
    }
    assert.ok(speed < 10, `expected a drop from ~64 km/h under Brake, got ${speed} m/s`);
  });

  it("keeps Manual Accel (Auto off) when touchBrake is up", () => {
    const race = resolveRaceDrive({
      throttle: 0,
      brake: 0,
      touchThrottle: 1,
      touchBrake: 0,
      autoThrottle: false,
      touchMode: true,
      now: 0,
      latchUntil: 0,
      cap: 0.5,
    });
    assert.equal(race.throttle, 1);
    assert.equal(race.brake, 0);
  });
});
