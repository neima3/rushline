import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PAD_MAP,
  padConnectCopy,
  padFromGamepad,
  padInUse,
  padInfoFrom,
  padRaceHint,
  radialDeadzone,
  readTrigger,
  remapTrigger,
  steerCurvePad,
} from "./gamepad.ts";

function button(pressed: boolean, value = pressed ? 1 : 0): GamepadButton {
  return { pressed, touched: pressed, value } as GamepadButton;
}

function fakePad(partial: {
  axes?: number[];
  buttons?: Record<number, { pressed?: boolean; value?: number }>;
  mapping?: GamepadMappingType;
  id?: string;
}): Gamepad {
  const buttons = Array.from({ length: 16 }, (_, i) => {
    const b = partial.buttons?.[i];
    return button(Boolean(b?.pressed), b?.value ?? (b?.pressed ? 1 : 0));
  });
  return {
    axes: partial.axes ?? [0, 0, 0, 0],
    buttons,
    connected: true,
    id: partial.id ?? "Xbox 360 Controller (XInput STANDARD GAMEPAD)",
    index: 0,
    mapping: partial.mapping ?? "standard",
    timestamp: 1,
    vibrationActuator: undefined,
  } as unknown as Gamepad;
}

describe("gamepad deadzones", () => {
  it("kills a resting stick and remaps the rest to full lock", () => {
    const rest = radialDeadzone(0.05, 0.04);
    assert.equal(rest.x, 0);
    assert.equal(rest.y, 0);
    const edge = radialDeadzone(1, 0);
    assert.ok(Math.abs(edge.x) > 0.98);
    assert.equal(remapTrigger(0.05), 0);
    assert.equal(remapTrigger(1), 1);
    assert.ok(remapTrigger(0.5) > 0.4 && remapTrigger(0.5) < 0.6);
  });

  it("keeps a gentle steer curve", () => {
    assert.equal(steerCurvePad(0), 0);
    assert.ok(Math.abs(steerCurvePad(0.5)) < 0.5);
    assert.ok(Math.abs(steerCurvePad(-1)) > 0.98);
  });
});

describe("standard mapping isolation", () => {
  it("does not treat right-stick axes as brake or throttle", () => {
    const pad = fakePad({
      axes: [0, 0, 0.9, -0.8],
      mapping: "standard",
    });
    const axes = padFromGamepad(pad);
    assert.equal(axes.steer, 0);
    assert.equal(axes.brake, 0);
    assert.equal(axes.throttle, 0);
    assert.equal(readTrigger(pad, 6, [2, 4]), 0);
  });

  it("maps steer / triggers / face buttons the TM way", () => {
    const pad = fakePad({
      axes: [-0.8, 0.1, 0, 0],
      buttons: {
        0: { pressed: true },
        2: { pressed: true },
        3: { pressed: true },
        5: { pressed: true },
        6: { pressed: true, value: 0.9 },
        7: { pressed: true, value: 0.85 },
        9: { pressed: true },
      },
    });
    const axes = padFromGamepad(pad);
    assert.ok(axes.steer > 0.5, `steer ${axes.steer}`);
    assert.ok(axes.throttle > 0.7);
    assert.ok(axes.brake > 0.7);
    assert.equal(axes.slide, true);
    assert.equal(axes.y, true);
    assert.equal(axes.start, true);
    assert.equal(axes.rb, true);
    assert.equal(axes.a, true);
  });

  it("d-pad is full digital steer", () => {
    const left = padFromGamepad(fakePad({ buttons: { 14: { pressed: true } } }));
    assert.equal(left.steer, 1);
    const right = padFromGamepad(fakePad({ buttons: { 15: { pressed: true } } }));
    assert.equal(right.steer, -1);
  });
});

describe("pad presence + copy", () => {
  it("reports connected/active and documents the map", () => {
    const rest = padFromGamepad(fakePad({}));
    assert.equal(padInUse(rest), false);
    const used = padFromGamepad(fakePad({ buttons: { 7: { pressed: true, value: 1 } } }));
    assert.equal(padInUse(used), true);
    const info = padInfoFrom(used, true);
    assert.equal(info.connected, true);
    assert.equal(info.xbox, true);
    assert.match(padRaceHint(true), /RT accel/);
    assert.match(padRaceHint(false), /R2 accel/);
    assert.match(padConnectCopy(info), /connected/);
    assert.equal(PAD_MAP.camera.includes("RB"), true);
    assert.equal(padInfoFrom(null, false).connected, false);
  });
});
