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

  it("flushAfterResume clears confirm edge without dropping held drive keys", () => {
    const input = new Input();
    input.setPauseMenuOpen(true);
    input.setKeys(["KeyW", "Enter", "Space"]);
    const before = input.sample();
    assert.equal(before.throttle, 1);
    assert.equal(before.confirm, true);
    input.flushAfterResume();
    input.setPauseMenuOpen(false);
    input.setKeys(["KeyW"]);
    const after = input.sample();
    assert.equal(after.throttle, 1);
    assert.equal(after.confirm, false);
    assert.equal(after.slide, 0);
    input.detach();
  });

  it("held Space through pause menu open does not edge-resume until released and pressed again", () => {
    const input = new Input();
    input.setKeys(["Space"]);
    input.sample();
    input.setPauseMenuOpen(true, null);
    const held = input.sample();
    assert.equal(held.pauseMenuConfirm, false);
    input.setKeys([]);
    input.sample();
    input.setKeys(["Space"]);
    const fresh = input.sample();
    assert.equal(fresh.pauseMenuConfirm, true);
    input.detach();
  });

  it("seeds Enter confirm edge when the pause menu opens", () => {
    const input = new Input();
    input.setKeys(["Enter"]);
    input.sample();
    input.setPauseMenuOpen(true, null);
    const held = input.sample();
    assert.equal(held.pauseMenuConfirm, false);
    input.detach();
  });

  it("does not re-edge pauseMenuConfirm while Enter or Space stay held (repeat poll path)", () => {
    const input = new Input();
    input.setKeys(["Enter"]);
    input.setPauseMenuOpen(true, null);
    const enterHeld = input.sample();
    assert.equal(enterHeld.pauseMenuConfirm, false);
    const enterAgain = input.sample();
    assert.equal(enterAgain.pauseMenuConfirm, false);
    input.setPauseMenuOpen(false);
    input.setKeys(["Space"]);
    input.setPauseMenuOpen(true, null);
    const spaceHeld = input.sample();
    assert.equal(spaceHeld.pauseMenuConfirm, false);
    const spaceAgain = input.sample();
    assert.equal(spaceAgain.pauseMenuConfirm, false);
    input.detach();
  });

  it("edges Space as pause menu confirm while the overlay is open", () => {
    const input = new Input();
    input.setPauseMenuOpen(true);
    input.setKeys(["Space"]);
    const a = input.sample();
    assert.equal(a.pauseMenuConfirm, true);
    assert.equal(a.slide, 1);
    const held = input.sample();
    assert.equal(held.pauseMenuConfirm, false);
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

  it("resetForRun clears brake latch so auto-throttle returns after restart", () => {
    const input = new Input();
    input.autoThrottle = true;
    input.touchMode = true;
    let t = 5000;
    input.nowMs = () => t;
    input.touchBrake = 1;
    const latched = input.sample();
    assert.equal(latched.brake, 1);
    assert.equal(latched.throttle, 0);
    input.resetForRun();
    input.touchBrake = 0;
    input.touchThrottle = 0;
    t = 5100;
    const after = input.sample();
    assert.equal(after.brake, 0);
    assert.ok(after.throttle > 0.3, "auto throttle should refill after run reset");
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

  it("latches a single-frame Enter on the results screen exactly once", () => {
    const input = new Input();
    input.setResultsScreenOpen(true);
    input.applyGameKeyDown("Enter");
    input.applyGameKeyUp("Enter");
    const tap = input.sample();
    assert.equal(tap.confirm, true);
    const again = input.sample();
    assert.equal(again.confirm, false);
    input.detach();
  });

  it("ignores OS Enter repeat on the results screen", () => {
    const input = new Input();
    input.setResultsScreenOpen(true);
    input.applyGameKeyDown("Enter");
    const first = input.sample();
    assert.equal(first.confirm, true);
    input.applyGameKeyDown("Enter", true);
    const repeat = input.sample();
    assert.equal(repeat.confirm, false);
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
