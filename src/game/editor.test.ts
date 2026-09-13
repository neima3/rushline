import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cloneSave,
  customDefFromSave,
  defaultCustomSave,
  estimateLoopLength,
  insertPoint,
  MIN_EDITOR_POINTS,
  parseCustomSave,
  removePoint,
  validateCustom,
  writeCustomSave,
} from "./editor.ts";
import { CUP_EVENTS } from "./cup.ts";
import { nextTrackId } from "./flow.ts";
import { allTrackDefs, getTrack, getTrackDef, TRACK_DEFS, validateCustomBuild } from "./track.ts";
import { PLAYABLE_ORDER, TRACK_ORDER } from "./types.ts";

describe("custom track save", () => {
  it("parses garbage as the default oval", () => {
    const fallback = defaultCustomSave();
    assert.equal(parseCustomSave(null).points.length, fallback.points.length);
    assert.equal(parseCustomSave("{").name, "Custom");
    assert.equal(parseCustomSave(JSON.stringify({ version: 2, points: [] })).env, "stadium");
  });

  it("round-trips a valid closed ribbon", () => {
    const save = defaultCustomSave();
    save.name = "Night Cut";
    save.env = "night";
    save.surface = "tech";
    const parsed = parseCustomSave(JSON.stringify(save));
    assert.equal(parsed.name, "Night Cut");
    assert.equal(parsed.env, "night");
    assert.equal(parsed.surface, "tech");
    assert.equal(parsed.points.length, save.points.length);
    assert.ok(validateCustom(parsed).ok);
    assert.ok(estimateLoopLength(parsed.points) > 400);
  });

  it("rejects a three-point scribble", () => {
    const save = cloneSave(defaultCustomSave());
    save.points = save.points.slice(0, 3);
    const issue = validateCustom(save);
    assert.equal(issue.ok, false);
    assert.ok(issue.errors.some((e) => /4/.test(e)));
  });

  it("inserts and removes without dropping below the floor", () => {
    const start = defaultCustomSave().points;
    const added = insertPoint(start, 1, { x: 20, z: -40 });
    assert.equal(added.length, start.length + 1);
    let cur = added;
    while (cur.length > MIN_EDITOR_POINTS) cur = removePoint(cur, 1);
    assert.equal(cur.length, MIN_EDITOR_POINTS);
    assert.equal(removePoint(cur, 0).length, MIN_EDITOR_POINTS);
  });

  it("writes to a memory store", () => {
    const data: Record<string, string> = {};
    const io = {
      getItem: (key: string) => data[key] ?? null,
      setItem: (key: string, value: string) => {
        data[key] = value;
      },
    };
    const save = defaultCustomSave();
    save.name = "Yard Cut";
    assert.equal(writeCustomSave(save, io), true);
    assert.match(data["rushline-custom-v1"] ?? "", /Yard Cut/);
  });
});

describe("custom mesh + menu slot", () => {
  it("compiles a closed driveable ribbon from the default oval", () => {
    const def = customDefFromSave(defaultCustomSave());
    assert.equal(def.id, "custom");
    assert.equal(def.closed, true);
    assert.ok(def.nodes.length >= 4);
    const built = getTrack("custom");
    assert.ok(built.samples.length > 40, `samples ${built.samples.length}`);
    assert.ok(built.length > 300, `length ${built.length}`);
    const mesh = validateCustomBuild();
    assert.equal(mesh.ok, true, mesh.errors.join("; "));
    assert.ok(mesh.checkpoints >= 1);
    const first = built.samples[0]!;
    const last = built.samples[built.samples.length - 1]!;
    const seam = Math.hypot(first.x - last.x, first.y - last.y, first.z - last.z);
    assert.ok(seam < 18, `seam ${seam}`);
  });

  it("lists Custom after the nine stock tracks and keeps Cup on stock only", () => {
    const ids = allTrackDefs().map((t) => t.id);
    assert.deepEqual(ids.slice(0, 9), [...TRACK_ORDER]);
    assert.equal(ids[9], "custom");
    assert.deepEqual(PLAYABLE_ORDER, [...TRACK_ORDER, "custom"]);
    assert.ok(!TRACK_ORDER.includes("custom" as never));
    assert.equal(CUP_EVENTS.gold.length, 9);
    assert.equal(CUP_EVENTS.author.length, 9);
    assert.ok(CUP_EVENTS.gold.every((e) => e.trackId !== "custom"));
    assert.equal(getTrackDef("custom").id, "custom");
    assert.equal(TRACK_DEFS.circuit.name, "Green Circuit");
    assert.equal(TRACK_DEFS.hollow.name, "Black Hollow");
    assert.equal(TRACK_DEFS.ember.name, "Ember Caldera");
    assert.equal(TRACK_DEFS.storm.name, "Storm Dock");
    assert.equal(nextTrackId("custom"), "circuit");
    assert.equal(nextTrackId("storm"), "circuit");
  });
});
