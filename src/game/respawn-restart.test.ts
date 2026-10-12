import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AUTHOR_START_S } from "./author-ghost.ts";
import { wallClockMs } from "./clock.ts";
import { CarSim } from "./physics.ts";
import {
  countdownPhysicsDrive,
  respawnKeepSpeed,
  RESPAWN_SPEED_MAX,
} from "./run-flow.ts";
import { getTrack } from "./track.ts";

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
  photo: false,
  rewind: false,
  menuY: 0,
  pauseMenuConfirm: false,
};

const cruise = { ...idle, throttle: 1 };

function yawDeg(yawRad: number) {
  return (yawRad * 180) / Math.PI;
}

type PinCase = {
  label: string;
  lastCp: number;
  fromS: number;
  cpCrossSpeed: number;
  expectS: number;
  px: number;
  py: number;
  pz: number;
  yaw: number;
  expectSpeed?: number;
};

const MESA_PINS: PinCase[] = [
  {
    label: "grid / R before CP1",
    lastCp: -1,
    fromS: 49.38,
    cpCrossSpeed: 0,
    expectS: 6.0,
    px: 0,
    py: 0.4,
    pz: -6,
    yaw: 0,
    expectSpeed: 0,
  },
  {
    label: "R after CP1",
    lastCp: 0,
    fromS: 162.36,
    cpCrossSpeed: 40.82,
    expectS: 138.73,
    px: 50.12,
    py: 0.4,
    pz: -108.99,
    yaw: -72.0,
    expectSpeed: 31.84,
  },
  {
    label: "R after CP2",
    lastCp: 1,
    fromS: 353.16,
    cpCrossSpeed: 48.72,
    expectS: 330.93,
    px: 109.1,
    py: 25.4,
    pz: -194.64,
    yaw: -86.4,
    expectSpeed: RESPAWN_SPEED_MAX,
  },
  {
    label: "R after CP3",
    lastCp: 2,
    fromS: 674,
    cpCrossSpeed: 8,
    expectS: 446.48,
    px: 221.17,
    py: 1.4,
    pz: -201.8,
    yaw: -81.6,
  },
];

const STORM_PINS: PinCase[] = [
  {
    label: "grid / R before CP1",
    lastCp: -1,
    fromS: 47.3,
    cpCrossSpeed: 0,
    expectS: 6.0,
    px: 0,
    py: 0.4,
    pz: -6,
    yaw: 0,
    expectSpeed: 0,
  },
  {
    label: "R after CP1",
    lastCp: 0,
    fromS: 191.73,
    cpCrossSpeed: 41.81,
    expectS: 170.09,
    px: 47.87,
    py: 0.4,
    pz: -144.74,
    yaw: -14.2,
    expectSpeed: 32.61,
  },
  {
    label: "R after CP2",
    lastCp: 1,
    fromS: 328.4,
    cpCrossSpeed: 48.72,
    expectS: 307.16,
    px: 113.02,
    py: 10.27,
    pz: -174.87,
    yaw: 39.6,
    expectSpeed: RESPAWN_SPEED_MAX,
  },
  {
    label: "R after CP3",
    lastCp: 2,
    fromS: 683,
    cpCrossSpeed: 9,
    expectS: 410.38,
    px: 47.76,
    py: -1.6,
    pz: -253.66,
    yaw: 44.5,
  },
];

function assertPin(trackId: "mesa" | "storm", pin: PinCase) {
  const track = getTrack(trackId);
  const car = new CarSim();
  car.reset(track);
  car.lastCp = pin.lastCp;
  car.cpCrossSpeed = pin.cpCrossSpeed;
  car.s = pin.fromS;
  car.respawn(track);

  assert.ok(Math.abs(car.s - pin.expectS) <= 0.05, `${trackId} ${pin.label} s ${car.s} vs ${pin.expectS}`);
  assert.ok(Math.abs(car.px - pin.px) <= 0.1, `${trackId} ${pin.label} px ${car.px} vs ${pin.px}`);
  assert.ok(Math.abs(car.py - pin.py) <= 0.1, `${trackId} ${pin.label} py ${car.py} vs ${pin.py}`);
  assert.ok(Math.abs(car.pz - pin.pz) <= 0.1, `${trackId} ${pin.label} pz ${car.pz} vs ${pin.pz}`);
  assert.ok(Math.abs(yawDeg(car.yaw) - pin.yaw) <= 1, `${trackId} ${pin.label} yaw ${yawDeg(car.yaw)} vs ${pin.yaw}`);

  if (pin.expectSpeed != null) {
    const kept = pin.lastCp < 0 ? 0 : respawnKeepSpeed(pin.cpCrossSpeed);
    const capped = Math.min(RESPAWN_SPEED_MAX, Math.max(0, kept));
    const expect = pin.lastCp < 0 ? 0 : capped;
    assert.ok(Math.abs(car.speed - expect) < 0.05, `${trackId} ${pin.label} speed ${car.speed} vs ${expect}`);
    if (pin.expectSpeed != null && pin.lastCp >= 0) {
      assert.ok(Math.abs(car.speed - pin.expectSpeed) < 0.05, `${trackId} ${pin.label} QA speed ${car.speed} vs ${pin.expectSpeed}`);
    }
  }

  if (pin.lastCp >= 0) {
    assert.equal(car.lastCp, pin.lastCp, `${trackId} ${pin.label} lastCp kept`);
  }
}

describe("mesa / storm respawn pins (QA main 5ed6851)", () => {
  for (const pin of MESA_PINS) {
    it(`mesa ${pin.label}`, () => assertPin("mesa", pin));
  }
  for (const pin of STORM_PINS) {
    it(`storm ${pin.label}`, () => assertPin("storm", pin));
  }

  it("mesa R before CP1 keeps the race timer running", () => {
    const hold = 15_800;
    const startedAt = 1_000;
    const now = 11_000;
    const before = wallClockMs(hold, startedAt, now);
    const track = getTrack("mesa");
    const car = new CarSim();
    car.reset(track);
    car.speed = 35;
    car.s = 49;
    car.respawn(track);
    assert.equal(wallClockMs(hold, startedAt, now), before);
    assert.equal(car.s, AUTHOR_START_S);
    assert.equal(car.speed, 0);
    assert.equal(car.lastCp, -1);
  });

  it("full run restart lands on grid 0 km/h CP0 (Delete / Esc→Restart / hold-R parity)", () => {
    for (const id of ["mesa", "storm"] as const) {
      const track = getTrack(id);
      const car = new CarSim();
      car.reset(track);
      car.lastCp = 2;
      car.speed = 30;
      car.s = 400;
      car.reset(track);
      assert.equal(car.s, AUTHOR_START_S);
      assert.equal(car.speed, 0);
      assert.equal(car.lastCp, -1);
      assert.equal(car.lap, 1);
    }
  });
});

describe("countdownPhysicsDrive (Delete + throttle BUG-2)", () => {
  it("Delete restart with W held and auto-throttle keeps s 6.00 and speed 0 through countdown", () => {
    const track = getTrack("mesa");
    const car = new CarSim();
    car.reset(track);
    car.speed = 28;
    car.s = 120;
    car.reset(track);
    assert.equal(car.s, AUTHOR_START_S);
    assert.equal(car.speed, 0);

    let actions = { ...cruise, throttle: 1 };
    for (let i = 0; i < 180; i++) {
      actions = countdownPhysicsDrive("countdown", actions);
      car.step(track, actions, 1 / 60);
      assert.ok(Math.abs(car.s - AUTHOR_START_S) <= 1e-3, `s drift at frame ${i}: ${car.s}`);
      assert.ok(Math.abs(car.speed) <= 1e-3, `speed creep at frame ${i}: ${car.speed}`);
    }
  });
});
