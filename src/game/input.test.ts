import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { setPadPoller, type PadAxes } from "./gamepad.ts";
import { Input } from "./input.ts";

function axes(partial: Partial<PadAxes> = {}): PadAxes {
  return {
    steer: 0,
    throttle: 0,
    brake: 0,
    slide: false,
    a: false,
    b: false,
    x: false,
    y: false,
    lb: false,
    rb: false,
    start: false,
    view: false,
    dpadX: 0,
    dpadY: 0,
    id: "Xbox",
    xbox: true,
    ...partial,
  };
}

afterEach(() => {
  setPadPoller(null);
});

describe("keyboard stays live with a resting pad", () => {
  it("WASD + slide + respawn still fire when a pad is connected at rest", () => {
    setPadPoller(() => axes());
    const input = new Input();
    input.setKeys(["KeyW", "KeyA", "Space", "KeyR"]);
    const a = input.sample();
    assert.equal(a.throttle, 1);
    assert.ok(a.steer > 0.5);
    assert.equal(a.slide, 1);
    assert.equal(a.respawn, true);
    const again = input.sample();
    assert.equal(again.respawn, false);
    input.detach();
  });

  it("composites pad analog without wiping keyboard throttle", () => {
    setPadPoller(() => axes({ steer: -0.4, throttle: 0.3 }));
    const input = new Input();
    input.setKeys(["KeyW"]);
    const a = input.sample();
    assert.equal(a.throttle, 1);
    assert.ok(a.steer < 0);
    input.detach();
  });

  it("applies D-pad steer instantly like WASD, and eases a stick", () => {
    setPadPoller(() => axes({ steer: 1, dpadX: -1 }));
    const dpad = new Input();
    const digital = dpad.sample();
    assert.ok(digital.steer > 0.95, `dpad ${digital.steer}`);
    dpad.detach();

    setPadPoller(() => axes({ steer: 1, dpadX: 0 }));
    const stick = new Input();
    const analog = stick.sample();
    assert.ok(analog.steer > 0.2 && analog.steer < 0.5, `stick ${analog.steer}`);
    stick.detach();
  });

  it("maps LB+View as photo without also firing camera", () => {
    setPadPoller(() => axes({ lb: true, view: true }));
    const input = new Input();
    const a = input.sample();
    assert.equal(a.photo, true);
    assert.equal(a.camera, false);
    input.detach();
  });

  it("edges F as photo without toggling camera", () => {
    const input = new Input();
    input.setKeys(["KeyF"]);
    const a = input.sample();
    assert.equal(a.photo, true);
    assert.equal(a.camera, false);
    const again = input.sample();
    assert.equal(again.photo, false);
    input.detach();
  });

  it("holds Backspace as rewind without restarting", () => {
    const input = new Input();
    input.setKeys(["Backspace"]);
    const a = input.sample();
    assert.equal(a.rewind, true);
    assert.equal(a.restart, false);
    assert.equal(a.respawn, false);
    const held = input.sample();
    assert.equal(held.rewind, true);
    assert.equal(held.restart, false);
    input.detach();
  });

  it("maps LB+Y as rewind without firing respawn or restart", () => {
    setPadPoller(() => axes({ lb: true, y: true }));
    const input = new Input();
    const a = input.sample();
    assert.equal(a.rewind, true);
    assert.equal(a.respawn, false);
    assert.equal(a.restart, false);
    input.detach();
  });

  it("still respawns on Y without LB", () => {
    setPadPoller(() => axes({ y: true }));
    const input = new Input();
    const a = input.sample();
    assert.equal(a.respawn, true);
    assert.equal(a.rewind, false);
    input.detach();
  });

  it("edges Delete as a full restart without firing last-CP respawn", () => {
    const input = new Input();
    input.setKeys(["Delete"]);
    const a = input.sample();
    assert.equal(a.restart, true);
    assert.equal(a.respawn, false);
    const again = input.sample();
    assert.equal(again.restart, false);
    input.detach();
  });

  it("does not treat Enter as a mid-race restart", () => {
    const input = new Input();
    input.setKeys(["Enter"]);
    const a = input.sample();
    assert.equal(a.restart, false);
    assert.equal(a.confirm, true);
    input.detach();
  });

  it("fires restart after holding R past the threshold", () => {
    const input = new Input();
    let t = 1000;
    input.nowMs = () => t;
    input.holdRestartMs = 50;
    input.setKeys(["KeyR"]);
    const tap = input.sample();
    assert.equal(tap.respawn, true);
    assert.equal(tap.restart, false);
    t = 1060;
    const held = input.sample();
    assert.equal(held.respawn, false);
    assert.equal(held.restart, true);
    input.detach();
  });

  it("maps pad face / shoulder actions without requiring keys", () => {
    setPadPoller(() => axes({ y: true, start: true, rb: true, slide: true, throttle: 0.8 }));
    const input = new Input();
    const a = input.sample();
    assert.equal(a.respawn, true);
    assert.equal(a.pause, true);
    assert.equal(a.camera, true);
    assert.equal(a.slide, 1);
    assert.ok(a.throttle > 0.7);
    input.detach();
  });

  it("notifies hot-plug on connect", () => {
    let connected = false;
    setPadPoller(() => axes({ throttle: 0.2 }));
    const input = new Input();
    input.onPadChange = (info) => {
      connected = info.connected;
    };
    input.refreshPad("connect");
    assert.equal(connected, true);
    assert.equal(input.pad.connected, true);
    input.detach();
  });
});
