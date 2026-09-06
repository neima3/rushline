import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CarSim, pickSafeRespawnS } from "./physics.ts";
import { getTrack, nearestSample, sampleAt } from "./track.ts";

describe("circuit pre-CP1 respawn", () => {
  const track = getTrack("circuit");

  it("snaps lastCp=-1 near the start onto the outbound centerline, not the wrap", () => {
    const s = pickSafeRespawnS(track, -1, 8);
    const sm = sampleAt(track, s);
    assert.ok(s >= 12 && s < 50, `s=${s}`);
    assert.ok(Math.abs(sm.x) < 0.35, `x=${sm.x}`);
    assert.ok(sm.tz < -0.9, `tz=${sm.tz}`);
    assert.ok(sm.uy > 0.95, `uy=${sm.uy}`);
  });

  it("keeps a mid-sector pre-CP1 snap on the local ribbon instead of the start seam", () => {
    const s = pickSafeRespawnS(track, -1, 140);
    const sm = sampleAt(track, s);
    assert.ok(s > 120 && s < 160, `s=${s}`);
    assert.ok(sm.uy > 0.9, `uy=${sm.uy}`);
    assert.ok(Math.abs(sm.x) > 40, `expected first-curve x, got ${sm.x}`);
  });

  it("leaves post-CP1 recovery on the checkpoint sample", () => {
    const s = pickSafeRespawnS(track, 0);
    assert.ok(Math.abs(s - (track.checkpoints[0]! + 2)) < 8, `s=${s}`);
  });

  it("places the car at n=0 facing forward after R", () => {
    const car = new CarSim();
    car.reset(track);
    car.s = 22;
    car.n = -9;
    car.lastCp = -1;
    car.respawn(track);
    assert.equal(car.n, 0);
    assert.equal(car.heading, 0);
    assert.ok(Math.abs(car.px) < 0.4, `px=${car.px}`);
    assert.ok(car.fz < -0.9, `fz=${car.fz}`);
    assert.ok(car.uy > 0.9, `uy=${car.uy}`);
  });

  it("does not pick the closing stretch from either shoulder near the start", () => {
    const left = nearestSample(track, -10, 0.4, -8, 8);
    const right = nearestSample(track, 10, 0.4, -8, 8);
    assert.ok(left.tz < -0.85, `left tz=${left.tz} s=${left.s}`);
    assert.ok(right.tz < -0.85, `right tz=${right.tz} s=${right.s}`);
    assert.ok(left.s < 80 && right.s < 80);
  });
});
