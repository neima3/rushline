import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getTrack, sampleAt } from "./track.ts";
import { CarSim, pickSafeRespawnS } from "./physics.ts";

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

describe("leave-track respawn", () => {
  it("keeps Helix flats upright after the first loop", () => {
    const helix = getTrack("helix");
    const opening = sampleAt(helix, 20);
    assert.ok(opening.uy > 0.9, `opening uy ${opening.uy}`);
    const postLoop = sampleAt(helix, 136);
    assert.ok(postLoop.uy > 0.85, `post-loop uy ${postLoop.uy}`);
    const corkscrewFlat = sampleAt(helix, 162);
    assert.ok(corkscrewFlat.uy > 0.45, `corkscrew-approach uy ${corkscrewFlat.uy}`);
    let invertedFlats = 0;
    for (const sm of helix.samples) {
      if (Math.abs(sm.ty) < 0.4 && sm.y < 6 && sm.uy < 0.35) invertedFlats++;
    }
    assert.equal(invertedFlats, 0);
  });

  it("parks Circuit on the #9 island and Helix past the finish seam", () => {
    const circuit = getTrack("circuit");
    const helix = getTrack("helix");
    const cs = pickSafeRespawnS(circuit, -1, 8);
    const hs = pickSafeRespawnS(helix, -1, 8);
    assert.ok(cs >= 6 && cs < 50, `circuit pre-CP s ${cs}`);
    assert.ok(hs >= 16, `helix pre-CP s ${hs}`);
    assert.ok(sampleAt(circuit, cs).uy > 0.9);
    assert.ok(sampleAt(helix, hs).uy > 0.9);
  });

  it("recovers Helix post-CP1 and repeated R onto an upright island", () => {
    const helix = getTrack("helix");
    const car = new CarSim();
    car.reset(helix);
    car.lastCp = 0;
    car.s = helix.checkpoints[0]! + 8;
    car.n = 20;
    car.py = -8;
    car.airborne = true;
    for (let r = 0; r < 4; r++) {
      car.n = 20;
      car.py = -8;
      car.airborne = true;
      car.respawn(helix);
      assert.ok(car.uy > 0.9, `R${r} uy ${car.uy}`);
      assert.equal(car.airborne, false);
      assert.ok(car.py > -0.2, `R${r} py ${car.py}`);
      const sm = sampleAt(helix, car.s);
      assert.ok(sm.uy > 0.85, `R${r} sample uy ${sm.uy} at s=${car.s}`);
      for (let i = 0; i < 20; i++) car.step(helix, idle, 1 / 60);
    }
  });

  it("holds an upright on-ribbon pose after R plus physics steps", () => {
    for (const id of ["circuit", "helix"] as const) {
      const track = getTrack(id);
      const car = new CarSim();
      car.reset(track);
      car.n = 18;
      car.py = -6;
      car.airborne = true;
      car.respawn(track);
      if (id === "helix") assert.ok(car.s >= 16, `${id} respawn s ${car.s}`);
      else assert.ok(car.s >= 6, `${id} respawn s ${car.s}`);
      assert.ok(car.uy > 0.9, `${id} flatten uy ${car.uy}`);
      assert.equal(car.airborne, false);
      for (let i = 0; i < 50; i++) car.step(track, idle, 1 / 60);
      assert.ok(car.uy > 0.85, `${id} after steps uy ${car.uy}`);
      assert.equal(car.airborne, false);
      assert.ok(car.py > -1, `${id} py ${car.py}`);
    }
  });
});
