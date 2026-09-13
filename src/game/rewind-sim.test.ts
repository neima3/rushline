import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CarSim } from "./physics.ts";
import { getTrack } from "./track.ts";

describe("rewind sim restore", () => {
  it("restores pose and gates without touching Track Assist", () => {
    const track = getTrack("circuit");
    const car = new CarSim();
    car.reset(track);
    car.trackAssist = "high";
    car.s = 86;
    car.n = 1.1;
    car.heading = 0.2;
    car.speed = 24;
    car.lastCp = 0;
    car.lap = 2;
    car.surface = "ice";
    const snap = car.captureSim();

    car.s = 240;
    car.n = -2;
    car.lastCp = 2;
    car.lap = 1;
    car.speed = 4;
    car.trackAssist = "off";
    car.restoreSim(snap);

    assert.equal(car.s, 86);
    assert.equal(car.n, 1.1);
    assert.equal(car.heading, 0.2);
    assert.equal(car.speed, 24);
    assert.equal(car.lastCp, 0);
    assert.equal(car.lap, 2);
    assert.equal(car.surface, "ice");
    assert.equal(car.captureSim().recoverLock, snap.recoverLock);
    assert.equal(car.trackAssist, "off");
    assert.equal(car.justFinish, false);
    assert.equal(car.justRespawn, false);
    assert.equal(car.skipInterp, true);
  });
});
