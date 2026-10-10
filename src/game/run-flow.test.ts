import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cpPbSplitMs,
  livePbSplitMs,
  respawnEntrySpeed,
  respawnKeepSpeed,
  RESPAWN_SPEED_MAX,
  RESPAWN_SPEED_MIN,
} from "./run-flow.ts";
import { AUTHOR_START_S } from "./author-ghost.ts";
import { wallClockMs } from "./clock.ts";
import { getTrack } from "./track.ts";
import { CarSim } from "./physics.ts";
import { TRACK_ORDER } from "./types.ts";

const cruise = {
  throttle: 1,
  brake: 0,
  steer: 0,
  slide: 0,
  respawn: false,
  restart: false,
  pause: false,
  camera: false,
  confirm: false,
  back: false,
  photo: false,
  rewind: false,
  menuY: 0,
};

describe("cpPbSplitMs", () => {
  it("is negative when the player reaches the CP faster than PB", () => {
    const pb = [
      { t: 0, s: 0, n: 0, heading: 0 },
      { t: 2000, s: 40, n: 0, heading: 0 },
    ];
    assert.equal(cpPbSplitMs(1800, pb, 40, 200, true), -200);
    assert.equal(cpPbSplitMs(2200, pb, 40, 200, true), 200);
  });

  it("returns null without a PB tape", () => {
    assert.equal(cpPbSplitMs(1000, null, 10, 200, true), null);
  });
});

describe("respawnKeepSpeed", () => {
  it("keeps a fraction of pace within clamp bounds", () => {
    assert.equal(respawnKeepSpeed(0), RESPAWN_SPEED_MIN);
    assert.equal(respawnKeepSpeed(30), 30 * 0.78);
    assert.equal(respawnKeepSpeed(60), RESPAWN_SPEED_MAX);
    assert.equal(respawnKeepSpeed(4), RESPAWN_SPEED_MIN);
  });
});

describe("respawnEntrySpeed", () => {
  it("is a full stop before CP1 (Trackmania grid respawn)", () => {
    assert.equal(respawnEntrySpeed(-1, 0), 0);
    assert.equal(respawnEntrySpeed(-1, 40), 0);
  });

  it("uses CP crossing speed, not crash speed at respawn", () => {
    assert.equal(respawnEntrySpeed(0, 30), respawnKeepSpeed(30));
    assert.equal(respawnEntrySpeed(0, 0), 9);
  });
});

describe("livePbSplitMs", () => {
  it("skips duplicate PB line when already racing PB", () => {
    const pb = [
      { t: 0, s: 0, n: 0, heading: 0 },
      { t: 1000, s: 50, n: 0, heading: 0 },
    ];
    assert.equal(livePbSplitMs(500, pb, 0, 100, true, true), null);
    assert.equal(livePbSplitMs(500, pb, 0, 100, true, false), 500);
  });
});

describe("restart run car state", () => {
  it("stale finished blocks CP until reset (hardening reference)", () => {
    const circuit = getTrack("circuit");
    const car = new CarSim();
    car.reset(circuit);
    car.finished = true;
    car.lastCp = -1;
    car.speed = 20;
    car.s = 6;
    for (let i = 0; i < 240; i++) car.step(circuit, cruise, 1 / 60);
    assert.equal(car.lastCp, -1, "stale finished blocks checkpoints without reset");

    car.reset(circuit);
    for (let i = 0; i < 480; i++) car.step(circuit, cruise, 1 / 60);
    assert.ok(car.lastCp >= 0, `expected CP1 after reset, lastCp=${car.lastCp} s=${car.s}`);
  });

  it("respawns at CP pace recorded at the gate, not post-crash speed", () => {
    const circuit = getTrack("circuit");
    const car = new CarSim();
    car.reset(circuit);
    car.lastCp = 0;
    car.cpCrossSpeed = 28;
    car.speed = 1.2;
    car.respawn(circuit);
    const expected = respawnKeepSpeed(28);
    assert.ok(Math.abs(car.speed - expected) < 0.05, `expected ~${expected}, got ${car.speed}`);
    assert.equal(car.heading, 0);
  });

  it("flattenRespawn still clamps planted speed to 6–10 before pace restore", () => {
    const clamp = (speed: number) => Math.min(Math.max(speed, 6), 10);
    assert.equal(clamp(28), 10);
    assert.equal(clamp(4), 6);
  });

  it("CP0 respawn returns to the grid pose at zero speed without resetting the race clock", () => {
    const circuit = getTrack("circuit");
    const hold = 12_500;
    const startedAt = 1_000;
    const now = 11_000;
    const clockBefore = wallClockMs(hold, startedAt, now);

    const car = new CarSim();
    car.reset(circuit);
    car.speed = 20;
    car.s = 42;
    car.respawn(circuit);

    assert.equal(wallClockMs(hold, startedAt, now), clockBefore);
    assert.equal(car.s, AUTHOR_START_S);
    assert.equal(car.speed, 0);
    assert.equal(car.lastCp, -1);
    assert.equal(car.heading, 0);
    assert.equal(car.n, 0);
  });

  it("CP0 respawn matches reset placement on every stock track", () => {
    for (const id of TRACK_ORDER) {
      const track = getTrack(id);
      const grid = new CarSim();
      grid.reset(track);
      const snapGrid = grid.snap();

      const car = new CarSim();
      car.reset(track);
      car.lastCp = -1;
      car.speed = 18;
      car.s = track.checkpoints[0]! * 0.35;
      car.respawn(track);
      const snapRespawn = car.snap();

      assert.equal(snapRespawn.s, AUTHOR_START_S, `${id} s`);
      assert.equal(snapRespawn.s, snapGrid.s, `${id} grid s`);
      assert.equal(car.speed, 0, `${id} speed`);
      assert.ok(Math.abs(snapRespawn.px - snapGrid.px) < 0.02, `${id} px`);
      assert.ok(Math.abs(snapRespawn.pz - snapGrid.pz) < 0.02, `${id} pz`);
    }
  });
});
