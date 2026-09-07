import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getTrack, sampleAt } from "./track.ts";
import { CarSim, helixNearGate, helixRibbonOverhead, pickSafeRespawnS } from "./physics.ts";
import { chaseSnapPlacement, clearChaseCamera } from "./scene.ts";

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

function leaveTrackAfterCp1() {
  const helix = getTrack("helix");
  const car = new CarSim();
  car.reset(helix);
  car.lastCp = 0;
  car.s = helix.checkpoints[0]! + 8;
  car.n = 22;
  car.py = -8;
  car.airborne = true;
  return { helix, car };
}

function portraitChaseAboveRoad(car: CarSim, track: ReturnType<typeof getTrack>) {
  const snap = car.snap();
  const pose = chaseSnapPlacement(snap, track, "chase", 390 / 844);
  clearChaseCamera(pose.cam, snap, track, "chase");
  const road = sampleAt(track, snap.s);
  return { snap, cam: pose.cam, road };
}

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

  it("parks Helix post-CP1 R on the post-loop island, not the CP arch", () => {
    const helix = getTrack("helix");
    const cp1 = helix.checkpoints[0]!;
    const s = pickSafeRespawnS(helix, 0, cp1 + 8);
    const sm = sampleAt(helix, s);
    assert.ok(s >= 128 && s <= 140, `post-CP1 island s ${s}`);
    assert.ok(Math.abs(s - cp1) > 7, `must not sit on CP1 arch s=${s} cp=${cp1}`);
    assert.ok(sm.uy > 0.95, `sample uy ${sm.uy}`);
    assert.ok(Math.abs(sm.ty) < 0.15, `sample ty ${sm.ty}`);
    assert.equal(helixNearGate(helix, s), false);
    assert.equal(helixRibbonOverhead(helix, sm), false);
  });

  it("recovers Helix post-CP1 leave-track→R upright with camera above the road", () => {
    const { helix, car } = leaveTrackAfterCp1();
    for (let r = 0; r < 4; r++) {
      car.n = 22;
      car.py = -8;
      car.airborne = true;
      car.respawn(helix);
      assert.ok(car.uy > 0.95, `R${r} uy ${car.uy}`);
      assert.equal(car.airborne, false);
      assert.ok(car.py > -0.2, `R${r} py ${car.py}`);
      assert.ok(car.s >= 128 && car.s <= 140, `R${r} s ${car.s}`);
      const sm = sampleAt(helix, car.s);
      assert.ok(sm.uy > 0.95, `R${r} sample uy ${sm.uy} at s=${car.s}`);
      assert.equal(helixNearGate(helix, car.s), false);
      assert.equal(helixRibbonOverhead(helix, sm), false);
      const { cam, road, snap } = portraitChaseAboveRoad(car, helix);
      assert.ok(cam.y > snap.py + 2.2, `R${r} cam above car ${cam.y} vs py ${snap.py}`);
      assert.ok(cam.y > road.y + 2.2, `R${r} cam above road ${cam.y} vs road ${road.y}`);
      for (let i = 0; i < 90; i++) car.step(helix, cruise, 1 / 60);
      assert.ok(car.uy > 0.85, `R${r} after cruise uy ${car.uy}`);
      assert.equal(car.airborne, false);
      assert.ok(car.py > -1, `R${r} after cruise py ${car.py}`);
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
