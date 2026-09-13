import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cloneSave,
  customDefFromSave,
  defaultCustomSave,
  editorFlythroughPose,
  emptyPointHistory,
  estimateLoopLength,
  flattenRibbon,
  insertPoint,
  MIN_EDITOR_POINTS,
  parseCustomSave,
  placeOnRibbon,
  recordPointChange,
  redoPoints,
  removePoint,
  snapCoord,
  snapPointsToGrid,
  undoPoints,
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

describe("editor 1.1 placement + history", () => {
  it("toggles a boost or checkpoint on a nearby point", () => {
    const start = defaultCustomSave().points;
    const boostAt = start.findIndex((p) => p.boost);
    assert.ok(boostAt > 0);
    const p = start[boostAt]!;
    const cleared = placeOnRibbon(start, p.x, p.z, "boost");
    assert.equal(cleared.changed, true);
    assert.equal(cleared.points[boostAt]?.boost, false);
    const cp = start.find((pt) => pt.checkpoint)!;
    const added = placeOnRibbon(start, cp.x + 0.2, cp.z - 0.2, "checkpoint");
    assert.equal(added.changed, true);
    assert.equal(added.points.filter((pt) => pt.checkpoint).length, start.filter((pt) => pt.checkpoint).length - 1);
  });

  it("refuses a checkpoint on the start line and drops one on the ribbon", () => {
    const start = defaultCustomSave().points;
    const refuse = placeOnRibbon(start, start[0]!.x, start[0]!.z, "checkpoint");
    assert.equal(refuse.changed, false);
    assert.match(refuse.message, /Start/);
    const placed = placeOnRibbon(start, 70, -110, "checkpoint", false);
    assert.equal(placed.changed, true);
    assert.equal(placed.points.length, start.length + 1);
    assert.equal(placed.points[placed.selected]?.checkpoint, true);
    const boost = placeOnRibbon(start, 120, 40, "boost");
    assert.equal(boost.changed, true);
    assert.equal(boost.points[boost.selected]?.boost, true);
  });

  it("snaps and flattens without touching stock Cup order", () => {
    assert.equal(snapCoord(11.6, 8), 8);
    assert.equal(snapCoord(13, 8), 16);
    const start = defaultCustomSave().points;
    const snapped = snapPointsToGrid(start, 8);
    assert.ok(snapped.every((p) => p.x % 8 === 0 && p.z % 8 === 0));
    const flat = flattenRibbon(start.map((p, i) => (i === 2 ? { ...p, y: 6, bank: 0.4 } : p)));
    assert.ok(flat.every((p) => p.y <= 0.03 && Math.abs(p.bank) < 1e-6));
    assert.equal(CUP_EVENTS.gold.length, 9);
    assert.ok(CUP_EVENTS.gold.every((e) => e.trackId !== "custom"));
  });

  it("undoes and redoes a control-point edit", () => {
    const start = defaultCustomSave().points;
    let history = emptyPointHistory();
    const next = insertPoint(start, 1, { x: 20, z: -40 });
    history = recordPointChange(history, start);
    const back = undoPoints(history, next);
    assert.ok(back);
    assert.equal(back.points.length, start.length);
    const forth = redoPoints(back.history, back.points);
    assert.ok(forth);
    assert.equal(forth.points.length, start.length + 1);
    assert.equal(undoPoints(emptyPointHistory(), start), null);
  });

  it("flies the camera behind the sample looking forward", () => {
    const sm = { x: 10, y: 1, z: 4, tx: 0, ty: 0, tz: 1, ux: 0, uy: 1, uz: 0 };
    const pose = editorFlythroughPose(sm);
    const camDot = (pose.cam.x - sm.x) * sm.tx + (pose.cam.y - sm.y) * sm.ty + (pose.cam.z - sm.z) * sm.tz;
    const lookDot = (pose.look.x - sm.x) * sm.tx + (pose.look.y - sm.y) * sm.ty + (pose.look.z - sm.z) * sm.tz;
    assert.ok(camDot < 0, `cam ${camDot}`);
    assert.ok(lookDot > 0, `look ${lookDot}`);
    assert.ok(pose.cam.y > sm.y);
  });
});
