import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { PAD_MAP } from "./gamepad.ts";
import {
  COPY,
  FEATURE_MAP,
  FEATURE_MAP_IDS,
  MENU_CONTROL_ROWS,
  PHOTO_CONTROL_ROWS,
  RACE_CONTROL_ROWS,
  REPLAY_CONTROL_ROWS,
  TRACK_VIBES,
  featureMapIdsMatchPlayable,
  firstRunBody,
  selectListHint,
  pauseHint,
  photoHint,
  raceHint,
  replayHint,
  trackVibeIds,
} from "./help.ts";
import { PLAYABLE_ORDER, TRACK_ORDER } from "./types.ts";

const README = readFileSync(new URL("../../README.md", import.meta.url), "utf8");

describe("help control sheet", () => {
  it("documents every live race binding against PAD_MAP", () => {
    const byId = Object.fromEntries(RACE_CONTROL_ROWS.map((row) => [row.id, row]));
    assert.equal(byId.steer?.pad, PAD_MAP.steer);
    assert.equal(byId.throttle?.pad, PAD_MAP.throttle);
    assert.equal(byId.brake?.pad, PAD_MAP.brake);
    assert.equal(byId.slide?.pad, PAD_MAP.slide);
    assert.equal(byId.respawn?.pad, PAD_MAP.respawn);
    assert.equal(byId.restart?.pad, PAD_MAP.restart);
    assert.equal(byId.rewind?.pad, PAD_MAP.rewind);
    assert.equal(byId.camera?.pad, PAD_MAP.camera);
    assert.equal(byId.photo?.pad, PAD_MAP.photo);
    assert.equal(byId.pause?.pad, PAD_MAP.pause);
    assert.match(byId.steer!.keys, /A \/ D/);
    assert.match(byId.throttle!.keys, /W/);
    assert.match(byId.brake!.keys, /S/);
    assert.match(byId.slide!.keys, /Space/);
    assert.equal(byId.respawn!.keys, "R");
    assert.match(byId.restart!.keys, /Delete/);
    assert.match(byId.respawn!.action, /last CP/);
    assert.match(byId.rewind!.keys, /Backspace/);
    assert.equal(byId.camera!.keys, "C");
    assert.match(byId.camera!.action, /Cycle/);
    assert.equal(byId.photo!.keys, "F");
    assert.match(byId.pause!.keys, /Esc/);
  });

  it("covers menu, photo, and touch so the sheet matches the shipped UI", () => {
    assert.equal(MENU_CONTROL_ROWS.length, 3);
    assert.ok(PHOTO_CONTROL_ROWS.some((row) => row.id === "capture" && row.keys === "Enter"));
    assert.ok(COPY.touchItems.some((line) => /Rewind/.test(line)));
    assert.ok(COPY.playNotes.some((line) => /rewind/i.test(line)));
    assert.ok(COPY.playNotes.some((line) => /Custom/.test(line)));
    assert.ok(COPY.playNotes.some((line) => /Editor 1\.1/.test(line) && /undo\/redo/.test(line)));
    assert.equal(COPY.editorEyebrow, "Editor 1.1");
    assert.ok(COPY.touchItems.some((line) => /Left pad/.test(line)));
    assert.ok(COPY.touchItems.some((line) => /hold to restart/.test(line)));
    assert.ok(COPY.photoNotes.some((line) => /PNG/.test(line)));
    assert.ok(COPY.photoNotes.some((line) => /Watch replay/.test(line)));
    assert.ok(REPLAY_CONTROL_ROWS.some((row) => row.id === "play" && /Space/.test(row.keys)));
    assert.ok(COPY.replayNotes.some((line) => /imported rival/.test(line)));
    assert.ok(COPY.playNotes.some((line) => /Watch replay/.test(line)));
    assert.match(COPY.tagline, /Rush Cup/);
    assert.match(COPY.cupBlurb, /Gold/);
    assert.match(COPY.garageBlurb, /livery/i);
    assert.match(COPY.ghostTitle, /Ghost share/i);
    assert.ok(COPY.ghostNotes.some((line) => /author-line ghost/i.test(line)));
    assert.ok(COPY.ghostNotes.some((line) => /PASSED/.test(line) && /OVERTAKEN/.test(line)));
    assert.ok(COPY.playNotes.some((line) => /PASSED/.test(line) && /lights-out/.test(line)));
    assert.ok(COPY.ghostNotes.some((line) => /export/i.test(line) && /JSON/i.test(line)));
    assert.ok(COPY.ghostNotes.some((line) => /import/i.test(line)));
    assert.ok(COPY.ghostNotes.some((line) => /never overwrites/i.test(line)));
    assert.ok(COPY.playNotes.some((line) => /author ghost/i.test(line)));
    assert.ok(COPY.playNotes.some((line) => /Ghost share/i.test(line)));
    assert.ok(COPY.playNotes.some((line) => /Hotseat/.test(line)));
    assert.ok(COPY.playNotes.some((line) => /Validated/.test(line)));
    assert.match(COPY.selectHotseatEyebrow, /Hotseat/);
    assert.equal(selectListHint(), `${TRACK_ORDER.length} circuits · scroll`);
    assert.match(COPY.selectMoreHint, /More circuits/);
  });

  it("keeps runtime hint strings aligned with the sheet", () => {
    assert.match(raceHint("keyboard"), /Backspace/);
    assert.match(raceHint("keyboard"), /WASD/);
    assert.match(raceHint("keyboard"), /last CP/);
    assert.match(raceHint("keyboard"), /hold R restart/);
    assert.match(COPY.playNotes.join(" "), /last checkpoint/);
    assert.match(COPY.playNotes.join(" "), /Chase/);
    assert.match(raceHint("xbox"), /LB\+Y rewind/);
    assert.match(raceHint("xbox"), /last CP/);
    assert.match(raceHint("play"), /L1\+△ rewind/);
    assert.match(firstRunBody({ touch: true, padActive: false }), /Left pad/);
    assert.match(firstRunBody({ touch: false, padActive: true }), /Help/);
    assert.match(photoHint(false), /WASD/);
    assert.match(photoHint(true), /PNG/);
    assert.match(replayHint(false), /Space/);
    assert.match(replayHint(true), /timeline/);
    assert.match(pauseHint({ touch: false }), /Esc resumes/);
    assert.match(pauseHint({ touch: true, cup: true }), /Help/);
  });
});

describe("TM-depth feature map", () => {
  it("lists nine stock tracks plus Custom with vibes", () => {
    assert.equal(featureMapIdsMatchPlayable(), true);
    assert.deepEqual(trackVibeIds(), [...PLAYABLE_ORDER]);
    assert.equal(TRACK_VIBES.length, 10);
    assert.equal(TRACK_VIBES.filter((row) => row.id !== "custom").length, 9);
    const names = TRACK_VIBES.map((row) => row.name);
    for (const name of [
      "Green Circuit",
      "Ridge Drop",
      "Night Helix",
      "White Pass",
      "Arc Yard",
      "Red Mesa",
      "Black Hollow",
      "Ember Caldera",
      "Storm Dock",
      "Custom",
    ]) {
      assert.ok(names.includes(name), `missing track ${name}`);
    }
    for (const row of TRACK_VIBES) {
      assert.ok(row.vibe.length > 2, `${row.id} vibe`);
      assert.ok(row.signature.length > 8, `${row.id} signature`);
    }
  });

  it("catalogs every TM-depth feature Help and README must ship", () => {
    assert.deepEqual(FEATURE_MAP_IDS, [
      "rewind",
      "surfaces",
      "cameras",
      "respawn",
      "ghost-share",
      "author-ghosts",
      "editor",
      "hotseat",
      "validated",
      "stock-laps",
      "replay",
      "photo",
      "cup",
      "garage",
    ]);
    const text = FEATURE_MAP.map((row) => `${row.name} ${row.blurb}`).join("\n");
    assert.match(text, /Backspace/);
    assert.match(text, /Chase → Far → Hood → Cabin/);
    assert.match(text, /last checkpoint/);
    assert.match(text, /author-line ghost/i);
    assert.match(text, /PASSED \/ OVERTAKEN/);
    assert.match(text, /Editor 1\.1/);
    assert.match(text, /click-to-place checkpoints and boost pads/);
    assert.match(text, /undo\/redo/);
    assert.match(text, /snap-to-grid/);
    assert.match(text, /flythrough/);
    assert.match(text, /P2 races P1/);
    assert.match(text, /not online anti-cheat/);
    assert.match(text, /1 \/ 2 \/ 3/);
    assert.match(text, /Watch replay/);
    assert.match(text, /Ivory/);
    assert.match(COPY.helpEyebrow, /Feature map/i);
    assert.match(COPY.helpBlurb, /TM-depth/);
    assert.match(COPY.featureTitle, /TM-depth/);
  });

  it("keeps README aligned with the Help feature map and control rows", () => {
    assert.match(README, /## Feature map/);
    assert.match(README, /## Tracks/);
    assert.match(README, /## Controls/);
    for (const track of TRACK_VIBES) {
      assert.ok(README.includes(track.name), `README missing ${track.name}`);
      assert.ok(README.includes(track.vibe), `README missing vibe ${track.vibe}`);
    }
    for (const row of FEATURE_MAP) {
      assert.ok(README.includes(`**${row.name}**`) || README.includes(row.name), `README missing feature ${row.name}`);
    }
    for (const row of RACE_CONTROL_ROWS) {
      assert.ok(README.includes(row.keys), `README missing keys ${row.keys}`);
      assert.ok(README.includes(row.pad), `README missing pad ${row.pad}`);
    }
    assert.match(README, /Hold R or Delete/);
    assert.match(README, /LB \+ Y/);
    assert.match(README, /Chase → Far → Hood → Cabin/);
  });
});
