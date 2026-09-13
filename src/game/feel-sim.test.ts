import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getTrack, medalPace, sampleAt } from "./track.ts";
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

  it("Off assist still bleeds residual yaw after a steer pulse", () => {
    const circuit = getTrack("circuit");
    const car = new CarSim();
    car.trackAssist = "off";
    car.reset(circuit);
    car.s = 80;
    car.n = 0;
    car.speed = 18;
    for (let i = 0; i < 36; i++) car.step(circuit, { ...cruise, steer: 1 }, 1 / 60);
    const yawed = Math.abs(car.heading);
    assert.ok(yawed > 0.12, `heading after steer ${car.heading}`);
    for (let i = 0; i < 55; i++) car.step(circuit, { ...cruise, steer: 0 }, 1 / 60);
    assert.ok(Math.abs(car.heading) < yawed * 0.5, `residual ${car.heading} vs peak ${yawed}`);
  });

  it("does not change Helix post-CP1 R parking", () => {
    const helix = getTrack("helix");
    const cp1 = helix.checkpoints[0]!;
    const s = pickSafeRespawnS(helix, 0, cp1 + 8);
    assert.ok(s >= 128 && s <= 140, `post-CP1 island s ${s}`);
    assert.equal(helixNearGate(helix, s), false);
  });

  it("commits a slide through a steer dip, then snaps out on release", () => {
    const helix = getTrack("helix");
    const car = new CarSim();
    car.reset(helix);
    car.s = 36;
    car.n = 0;
    car.speed = 18;
    car.heading = 0.52;
    car.step(helix, { ...cruise, steer: 1, slide: 1 }, 1 / 60);
    const committed = Math.abs(car.heading);
    assert.ok(committed > 0.4, `committed heading ${car.heading}`);
    for (let i = 0; i < 18; i++) car.step(helix, { ...cruise, steer: 0.08, slide: 1 }, 1 / 60);
    assert.ok(Math.abs(car.heading) > committed * 0.55, `lost the slide on a dip ${car.heading}`);
    const held = Math.abs(car.heading);
    for (let i = 0; i < 18; i++) car.step(helix, { ...cruise, steer: 0, slide: 0 }, 1 / 60);
    assert.ok(Math.abs(car.heading) < held * 0.45, `exit still mushy ${car.heading} vs ${held}`);
  });

  it("air settle damps residual yaw and ribbon-pull is extra gravity, not hover", () => {
    const canyon = getTrack("canyon");
    const car = new CarSim();
    car.reset(canyon);
    const sm = sampleAt(canyon, 90);
    car.airborne = true;
    car.s = sm.s;
    car.n = 0;
    car.heading = 0.42;
    car.px = sm.x + sm.ux * 8;
    car.py = sm.y + sm.uy * 8;
    car.pz = sm.z + sm.uz * 8;
    car.vx = sm.tx * 16;
    car.vy = sm.ty * 16 - 2;
    car.vz = sm.tz * 16;
    car.fx = sm.tx;
    car.fy = sm.ty;
    car.fz = sm.tz;
    const startVy = car.vy;
    const startHead = Math.abs(car.heading);
    for (let i = 0; i < 12; i++) car.step(canyon, idle, 1 / 60);
    assert.equal(car.airborne, true, "must stay in the air for the line check");
    assert.ok(Math.abs(car.heading) < startHead * 0.75, `air yaw did not settle ${car.heading}`);
    const gravityOnly = startVy - 30 * (12 / 60);
    assert.ok(car.vy < gravityOnly - 0.35, `expected extra drop, vy ${car.vy} vs gravity ${gravityOnly}`);
  });

  it("medal pace drops Author then Gold without rewriting finish medals", () => {
    const grid = medalPace("circuit", 0);
    assert.equal(grid.holding, "author");
    assert.ok(grid.remain != null && grid.remain >= 50_000);

    const early = medalPace("circuit", 1_000);
    assert.equal(early.holding, "author");
    assert.ok(early.remain != null && early.remain > 40_000);
    assert.equal(early.lost.length, 0);

    const gold = medalPace("circuit", 51_000);
    assert.equal(gold.holding, "gold");
    assert.deepEqual(gold.lost, ["author"]);

    const miss = medalPace("circuit", 90_000);
    assert.equal(miss.holding, null);
    assert.equal(miss.remain, null);
    assert.equal(miss.lost.length, 4);
  });

  it("latches a boost-pad hit across extra phys steps until consumed", () => {
    const circuit = getTrack("circuit");
    const pad = circuit.boosts[0];
    assert.ok(pad != null, "circuit has a boost pad");
    const car = new CarSim();
    car.reset(circuit);
    car.s = pad!;
    car.n = 0;
    car.speed = 16;
    const before = car.speed;
    car.step(circuit, cruise, 1 / 60);
    const hit = car.justBoost;
    const firstGain = car.speed - before;
    assert.equal(hit, true, "expected a pad hit");
    assert.ok(firstGain > 0.4, `punch started ${firstGain}`);
    assert.ok(firstGain < 4.2, `punch should not dump all +5 in one step, got ${firstGain}`);
    for (let i = 0; i < 4; i++) car.step(circuit, cruise, 1 / 60);
    const latched = car.snap();
    assert.equal(latched.justBoost, true, "pulse should survive extra steps");
    car.clearFeelPulses();
    assert.equal(car.snap().justBoost, false);
  });

  it("plants from a short drop without the old magnet dump", () => {
    const canyon = getTrack("canyon");
    const car = new CarSim();
    car.reset(canyon);
    const sm = sampleAt(canyon, 80);
    car.s = sm.s;
    car.n = 0;
    car.airborne = true;
    car.px = sm.x + sm.ux * 1.7;
    car.py = sm.y + sm.uy * 1.7;
    car.pz = sm.z + sm.uz * 1.7;
    car.vx = sm.tx * 24;
    car.vy = sm.ty * 24 - 2;
    car.vz = sm.tz * 24;
    car.fx = sm.tx;
    car.fy = sm.ty;
    car.fz = sm.tz;
    let landed = false;
    let landSpeed = 0;
    let landPulse = false;
    for (let i = 0; i < 90; i++) {
      car.step(canyon, cruise, 1 / 60);
      if (!car.airborne) {
        landed = true;
        landSpeed = car.speed;
        landPulse = car.snap().justLand;
        break;
      }
    }
    assert.equal(landed, true, "should plant back on the ribbon");
    assert.ok(landSpeed > 18, `kept speed ${landSpeed}`);
    assert.equal(landPulse, true);
    assert.ok(Math.abs(car.n) < sm.width * 0.45, `n ${car.n}`);
  });

  it("does not rubber-band a 1.8m hover in one step", () => {
    const circuit = getTrack("circuit");
    const car = new CarSim();
    car.reset(circuit);
    const sm = sampleAt(circuit, 40);
    car.s = sm.s;
    car.n = 0;
    car.airborne = true;
    car.px = sm.x + sm.ux * 1.85;
    car.py = sm.y + sm.uy * 1.85;
    car.pz = sm.z + sm.uz * 1.85;
    car.vx = sm.tx * 18;
    car.vy = sm.ty * 18;
    car.vz = sm.tz * 18;
    car.step(circuit, cruise, 1 / 60);
    assert.equal(car.airborne, true, "magnet must not teleport from ~1.8m");
  });
});
