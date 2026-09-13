import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PAD_MAP } from "./gamepad.ts";
import {
  COPY,
  MENU_CONTROL_ROWS,
  PHOTO_CONTROL_ROWS,
  RACE_CONTROL_ROWS,
  firstRunBody,
  pauseHint,
  photoHint,
  raceHint,
} from "./help.ts";

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
    assert.ok(COPY.touchItems.some((line) => /Left pad/.test(line)));
    assert.ok(COPY.touchItems.some((line) => /hold to restart/.test(line)));
    assert.ok(COPY.photoNotes.some((line) => /PNG/.test(line)));
    assert.match(COPY.tagline, /Rush Cup/);
    assert.match(COPY.cupBlurb, /Gold/);
    assert.match(COPY.garageBlurb, /livery/i);
    assert.match(COPY.ghostTitle, /Ghost share/i);
    assert.ok(COPY.ghostNotes.some((line) => /author-line ghost/i.test(line)));
    assert.ok(COPY.ghostNotes.some((line) => /export/i.test(line) && /JSON/i.test(line)));
    assert.ok(COPY.ghostNotes.some((line) => /import/i.test(line)));
    assert.ok(COPY.ghostNotes.some((line) => /never overwrites/i.test(line)));
    assert.ok(COPY.playNotes.some((line) => /author ghost/i.test(line)));
    assert.ok(COPY.playNotes.some((line) => /Ghost share/i.test(line)));
    assert.ok(COPY.playNotes.some((line) => /Hotseat/.test(line)));
    assert.ok(COPY.playNotes.some((line) => /Validated/.test(line)));
    assert.match(COPY.selectHotseatEyebrow, /Hotseat/);
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
    assert.match(pauseHint({ touch: false }), /Esc resumes/);
    assert.match(pauseHint({ touch: true, cup: true }), /Help/);
  });
});
