import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getTrack, sampleAt } from "./track.ts";
import { CarSim, helixNearGate, pickSafeRespawnS } from "./physics.ts";

const idle = {
  throttle: 0,
  brake: 0,
  steer: 0,
  slide: 0,
  respawn: false,
  restart: false,
  pause: false,
  camera: false,
  confirm: false,
  back: false,
  menuY: 0,
};

const cruise = { ...idle, throttle: 0.5 };

describe("mobile feel sims", () => {
  it("keeps Ridge opening on the ribbon through the first curve", () => {
    const canyon = getTrack("canyon");
    const car = new CarSim();
    car.reset(canyon);
    for (let i = 0; i < 240; i++) {
      const twitch = i % 50 < 3 ? 0.1 : 0;
      car.step(canyon, { ...cruise, steer: twitch }, 1 / 60);
      if (car.s < 110) {
        assert.equal(car.airborne, false, `airborne at s=${car.s}`);
        const sm = sampleAt(canyon, car.s);
        assert.ok(Math.abs(car.n) < sm.width * 0.45, `n ${car.n} at s=${car.s}`);
      }
    }
    assert.ok(car.s > 40, `expected to roll out, s=${car.s}`);
  });

  it("snaps Circuit back from the curb before leaving asphalt early", () => {
    const circuit = getTrack("circuit");
    const car = new CarSim();
    car.reset(circuit);
    car.s = 40;
    car.speed = 16;
    const sm = sampleAt(circuit, 40);
    car.n = sm.width * 0.5 - 0.85;
    car.heading = -0.22;
    const startN = Math.abs(car.n);
    for (let i = 0; i < 50; i++) car.step(circuit, cruise, 1 / 60);
    assert.equal(car.airborne, false);
    assert.ok(Math.abs(car.n) < startN, `n ${car.n} vs start ${startN}`);
    assert.ok(Math.abs(car.n) < sm.width * 0.5 - 0.55, `still on curb n=${car.n}`);
  });

  it("Off track assist does not racing-line pull Circuit off the curb", () => {
    const circuit = getTrack("circuit");
    const setup = (assist: "off" | "medium") => {
      const car = new CarSim();
      car.trackAssist = assist;
      car.reset(circuit);
      car.s = 40;
      car.speed = 16;
      car.n = sampleAt(circuit, 40).width * 0.5 - 0.85;
      car.heading = -0.22;
      return car;
    };
    const off = setup("off");
    const med = setup("medium");
    const startN = off.n;
    for (let i = 0; i < 12; i++) {
      off.step(circuit, cruise, 1 / 60);
      med.step(circuit, cruise, 1 / 60);
    }
    assert.ok(Math.abs(med.n) < Math.abs(startN), `medium should snap in, n=${med.n}`);
    assert.ok(Math.abs(off.n) > Math.abs(med.n), `off ${off.n} should stay wider than medium ${med.n}`);
  });

  it("does not change Helix post-CP1 R parking", () => {
    const helix = getTrack("helix");
    const cp1 = helix.checkpoints[0]!;
    const s = pickSafeRespawnS(helix, 0, cp1 + 8);
    assert.ok(s >= 128 && s <= 140, `post-CP1 island s ${s}`);
    assert.equal(helixNearGate(helix, s), false);
  });
});
