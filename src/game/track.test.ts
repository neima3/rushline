import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allTrackDefs, getTrack, medalFor, medalPace, TRACK_DEFS } from "./track.ts";

describe("White Pass", () => {
  it("compiles a closed alpine ribbon with checkpoints and boosts", () => {
    const def = TRACK_DEFS.summit;
    assert.equal(def.name, "White Pass");
    assert.equal(def.env, "alpine");
    assert.equal(def.laps, 1);
    assert.equal(def.closed, true);
    assert.ok(def.thumb.includes("summit"));

    const track = getTrack("summit");
    assert.ok(track.samples.length > 80, `samples ${track.samples.length}`);
    assert.ok(track.length > 800 && track.length < 1600, `length ${track.length}`);
    assert.ok(track.checkpoints.length >= 3, `cps ${track.checkpoints.join(",")}`);
    assert.ok(track.boosts.length >= 2, `boosts ${track.boosts.join(",")}`);
    for (let i = 1; i < track.checkpoints.length; i++) {
      assert.ok(track.checkpoints[i]! > track.checkpoints[i - 1]!, "checkpoints advance");
    }
    const first = track.samples[0]!;
    const last = track.samples[track.samples.length - 1]!;
    const seam = Math.hypot(first.x - last.x, first.y - last.y, first.z - last.z);
    assert.ok(seam < 18, `close seam ${seam}`);
  });

  it("has a rising medal ladder and ghost-ready save key", () => {
    const m = TRACK_DEFS.summit.medals;
    assert.ok(m.author < m.gold && m.gold < m.silver && m.silver < m.bronze);
    assert.equal(medalFor("summit", m.author), "author");
    assert.equal(medalFor("summit", m.gold), "gold");
    assert.equal(medalFor("summit", m.silver), "silver");
    assert.equal(medalFor("summit", m.bronze), "bronze");
    assert.equal(medalFor("summit", m.bronze + 1), null);
    const pace = medalPace("summit", 0);
    assert.equal(pace.holding, "author");
    assert.ok((pace.remain ?? 0) > 0);
  });

  it("stores a White Pass ghost on the same save shape as the other tracks", () => {
    const ghost = [{ t: 0, s: 6, n: 0, heading: 0 }, { t: 400, s: 18, n: 0.1, heading: 0 }];
    const save = { version: 1 as const, best: { summit: 31_200 }, ghosts: { summit: ghost } };
    assert.equal(save.best.summit, 31_200);
    assert.equal(save.ghosts.summit?.length, 2);
    assert.equal(medalFor("summit", save.best.summit), "gold");
  });

  it("lists White Pass after the original three without rewriting them", () => {
    const ids = allTrackDefs().map((t) => t.id);
    assert.deepEqual(ids, ["circuit", "canyon", "helix", "summit"]);
    assert.equal(TRACK_DEFS.circuit.name, "Green Circuit");
    assert.equal(TRACK_DEFS.canyon.name, "Ridge Drop");
    assert.equal(TRACK_DEFS.helix.name, "Night Helix");
    assert.equal(TRACK_DEFS.circuit.medals.author, 50_000);
    assert.equal(TRACK_DEFS.helix.env, "night");
  });
});
