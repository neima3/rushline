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

export type PadPoller = () => PadAxes | null;

export const PAD_STICK_DEADZONE = 0.16;
export const PAD_TRIGGER_DEADZONE = 0.08;
export const PAD_TRIGGER_MAX = 0.94;
export const PAD_USE_EPS = 0.08;

/** Standard Gamepad mapping — Trackmania-style face / shoulder layout. */
export const PAD_MAP = {
  steer: "Left stick / D-pad",
  throttle: "RT / R2 / A",
  brake: "LT / L2 / B",
  slide: "LB / L1 / X",
  respawn: "Y / Triangle",
  pause: "Menu / Start / Options",
  camera: "View / Share / RB",
} as const;

const XBOX_RE = /xbox|xinput|microsoft|360|series/i;
const PLAY_RE = /dualsense|dualshock|playstation|ps4|ps5/i;

export function isXboxId(id: string) {
  return XBOX_RE.test(id);
}

export function radialDeadzone(x: number, y: number, dz = PAD_STICK_DEADZONE) {
  const m = Math.hypot(x, y);
  if (m < dz) return { x: 0, y: 0 };
  const scale = (m - dz) / (1 - dz) / m;
  return { x: x * scale, y: y * scale };
}

export function steerCurvePad(x: number) {
  const s = Math.sign(x);
  const a = Math.abs(x);
  if (a < 0.02) return 0;
  return s * Math.pow(a, 1.35);
}

export function remapTrigger(raw: number, dz = PAD_TRIGGER_DEADZONE, max = PAD_TRIGGER_MAX) {
  if (!Number.isFinite(raw) || raw <= dz) return 0;
  const t = (raw - dz) / (max - dz);
  return Math.max(0, Math.min(1, t));
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

/** Triggers: Standard mapping uses buttons 6/7 only so right-stick axes never become brake/gas. */
export function readTrigger(pad: Gamepad, buttonIndex: number, fallbackAxes: number[] = []) {
  const fromBtn = analog(pad, buttonIndex);
  if (pad.mapping === "standard" || fallbackAxes.length === 0) return remapTrigger(fromBtn);
  if (fromBtn > PAD_TRIGGER_DEADZONE) return remapTrigger(fromBtn);
  for (const i of fallbackAxes) {
    const v = axisTo01(pad.axes[i]);
    if (v > PAD_TRIGGER_DEADZONE) return remapTrigger(v);
  }
  return 0;
}

export function padFromGamepad(pad: Gamepad): PadAxes {
  const stick = radialDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
  let dpadX = 0;
  let dpadY = 0;
  if (btn(pad, 14)) dpadX -= 1;
  if (btn(pad, 15)) dpadX += 1;
  if (btn(pad, 12)) dpadY -= 1;
  if (btn(pad, 13)) dpadY += 1;

  const standard = pad.mapping === "standard";
  const lt = readTrigger(pad, 6, standard ? [] : [2, 4]);
  const rt = readTrigger(pad, 7, standard ? [] : [5, 3]);
  const digitalSteer = dpadX < 0 ? 1 : dpadX > 0 ? -1 : 0;
  const analogSteer = steerCurvePad(-stick.x);
  const steer = Math.max(-1, Math.min(1, analogSteer + digitalSteer));

  return {
    steer,
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
    dpadY: Math.abs(stick.y) > 0.55 ? Math.sign(stick.y) : dpadY,
    id: pad.id,
    xbox: isXboxId(pad.id) || (!PLAY_RE.test(pad.id) && (pad.mapping === "standard" || XBOX_RE.test(pad.id))),
  };
}

function defaultPoll(): PadAxes | null {
  const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
  for (const pad of pads) {
    if (!pad) continue;
    return padFromGamepad(pad);
  }
  return null;
}

let poller: PadPoller = defaultPoll;

export function pollPads(): PadAxes | null {
  return poller();
}

export function setPadPoller(fn: PadPoller | null) {
  poller = fn ?? defaultPoll;
}

export function padInUse(gp: PadAxes): boolean {
  return (
    Math.abs(gp.steer) > PAD_USE_EPS ||
    gp.throttle > PAD_USE_EPS ||
    gp.brake > PAD_USE_EPS ||
    gp.slide ||
    gp.a ||
    gp.b ||
    gp.x ||
    gp.y ||
    gp.start ||
    gp.view ||
    gp.lb ||
    gp.rb ||
    gp.dpadX !== 0 ||
    gp.dpadY !== 0
  );
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

export function padRaceHint(xbox: boolean): string {
  return xbox
    ? "LT brake · RT accel · L-stick steer · X slide · Y respawn · RB camera · Menu pause"
    : "L2 brake · R2 accel · L-stick steer · □ slide · △ respawn · R1 camera · Options pause";
}

export function padConnectCopy(info: PadInfo): string {
  const name = info.xbox ? "Xbox controller" : "Controller";
  return `${name} connected — ${padRaceHint(info.xbox)}`;
}

export type PadHotPlug = "connect" | "disconnect" | "poll";

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
