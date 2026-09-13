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
