import { PAD_MAP, PAD_STICK_DEADZONE, PAD_TRIGGER_DEADZONE, padRaceHint } from "./gamepad.ts";
import { PLAYABLE_ORDER, type TrackId } from "./types.ts";

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
  { id: "respawn", action: "Respawn (last CP)", keys: "R", pad: PAD_MAP.respawn },
  { id: "restart", action: "Restart run", keys: "Hold R or Delete", pad: PAD_MAP.restart },
  { id: "rewind", action: "Rewind", keys: "Hold Backspace", pad: PAD_MAP.rewind },
  { id: "camera", action: "Cycle camera", keys: "C", pad: PAD_MAP.camera },
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

export const REPLAY_CONTROL_ROWS: ControlRow[] = [
  { id: "play", action: "Play / pause", keys: "Space or Enter", pad: "A / Cross" },
  { id: "scrub", action: "Scrub timeline", keys: "A / D or slider", pad: "Left stick" },
  { id: "camera", action: "Cycle camera", keys: "C", pad: "View / Share / RB" },
  { id: "exit", action: "Exit replay", keys: "Esc or Backspace", pad: "B / Circle · Menu" },
];

export type TrackVibe = {
  id: TrackId;
  name: string;
  vibe: string;
  signature: string;
};

/** Nine stock circuits + Custom — source of truth for README / Help vibes. */
export const TRACK_VIBES: TrackVibe[] = [
  { id: "circuit", name: "Green Circuit", vibe: "Stadium plastic", signature: "Banked stadium oval, boost pads, tight chicane · 2 laps" },
  { id: "canyon", name: "Ridge Drop", vibe: "Canyon dirt", signature: "Paved start, dirt canyon, downhill jump" },
  { id: "helix", name: "Night Helix", vibe: "Night tech", signature: "Full loop, sticky metal helix, night lights" },
  { id: "summit", name: "White Pass", vibe: "Alpine ice", signature: "Switchbacks, packed ice, long descent" },
  { id: "yard", name: "Arc Yard", vibe: "Works tech", signature: "Metal docks, gantry climb, freight drop" },
  { id: "mesa", name: "Red Mesa", vibe: "Desert dirt", signature: "Dirt climb, plastic table, dirt edge drop" },
  { id: "hollow", name: "Black Hollow", vibe: "Forest dirt", signature: "Moonlit dirt pines, then a tech clearing sprint" },
  { id: "ember", name: "Ember Caldera", vibe: "Lava dusk", signature: "Ash rim, lava-glass hairpins, crater drop" },
  { id: "storm", name: "Storm Dock", vibe: "Rain city", signature: "Wet streets, ice plaza, tech pier sprint" },
  { id: "custom", name: "Custom", vibe: "Your ribbon", signature: "Closed Catmull-Rom loop you place yourself" },
];

export type FeatureMapRow = {
  id: string;
  name: string;
  blurb: string;
};

/** TM-depth set now on main — Help + README share this catalog. */
export const FEATURE_MAP: FeatureMapRow[] = [
  {
    id: "rewind",
    name: "Rewind",
    blurb:
      "Hold Backspace or LB+Y to scrub the last few seconds. The clock and ghost walk backward with you. Allowed in time trial and Rush Cup. A finish after rewind can still be a PB.",
  },
  {
    id: "surfaces",
    name: "Surfaces",
    blurb:
      "Plastic slides, dirt bites late, ice is icy, tech sticks. The HUD chip names the ribbon under the car.",
  },
  {
    id: "cameras",
    name: "Cameras",
    blurb: "C cycles Chase → Far → Hood → Cabin. All four stay usable at speed.",
  },
  {
    id: "respawn",
    name: "Checkpoint respawn",
    blurb: "R or Y returns you to the last checkpoint. Hold R / Y, or press Delete, to restart from lights-out.",
  },
  {
    id: "ghost-share",
    name: "Ghost share",
    blurb:
      "Export a last-run or PB JSON from Results or Tracks, then import a friend's file as a rival. Local only — never overwrites your PB, Cup, or Garage paint.",
  },
  {
    id: "author-ghosts",
    name: "Author ghosts",
    blurb:
      "Every stock circuit ships an author-line ghost at medal pace. A personal-best or imported rival replaces it. The rival hides through lights-out, fades when you overlap, and toasts PASSED / OVERTAKEN when the lead flips.",
  },
  {
    id: "editor",
    name: "Editor 1.1",
    blurb:
      "Edit ribbon — control points, click-to-place checkpoints and boost pads, undo/redo, snap-to-grid, flatten, and a ribbon flythrough. Save stays on this device. Time trial only — Rush Cup stays the stock nine.",
  },
  {
    id: "hotseat",
    name: "Hotseat",
    blurb: "Two players on one device. P1 drives, then P2 races P1's ghost. A local scoreboard compares the times.",
  },
  {
    id: "validated",
    name: "Validated",
    blurb:
      "Finish without rewind for a soft Validated badge. Local only — not online anti-cheat. Rewind still counts for PB and medals.",
  },
  {
    id: "stock-laps",
    name: "Stock laps",
    blurb:
      "Settings can set time-trial and hotseat laps on the stock nine to 1 / 2 / 3, or Track. Medals scale with the count. Custom and Rush Cup keep authored laps.",
  },
  {
    id: "replay",
    name: "Replay viewer",
    blurb:
      "Watch replay from Results follows the last run, shipped author ghost, PB, imported rival, or a hotseat tape. Pause, play, scrub; Done returns to Results.",
  },
  {
    id: "photo",
    name: "Photo mode",
    blurb: "Hide the HUD, orbit, capture a PNG. Open from F, Pause, Results, or LB+View. Replay does not replace it.",
  },
  {
    id: "cup",
    name: "Rush Cup",
    blurb: "Gold on all nine stock tracks in order, then Author Cup unlocks on the same nine. Progress stays on this device.",
  },
  {
    id: "garage",
    name: "Garage",
    blurb: "Six liveries: Ivory, Violet, Sun, Frost, Carbon, Hazard. Cosmetic paint persists on this device.",
  },
];

export const FEATURE_MAP_IDS = FEATURE_MAP.map((row) => row.id);

export function trackVibeIds(): TrackId[] {
  return TRACK_VIBES.map((row) => row.id);
}

export function featureMapIdsMatchPlayable(): boolean {
  return trackVibeIds().join(",") === PLAYABLE_ORDER.join(",");
}

export const COPY = {
  productEyebrow: "Precision time trial",
  tagline: "Every checkpoint. Stay on the plastic. Beat the medals — or run Rush Cup.",
  padIdle: "Connect a controller — RT accel, LT brake, Y last CP, hold Y restart, LB+Y rewind, RB camera",
  menuHint: "WASD to drive · Space to slide · Backspace rewind · Esc to pause · Help for the full sheet",
  garageBlurb: "Choose a livery. Paint stays on the car across every track.",
  cupBlurb: "A nine-track medal campaign. Clear Gold, then Author. Progress stays on this device.",
  settingsBlurb: "Graphics, audio, camera, steering, Track Assist, Rewind, and stock laps. Changes apply immediately.",
  garageTitle: "Garage",
  cupEyebrow: "Campaign",
  selectEyebrow: "Select circuit",
  selectHotseatEyebrow: "Hotseat — P1 then P2",
  editorEyebrow: "Editor 1.1",
  helpTitle: "Help",
  helpEyebrow: "Feature map",
  helpBlurb: "Nine stock tracks, the TM-depth set, and the bindings that are actually live.",
  featureTitle: "TM-depth set",
  tracksTitle: "Tracks",
  driveTitle: "On track",
  menuTitle: "Menus",
  touchTitle: "Touch",
  photoTitle: "Photo mode",
  replayTitle: "Replay viewer",
  padNote: `Inner deadzone ${Math.round(PAD_STICK_DEADZONE * 100)}% stick, ${Math.round(PAD_TRIGGER_DEADZONE * 100)}% trigger. A resting pad does not steal keyboard or touch. Hot-plug shows a banner; Track Assist is unchanged. Compatible pads rumble on boost, crash, turbo, land, and finish.`,
  touchItems: [
    "Left pad steers. Sensitivity and invert live in Settings.",
    "Right cluster is Accel, Brake, and Slide. Brake wins if both are held.",
    "Respawn sits above the drive cluster — tap for last checkpoint, hold to restart the run. Pause is top-left.",
    "If Rewind is on, hold the Rewind button next to Respawn — a tap will not jump back.",
    "Auto-throttle is on by default on touch. Track Assist can pin you to the racing line.",
    "Photo mode hides the pads so orbit drag and Capture stay clean.",
  ],
  photoNotes: [
    "Open from the camera button, Pause, Results, F, or LB + View.",
    "The HUD hides for the still. Capture saves a PNG to your downloads.",
    "On a finished run you can follow the ghost and scrub the tape for a still.",
    "Photo mode stays a still — Watch replay on Results is the spectator view.",
  ],
  replayNotes: [
    "Open Watch replay from Results to follow the last run, shipped author ghost, PB, imported rival, or a hotseat tape.",
    "The camera rides the tape. Pause, play, and scrub the timeline; Done returns to Results.",
    "Photo mode is unchanged — open it from Results, Pause, F, or LB + View for orbit stills.",
  ],
  ghostTitle: "Ghost share",
  ghostBlurb: "Trackmania-style rival tapes. Export and import stay on this device — no account.",
  ghostNotes: [
    "Stock tracks ship an author-line ghost at medal pace so you always have a rival before a PB.",
    "The rival stays hidden through lights-out, fades when you overlap, and toasts PASSED / OVERTAKEN when the lead flips.",
    "Results and Tracks can export your last run or personal-best ghost as a JSON file.",
    "Import a friend's .json on that circuit to race their tape as a rival ghost.",
    "A rival is local only. It never overwrites your PB, last run, Cup, or Garage paint.",
    "Clear the rival from Tracks when you want the usual PB / last-run ghost back. Author ghosts return if no PB remains.",
  ],
  playNotes: [
    "Time trial — any track, any medal. First run races the author ghost; a PB or imported rival replaces it. Custom is a closed ribbon you build in the editor.",
    "Editor 1.1 — place checkpoints and boosts on the plan, undo/redo points, snap or flatten, and fly the ribbon. Rush Cup stays the stock nine.",
    "Hotseat — two players take turns on the same circuit. P2 races P1's ghost, then a local scoreboard.",
    "A Validated badge means rewind was not used. Local only — not online anti-cheat.",
    "Settings can set stock time-trial / hotseat laps to 1, 2, or 3. Rush Cup and Custom keep their own counts.",
    "Rush Cup — Gold on all nine, then Author. Next challenge unlocks in order.",
    "R (or Y) returns you to the last checkpoint. Hold R / Y, or press Delete, to restart the whole run.",
    "Hold Backspace or LB+Y to rewind the last few seconds. Allowed in time trial and Rush Cup — a finish after rewind can still be a PB.",
    "C cycles Chase → Far → Hood → Cabin. All four stay usable at speed.",
    "Garage paint is cosmetic only. Steering Slow/Normal/Fast and audio mix live under Settings.",
    "Surfaces change grip: plastic slides, dirt bites late, ice is icy, tech sticks.",
    "Ghost share — export a PB or last-run JSON from Results or Tracks, then import a rival to race that circuit.",
    "Race the ghost like a rival: it hides through lights-out, fades when you overlap, and toasts PASSED / OVERTAKEN when the lead flips.",
    "After a finish, Watch replay plays that tape as a spectator — last run, shipped author ghost, PB, imported rival, or a hotseat tape.",
  ],
  noMedal: "No medal this run. Bronze is the next target.",
  overlayError: "Overlay error",
  overlayErrorFallback: "The overlay crashed.",
} as const;

export function raceHint(kind: "keyboard" | "xbox" | "play"): string {
  if (kind === "xbox") return padRaceHint(true);
  if (kind === "play") return padRaceHint(false);
  return "WASD to drive · Space to slide · R last CP · hold R restart · Hold Backspace rewind · C camera · F photo · Esc to pause";
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

export function replayHint(touch: boolean): string {
  return touch
    ? "Play, scrub the timeline, then Done to return to results"
    : "Space plays · A/D scrubs · C camera · Esc returns to results";
}

export function pauseHint(input: { touch: boolean; cup?: boolean }): string {
  if (input.cup) return "Help lists every control. Options covers graphics, audio, and Track Assist.";
  if (input.touch) return "Resume keeps the run. Help lists every control. Options covers graphics, audio, and Track Assist.";
  return "Esc resumes. Help lists every control. Options covers graphics, audio, and Track Assist.";
}
