import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { wallClockMs } from "./clock.ts";
import {
  REWIND_MAX_FRAMES,
  REWIND_TOUCH_MAX_FRAMES,
  REWIND_TOUCH_WINDOW_MS,
  REWIND_WINDOW_MS,
  RewindTape,
  finishCountsAsPb,
  nextRewindTime,
  pinRaceClock,
  rewindLimits,
  sampleTape,
  trimRecording,
  type RewindCar,
  type RewindFrame,
} from "./rewind.ts";
import type { GhostFrame } from "./types.ts";

function car(s: number): RewindCar {
  return {
    s,
    n: 0,
    heading: 0,
    speed: 12,
    airborne: false,
    vx: 0,
    vy: 0,
    vz: 0,
    px: s,
    py: 1,
    pz: 0,
    qx: 0,
    qy: 0,
    qz: 0,
    qw: 1,
    yaw: 0,
    boost: 0,
    slideAmt: 0,
    driftCharge: 0,
    lastCp: s > 80 ? 0 : -1,
    lap: 1,
    finished: false,
    wrongWay: 0,
    fx: 0,
    fy: 0,
    fz: -1,
    ux: 0,
    uy: 1,
    uz: 0,
    wallHit: 0,
    wasSlide: false,
    slideLatched: false,
    airTime: 0,
    landLock: 0,
    airBlend: 0,
    recoverLock: 0,
    boostPunch: 0,
    surface: "plastic",
  };
}

function ghost(n: number, step = 40): GhostFrame[] {
  return Array.from({ length: n }, (_, i) => ({ t: i * step, s: i * 2, n: 0, heading: 0 }));
}

describe("rewind limits", () => {
  it("keeps a 6–10s window and a hard frame cap", () => {
    const desk = rewindLimits(false);
    const touch = rewindLimits(true);
    assert.ok(desk.windowMs >= 6000 && desk.windowMs <= 10_000);
    assert.ok(touch.windowMs >= 6000 && touch.windowMs <= 10_000);
    assert.equal(desk.windowMs, REWIND_WINDOW_MS);
    assert.equal(touch.windowMs, REWIND_TOUCH_WINDOW_MS);
    assert.ok(desk.maxFrames <= REWIND_MAX_FRAMES);
    assert.ok(touch.maxFrames <= REWIND_TOUCH_MAX_FRAMES);
    assert.ok(touch.maxFrames < desk.maxFrames);
  });
});

describe("RewindTape", () => {
  it("records, samples, and trims so ghost compare stays on the same clock", () => {
    const tape = new RewindTape(false);
    for (let t = 0; t <= 4000; t += 40) tape.record(t, car(t / 20));
    assert.ok(tape.canRewind());
    assert.ok(tape.spanMs() >= 3500);
    const at = tape.sample(2500);
    assert.ok(at);
    assert.ok(Math.abs(at!.t - 2500) < 50);
    tape.truncateTo(2500);
    assert.ok(tape.newestT() <= 2500);
    assert.equal(tape.sample(4000)?.t, tape.newestT());
  });

  it("caps memory and drops frames older than the window", () => {
    const tape = new RewindTape(true);
    for (let t = 0; t <= 20_000; t += 16) tape.record(t, car(t / 10));
    assert.ok(tape.length <= REWIND_TOUCH_MAX_FRAMES);
    assert.ok(tape.spanMs() <= REWIND_TOUCH_WINDOW_MS + 80);
    assert.ok(tape.oldestT() >= 20_000 - REWIND_TOUCH_WINDOW_MS - 80);
  });

  it("does not rewind until a short span exists", () => {
    const tape = new RewindTape();
    tape.record(0, car(0));
    assert.equal(tape.canRewind(), false);
    tape.record(40, car(2));
    assert.equal(tape.canRewind(), false);
    tape.record(200, car(8));
    assert.equal(tape.canRewind(), true);
  });
});

describe("rewind clock + ghost tape", () => {
  it("pins the race clock so HUD time walks backward then continues", () => {
    const go = 10_000;
    const now = go + 5000;
    const live = wallClockMs(0, go, now);
    assert.equal(live, 5000);
    const target = nextRewindTime(live, 0.4, 500);
    assert.ok(target < live);
    assert.ok(target >= 500);
    const pin = pinRaceClock(target, 40_000);
    assert.equal(wallClockMs(pin.hold, pin.startedAt, 40_000), target);
    assert.equal(wallClockMs(pin.hold, pin.startedAt, 40_200), target + 200);
  });

  it("trims the recorded ghost so compare samples the rewound stamp", () => {
    const frames = ghost(80);
    const cut = trimRecording(frames, 1200);
    assert.ok(cut.length < frames.length);
    assert.ok(cut[cut.length - 1]!.t <= 1200);
    const tape: RewindFrame[] = frames.map((f) => ({ t: f.t, car: car(f.s) }));
    const pose = sampleTape(tape, 1200);
    assert.ok(pose);
    assert.ok(pose!.t <= 1200);
  });
});

describe("rewind does not invalidate a PB", () => {
  it("only a finished time after rewind can replace the standing best", () => {
    assert.equal(finishCountsAsPb(48_000, 52_000, true), true);
    assert.equal(finishCountsAsPb(54_000, 52_000, true), false);
    assert.equal(finishCountsAsPb(52_000, null, true), true);
    assert.equal(finishCountsAsPb(0, 52_000, true), false);
    const cut = trimRecording(ghost(80), 1600);
    assert.ok(cut.length < 80);
    assert.ok(cut[cut.length - 1]!.t <= 1600);
  });
});
