import type { PadInfo } from "./types";

export type PadAxes = {
  steer: number;
  throttle: number;
  brake: number;
  slide: boolean;
  a: boolean;
  b: boolean;
  x: boolean;
  y: boolean;
  lb: boolean;
  rb: boolean;
  start: boolean;
  view: boolean;
  dpadX: number;
  dpadY: number;
  id: string;
  xbox: boolean;
};

const XBOX_RE = /xbox|xinput|microsoft|360|series|dualsense|dualshock|playstation|gamepad/i;

export function isXboxId(id: string) {
  return /xbox|xinput|microsoft|360|series/i.test(id);
}

function radialDeadzone(x: number, y: number, dz = 0.16) {
  const m = Math.hypot(x, y);
  if (m < dz) return { x: 0, y: 0 };
  const scale = (m - dz) / (1 - dz) / m;
  return { x: x * scale, y: y * scale };
}

function curve(x: number) {
  const s = Math.sign(x);
  return s * Math.pow(Math.abs(x), 1.35);
}

function btn(pad: Gamepad, i: number) {
  return Boolean(pad.buttons[i]?.pressed);
}

function analog(pad: Gamepad, i: number) {
  const b = pad.buttons[i];
  if (!b) return 0;
  if (b.value > 0) return b.value;
  return b.pressed ? 1 : 0;
}

function axisTo01(a: number | undefined) {
  if (a == null || Number.isNaN(a)) return 0;
  if (a < -0.2) return Math.max(0, (a + 1) / 2);
  return Math.max(0, a);
}

function trigger(pad: Gamepad, buttonIndex: number, ...axisIdx: number[]) {
  const fromBtn = analog(pad, buttonIndex);
  if (fromBtn > 0.08) return fromBtn;
  for (const i of axisIdx) {
    const v = axisTo01(pad.axes[i]);
    if (v > 0.08) return v;
  }
  return 0;
}

export function pollPads(): PadAxes | null {
  const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
  for (const pad of pads) {
    if (!pad) continue;
    const stick = radialDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
    const right = radialDeadzone(pad.axes[2] ?? 0, pad.axes[3] ?? 0, 0.2);
    let dpadX = 0;
    let dpadY = 0;
    if (btn(pad, 14)) dpadX -= 1;
    if (btn(pad, 15)) dpadX += 1;
    if (btn(pad, 12)) dpadY -= 1;
    if (btn(pad, 13)) dpadY += 1;
    if (Math.abs(stick.x) < 0.01 && Math.abs(right.x) > 0.5) dpadX += Math.sign(right.x);

    const lt = trigger(pad, 6, 2, 4);
    const rt = trigger(pad, 7, 5, 3);

    return {
      steer: curve(-stick.x) + (dpadX < 0 ? 1 : dpadX > 0 ? -1 : 0),
      throttle: rt,
      brake: lt,
      slide: btn(pad, 2) || btn(pad, 4),
      a: btn(pad, 0),
      b: btn(pad, 1),
      x: btn(pad, 2),
      y: btn(pad, 3),
      lb: btn(pad, 4),
      rb: btn(pad, 5),
      start: btn(pad, 9),
      view: btn(pad, 8),
      dpadX,
      dpadY: Math.abs(stick.y) > 0.45 ? Math.sign(stick.y) : dpadY,
      id: pad.id,
      xbox: isXboxId(pad.id) || pad.mapping === "standard" || XBOX_RE.test(pad.id),
    };
  }
  return null;
}

export function padInfoFrom(axes: PadAxes | null, recentlyUsed: boolean): PadInfo {
  if (!axes) {
    return { connected: false, id: "", xbox: false, active: false };
  }
  return {
    connected: true,
    id: axes.id,
    xbox: axes.xbox,
    active: recentlyUsed,
  };
}

type RumbleKind = "boost" | "crash" | "turbo" | "land" | "finish";

const RUMBLE: Record<RumbleKind, { mag: number; ms: number }> = {
  crash: { mag: 0.7, ms: 90 },
  boost: { mag: 0.35, ms: 70 },
  turbo: { mag: 0.55, ms: 140 },
  land: { mag: 0.4, ms: 60 },
  finish: { mag: 0.5, ms: 220 },
};

type PulseActuator = { pulse?: (value: number, duration: number) => Promise<boolean> };

export function rumblePads(kind: RumbleKind) {
  const spec = RUMBLE[kind];
  const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
  for (const pad of pads) {
    if (!pad) continue;
    const act = pad.vibrationActuator as (GamepadHapticActuator & PulseActuator) | undefined;
    if (!act) continue;
    try {
      if (typeof act.playEffect === "function") {
        void act.playEffect("dual-rumble", {
          startDelay: 0,
          duration: spec.ms,
          weakMagnitude: spec.mag * 0.5,
          strongMagnitude: spec.mag,
        });
      } else if (typeof act.pulse === "function") {
        void act.pulse(spec.mag, spec.ms);
      }
    } catch {
      /* haptic unsupported */
    }
  }
}
