import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CAMERA_MODES,
  cameraLabel,
  camLiveFollow,
  camSnapOffsets,
  emptyRespawnHold,
  isCameraMode,
  isChaseCam,
  isCloseCam,
  nextCamera,
  RESTART_HOLD_MS,
  stepRespawnHold,
} from "./camera.ts";
import { getTrack } from "./track.ts";
import { CarSim } from "./physics.ts";
import { chaseSnapPlacement, clearChaseCamera } from "./scene.ts";

describe("camera cycle", () => {
  it("walks Chase → Far → Hood → Cabin → Chase", () => {
    assert.deepEqual(CAMERA_MODES, ["chase", "far", "hood", "cockpit"]);
    assert.equal(nextCamera("chase"), "far");
    assert.equal(nextCamera("far"), "hood");
    assert.equal(nextCamera("hood"), "cockpit");
    assert.equal(nextCamera("cockpit"), "chase");
    assert.equal(cameraLabel("far"), "Far");
    assert.equal(cameraLabel("cockpit"), "Cabin");
    assert.equal(isCameraMode("hood"), true);
    assert.equal(isCameraMode("bumper"), false);
    assert.equal(isChaseCam("far"), true);
    assert.equal(isCloseCam("cockpit"), true);
  });
});

describe("respawn hold", () => {
  it("fires restart once after the hold, not on the tap", () => {
    const t0 = 1000;
    const press = stepRespawnHold(true, t0, emptyRespawnHold());
    assert.equal(press.fireRestart, false);
    const early = stepRespawnHold(true, t0 + RESTART_HOLD_MS - 20, press.next);
    assert.equal(early.fireRestart, false);
    const due = stepRespawnHold(true, t0 + RESTART_HOLD_MS, early.next);
    assert.equal(due.fireRestart, true);
    const held = stepRespawnHold(true, t0 + RESTART_HOLD_MS + 80, due.next);
    assert.equal(held.fireRestart, false);
    const up = stepRespawnHold(false, t0 + 900, held.next);
    assert.equal(up.fireRestart, false);
    assert.equal(up.next.startedAt, 0);
  });
});

describe("camera placement", () => {
  it("puts Far behind Chase and Cabin inside the glass", () => {
    const chase = camSnapOffsets("chase", false, false, 1);
    const far = camSnapOffsets("far", false, false, 1);
    const hood = camSnapOffsets("hood", false, false, 1);
    const cabin = camSnapOffsets("cockpit", false, false, 1);
    assert.ok(far.dist > chase.dist * 1.4, `far ${far.dist} vs chase ${chase.dist}`);
    assert.ok(far.lift > chase.lift);
    assert.ok(hood.dist < 1);
    assert.ok(cabin.dist < hood.dist);
    assert.equal(cabin.hideCar, true);
    assert.ok(camLiveFollow("cockpit", false, 0) > camLiveFollow("chase", false, 0));
  });

  it("keeps Helix chase and far above the road after CP1 R", () => {
    const helix = getTrack("helix");
    const car = new CarSim();
    car.reset(helix);
    car.lastCp = 0;
    car.s = helix.checkpoints[0]! + 8;
    car.n = 22;
    car.py = -8;
    car.airborne = true;
    car.respawn(helix);
    const snap = car.snap();
    for (const mode of ["chase", "far"] as const) {
      const pose = chaseSnapPlacement(snap, helix, mode, 390 / 844);
      clearChaseCamera(pose.cam, snap, helix, mode);
      assert.ok(pose.cam.y > snap.py + 2.2, `${mode} cam ${pose.cam.y} vs py ${snap.py}`);
    }
  });
});
