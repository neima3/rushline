import { PAD_MAP, PAD_STICK_DEADZONE, PAD_TRIGGER_DEADZONE, padRaceHint } from "./gamepad.ts";

export type ControlRow = {
  id: string;
  action: string;
  keys: string;
  pad: string;
};

/** Race bindings — must stay aligned with `input.ts` + `PAD_MAP`. */
export const RACE_CONTROL_ROWS: ControlRow[] = [
  { id: "steer", action: "Steer", keys: "A / D or ← / →", pad: PAD_MAP.steer },
  { id: "throttle", action: "Accelerate", keys: "W or ↑", pad: PAD_MAP.throttle },
  { id: "brake", action: "Brake / reverse", keys: "S or ↓", pad: PAD_MAP.brake },
  { id: "slide", action: "Slide", keys: "Space or Shift", pad: PAD_MAP.slide },
  { id: "respawn", action: "Respawn", keys: "R", pad: PAD_MAP.respawn },
  { id: "camera", action: "Camera", keys: "C", pad: PAD_MAP.camera },
  { id: "photo", action: "Photo mode", keys: "F", pad: PAD_MAP.photo },
  { id: "pause", action: "Pause", keys: "Esc or P", pad: PAD_MAP.pause },
];

export const MENU_CONTROL_ROWS: ControlRow[] = [
  { id: "confirm", action: "Confirm / start", keys: "Enter", pad: "A / Cross" },
  { id: "back", action: "Back", keys: "Backspace", pad: "B / Circle" },
  { id: "navigate", action: "Move selection", keys: "W / S or ↑ / ↓", pad: "D-pad / left stick" },
];

export const PHOTO_CONTROL_ROWS: ControlRow[] = [
  { id: "orbit", action: "Orbit", keys: "Drag or WASD", pad: "Left stick · triggers pitch" },
  { id: "zoom", action: "Zoom", keys: "Q / E or − / =", pad: "—" },
  { id: "capture", action: "Capture still", keys: "Enter", pad: "A / Cross" },
  { id: "reset", action: "Reset orbit", keys: "C", pad: "View / Share / RB" },
  { id: "exit", action: "Exit photo", keys: "F or Esc", pad: "B / Circle · Menu" },
];

export const COPY = {
  productEyebrow: "Precision time trial",
  tagline: "Every checkpoint. Stay on the plastic. Beat the medals — or run Rush Cup.",
  padIdle: "Connect a controller — RT accel, LT brake, Y respawn, RB camera",
  menuHint: "WASD to drive · Space to slide · Esc to pause · Help for the full sheet",
  garageBlurb: "Choose a livery. Paint stays on the car across every track.",
  cupBlurb: "A five-track medal campaign. Clear Gold, then Author. Progress stays on this device.",
  settingsBlurb: "Graphics, audio, camera, and Track Assist. Changes apply immediately.",
  garageTitle: "Garage",
  cupEyebrow: "Campaign",
  selectEyebrow: "Select circuit",
  helpTitle: "Controls",
  helpEyebrow: "Help",
  helpBlurb: "Desktop, touch, and gamepad — the bindings that are actually live.",
  driveTitle: "On track",
  menuTitle: "Menus",
  touchTitle: "Touch",
  photoTitle: "Photo mode",
  padNote: `Inner deadzone ${Math.round(PAD_STICK_DEADZONE * 100)}% stick, ${Math.round(PAD_TRIGGER_DEADZONE * 100)}% trigger. A resting pad does not steal keyboard or touch. Hot-plug shows a banner; Track Assist is unchanged. Compatible pads rumble on boost, crash, turbo, land, and finish.`,
  touchItems: [
    "Left pad steers. Sensitivity and invert live in Settings.",
    "Right cluster is Accel, Brake, and Slide. Brake wins if both are held.",
    "Respawn sits above the drive cluster. Pause is top-left.",
    "Auto-throttle is on by default on touch. Track Assist can pin you to the racing line.",
    "Photo mode hides the pads so orbit drag and Capture stay clean.",
  ],
  photoNotes: [
    "Open from the camera button, Pause, Results, F, or LB + View.",
    "The HUD hides for the still. Capture saves a PNG to your downloads.",
    "On a finished run you can follow the ghost and scrub the replay.",
  ],
  playNotes: [
    "Time trial — any track, any medal, personal-best ghost.",
    "Rush Cup — Gold on all five, then Author. Next challenge unlocks in order.",
    "Garage paint is cosmetic only. Audio mix is under Settings.",
  ],
  noMedal: "No medal this run. Bronze is the next target.",
  overlayError: "Overlay error",
  overlayErrorFallback: "The overlay crashed.",
} as const;

export function raceHint(kind: "keyboard" | "xbox" | "play"): string {
  if (kind === "xbox") return padRaceHint(true);
  if (kind === "play") return padRaceHint(false);
  return "WASD to drive · Space to slide · R to respawn · C camera · F photo · Esc to pause";
}

export function firstRunBody(input: { touch: boolean; padActive: boolean }): string {
  if (input.touch) {
    return "Left pad steers. Accel, brake, and slide sit on the right. Pause is top-left — Help lists every control.";
  }
  if (input.padActive) {
    return `${padRaceHint(true)} · Help for the full sheet.`;
  }
  return `${raceHint("keyboard")} · Help for the full sheet.`;
}

export function photoHint(touch: boolean): string {
  return touch
    ? "Drag to orbit · HUD is hidden · Capture saves a PNG"
    : "Drag or WASD to orbit · Q/E zoom · Enter captures · F / Esc exits";
}

export function pauseHint(input: { touch: boolean; cup?: boolean }): string {
  if (input.cup) return "Help lists every control. Options covers graphics, audio, and Track Assist.";
  if (input.touch) return "Resume keeps the run. Help lists every control. Options covers graphics, audio, and Track Assist.";
  return "Esc resumes. Help lists every control. Options covers graphics, audio, and Track Assist.";
}
