import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getTrack, nearestSample, sampleAt } from "./track.ts";
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
    assert.ok(cs >= 12 && cs < 50, `circuit pre-CP s ${cs}`);
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

  it("recovers Circuit leave-track→R upright with camera above the road", () => {
    const circuit = getTrack("circuit");
    const pre = pickSafeRespawnS(circuit, -1, 8);
    const post = pickSafeRespawnS(circuit, 0, circuit.checkpoints[0]! + 8);
    assert.ok(pre >= 12 && pre < 50, `circuit #9 pre-CP s ${pre}`);
    assert.ok(post > 160 && post < 180, `circuit post-CP1 s ${post}`);
    assert.ok(sampleAt(circuit, pre).uy > 0.9);
    assert.ok(sampleAt(circuit, post).uy > 0.9);

    for (const lastCp of [-1, 0] as const) {
      const car = new CarSim();
      car.reset(circuit);
      car.lastCp = lastCp;
      car.s = lastCp < 0 ? 12 : circuit.checkpoints[0]! + 10;
      for (let r = 0; r < 3; r++) {
        car.n = 22;
        car.py = -8;
        car.airborne = true;
        car.respawn(circuit);
        assert.ok(car.uy > 0.9, `circuit cp${lastCp} R${r} uy ${car.uy}`);
        assert.equal(car.airborne, false);
        assert.ok(car.py > -0.2, `circuit cp${lastCp} R${r} py ${car.py}`);
        const sm = sampleAt(circuit, car.s);
        assert.ok(sm.uy > 0.88, `circuit cp${lastCp} R${r} sample uy ${sm.uy} at s=${car.s}`);
        const { cam, road, snap } = portraitChaseAboveRoad(car, circuit);
        assert.ok(cam.y > snap.py + 1.5, `circuit cp${lastCp} R${r} cam above car ${cam.y}`);
        assert.ok(cam.y > road.y + 1.5, `circuit cp${lastCp} R${r} cam above road ${cam.y}`);
        for (let i = 0; i < 60; i++) car.step(circuit, cruise, 1 / 60);
        assert.ok(car.uy > 0.85, `circuit cp${lastCp} R${r} after cruise uy ${car.uy}`);
        assert.equal(car.airborne, false);
        assert.ok(car.py > -1, `circuit cp${lastCp} R${r} after cruise py ${car.py}`);
      }
    }
  });

  it("centers Circuit pre-CP1 R on the outbound ribbon, not the wrap", () => {
    const circuit = getTrack("circuit");
    const start = pickSafeRespawnS(circuit, -1, 8);
    const startSm = sampleAt(circuit, start);
    assert.ok(start >= 12 && start < 50, `start s ${start}`);
    assert.ok(Math.abs(startSm.x) < 0.45, `start x ${startSm.x}`);
    assert.ok(startSm.tz < -0.9, `start tz ${startSm.tz}`);

    const mid = pickSafeRespawnS(circuit, -1, 140);
    const midSm = sampleAt(circuit, mid);
    assert.ok(mid > 120 && mid < 160, `mid-sector s ${mid}`);
    assert.ok(midSm.uy > 0.9, `mid uy ${midSm.uy}`);
    assert.ok(Math.abs(midSm.x) > 40, `expected first-curve x, got ${midSm.x}`);

    const car = new CarSim();
    car.reset(circuit);
    car.s = 22;
    car.n = -9;
    car.lastCp = -1;
    car.respawn(circuit);
    assert.equal(car.n, 0);
    assert.equal(car.heading, 0);
    assert.ok(Math.abs(car.px) < 0.45, `px ${car.px}`);
    assert.ok(car.fz < -0.9, `fz ${car.fz}`);
    assert.ok(car.uy > 0.9, `uy ${car.uy}`);
  });

  it("does not pick the closing stretch from either shoulder near Circuit start", () => {
    const circuit = getTrack("circuit");
    const left = nearestSample(circuit, -10, 0.4, -8, 8);
    const right = nearestSample(circuit, 10, 0.4, -8, 8);
    assert.ok(left.tz < -0.85, `left tz=${left.tz} s=${left.s}`);
    assert.ok(right.tz < -0.85, `right tz=${right.tz} s=${right.s}`);
    assert.ok(left.s < 80 && right.s < 80, `wrap won left=${left.s} right=${right.s}`);
  });

  it("lets Helix recover-lock follow invert instead of gluing under the ribbon", () => {
    const helix = getTrack("helix");
    const invert = helix.samples.find((sm) => sm.s > 90 && sm.s < 130 && sm.uy < 0.2);
    assert.ok(invert, "expected a loop invert sample");
    const { helix: track, car } = leaveTrackAfterCp1();
    car.respawn(track);
    assert.ok(car.uy > 0.95);
    car.s = invert!.s;
    car.n = 0;
    car.step(track, idle, 1 / 60);
    const sm = sampleAt(track, car.s);
    assert.ok(sm.uy < 0.5, `expected invert after one step uy=${sm.uy} s=${car.s}`);
    assert.ok(car.uy < 0.85, `stuck world-up on invert uy=${car.uy} sample=${sm.uy} s=${car.s}`);
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
