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
    assert.deepEqual(ids.slice(0, 5), ["circuit", "canyon", "helix", "summit", "yard"]);
    assert.equal(TRACK_DEFS.circuit.name, "Green Circuit");
    assert.equal(TRACK_DEFS.canyon.name, "Ridge Drop");
    assert.equal(TRACK_DEFS.helix.name, "Night Helix");
    assert.equal(TRACK_DEFS.circuit.medals.author, 50_000);
    assert.equal(TRACK_DEFS.helix.env, "night");
  });

  it("tags each ribbon with a Trackmania surface kind", () => {
    assert.equal(TRACK_DEFS.circuit.defaultSurface, "plastic");
    assert.equal(TRACK_DEFS.canyon.defaultSurface, "dirt");
    assert.equal(TRACK_DEFS.helix.defaultSurface, "tech");
    assert.equal(TRACK_DEFS.summit.defaultSurface, "ice");
    assert.equal(TRACK_DEFS.yard.defaultSurface, "tech");
    assert.equal(TRACK_DEFS.mesa.defaultSurface, "dirt");
    assert.equal(TRACK_DEFS.hollow.defaultSurface, "dirt");
    assert.equal(TRACK_DEFS.ember.defaultSurface, "dirt");
    assert.equal(TRACK_DEFS.storm.defaultSurface, "plastic");
    const circuit = getTrack("circuit");
    const canyon = getTrack("canyon");
    const summit = getTrack("summit");
    const yard = getTrack("yard");
    const mesa = getTrack("mesa");
    const hollow = getTrack("hollow");
    const ember = getTrack("ember");
    const storm = getTrack("storm");
    assert.ok(circuit.samples.every((s) => s.surface === "plastic"));
    assert.ok(summit.samples.every((s) => s.surface === "ice"));
    assert.ok(yard.samples.every((s) => s.surface === "tech"));
    assert.ok(canyon.samples.some((s) => s.surface === "plastic"));
    assert.ok(canyon.samples.some((s) => s.surface === "dirt"));
    assert.ok(canyon.samples.filter((s) => s.surface === "dirt").length > canyon.samples.length * 0.5);
    assert.ok(mesa.samples.some((s) => s.surface === "dirt"));
    assert.ok(mesa.samples.some((s) => s.surface === "plastic"));
    assert.ok(mesa.samples.filter((s) => s.surface === "dirt").length > mesa.samples.length * 0.45);
    assert.ok(hollow.samples.some((s) => s.surface === "dirt"));
    assert.ok(hollow.samples.some((s) => s.surface === "tech"));
    assert.ok(hollow.samples.filter((s) => s.surface === "dirt").length > hollow.samples.length * 0.4);
    assert.ok(ember.samples.some((s) => s.surface === "dirt"));
    assert.ok(ember.samples.some((s) => s.surface === "plastic"));
    assert.ok(ember.samples.filter((s) => s.surface === "dirt").length > ember.samples.length * 0.4);
    assert.ok(storm.samples.some((s) => s.surface === "plastic"));
    assert.ok(storm.samples.some((s) => s.surface === "ice"));
    assert.ok(storm.samples.some((s) => s.surface === "tech"));
    assert.ok(storm.samples.filter((s) => s.surface === "plastic").length > storm.samples.length * 0.3);
  });
});

describe("Arc Yard", () => {
  it("compiles a closed works ribbon with checkpoints and boosts", () => {
    const def = TRACK_DEFS.yard;
    assert.equal(def.name, "Arc Yard");
    assert.equal(def.env, "works");
    assert.equal(def.laps, 1);
    assert.equal(def.closed, true);
    assert.ok(def.thumb.includes("yard"));

    const track = getTrack("yard");
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
    const m = TRACK_DEFS.yard.medals;
    assert.ok(m.author < m.gold && m.gold < m.silver && m.silver < m.bronze);
    assert.equal(medalFor("yard", m.author), "author");
    assert.equal(medalFor("yard", m.gold), "gold");
    assert.equal(medalFor("yard", m.silver), "silver");
    assert.equal(medalFor("yard", m.bronze), "bronze");
    assert.equal(medalFor("yard", m.bronze + 1), null);
    const pace = medalPace("yard", 0);
    assert.equal(pace.holding, "author");
    assert.ok((pace.remain ?? 0) > 0);
  });

  it("stores an Arc Yard ghost on the same save shape as the other tracks", () => {
    const ghost = [
      { t: 0, s: 6, n: 0, heading: 0 },
      { t: 400, s: 18, n: 0.1, heading: 0 },
    ];
    const save = { version: 1 as const, best: { yard: 32_400 }, ghosts: { yard: ghost } };
    assert.equal(save.best.yard, 32_400);
    assert.equal(save.ghosts.yard?.length, 2);
    assert.equal(medalFor("yard", save.best.yard), "gold");
  });

  it("lists Arc Yard after White Pass without rewriting the first four", () => {
    const ids = allTrackDefs().map((t) => t.id);
    assert.deepEqual(ids.slice(0, 5), ["circuit", "canyon", "helix", "summit", "yard"]);
    assert.equal(TRACK_DEFS.summit.name, "White Pass");
    assert.equal(TRACK_DEFS.summit.env, "alpine");
    assert.equal(TRACK_DEFS.helix.env, "night");
    assert.equal(TRACK_DEFS.circuit.medals.author, 50_000);
  });
});

describe("Red Mesa", () => {
  it("compiles a closed mesa ribbon with checkpoints and boosts", () => {
    const def = TRACK_DEFS.mesa;
    assert.equal(def.name, "Red Mesa");
    assert.equal(def.env, "mesa");
    assert.equal(def.laps, 1);
    assert.equal(def.closed, true);
    assert.ok(def.thumb.includes("mesa"));

    const track = getTrack("mesa");
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
    const m = TRACK_DEFS.mesa.medals;
    assert.ok(m.author < m.gold && m.gold < m.silver && m.silver < m.bronze);
    assert.equal(medalFor("mesa", m.author), "author");
    assert.equal(medalFor("mesa", m.gold), "gold");
    assert.equal(medalFor("mesa", m.silver), "silver");
    assert.equal(medalFor("mesa", m.bronze), "bronze");
    assert.equal(medalFor("mesa", m.bronze + 1), null);
    const pace = medalPace("mesa", 0);
    assert.equal(pace.holding, "author");
    assert.ok((pace.remain ?? 0) > 0);
  });

  it("stores a Red Mesa ghost on the same save shape as the other tracks", () => {
    const ghost = [
      { t: 0, s: 6, n: 0, heading: 0 },
      { t: 400, s: 18, n: 0.1, heading: 0 },
    ];
    const save = { version: 1 as const, best: { mesa: 33_200 }, ghosts: { mesa: ghost } };
    assert.equal(save.best.mesa, 33_200);
    assert.equal(save.ghosts.mesa?.length, 2);
    assert.equal(medalFor("mesa", save.best.mesa), "gold");
  });
});

describe("Black Hollow", () => {
  it("compiles a closed grove ribbon with checkpoints and boosts", () => {
    const def = TRACK_DEFS.hollow;
    assert.equal(def.name, "Black Hollow");
    assert.equal(def.env, "grove");
    assert.equal(def.laps, 1);
    assert.equal(def.closed, true);
    assert.ok(def.thumb.includes("hollow"));

    const track = getTrack("hollow");
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
    const m = TRACK_DEFS.hollow.medals;
    assert.ok(m.author < m.gold && m.gold < m.silver && m.silver < m.bronze);
    assert.equal(medalFor("hollow", m.author), "author");
    assert.equal(medalFor("hollow", m.gold), "gold");
    assert.equal(medalFor("hollow", m.silver), "silver");
    assert.equal(medalFor("hollow", m.bronze), "bronze");
    assert.equal(medalFor("hollow", m.bronze + 1), null);
    const pace = medalPace("hollow", 0);
    assert.equal(pace.holding, "author");
    assert.ok((pace.remain ?? 0) > 0);
  });

  it("lists Red Mesa and Black Hollow after Arc Yard without rewriting the first five", () => {
    const ids = allTrackDefs().map((t) => t.id);
    assert.deepEqual(ids.slice(0, 7), ["circuit", "canyon", "helix", "summit", "yard", "mesa", "hollow"]);
    assert.equal(ids[7], "ember");
    assert.equal(ids[8], "storm");
    assert.equal(ids[9], "custom");
    assert.equal(TRACK_DEFS.yard.name, "Arc Yard");
    assert.equal(TRACK_DEFS.yard.env, "works");
    assert.equal(TRACK_DEFS.helix.env, "night");
    assert.equal(TRACK_DEFS.circuit.medals.author, 50_000);
    assert.equal(TRACK_DEFS.mesa.env, "mesa");
    assert.equal(TRACK_DEFS.hollow.env, "grove");
  });
});

describe("Ember Caldera", () => {
  it("compiles a closed ember ribbon with checkpoints and boosts", () => {
    const def = TRACK_DEFS.ember;
    assert.equal(def.name, "Ember Caldera");
    assert.equal(def.env, "ember");
    assert.equal(def.laps, 1);
    assert.equal(def.closed, true);
    assert.ok(def.thumb.includes("ember"));

    const track = getTrack("ember");
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
    const m = TRACK_DEFS.ember.medals;
    assert.ok(m.author < m.gold && m.gold < m.silver && m.silver < m.bronze);
    assert.equal(medalFor("ember", m.author), "author");
    assert.equal(medalFor("ember", m.gold), "gold");
    assert.equal(medalFor("ember", m.silver), "silver");
    assert.equal(medalFor("ember", m.bronze), "bronze");
    assert.equal(medalFor("ember", m.bronze + 1), null);
    const pace = medalPace("ember", 0);
    assert.equal(pace.holding, "author");
    assert.ok((pace.remain ?? 0) > 0);
  });

  it("stores an Ember Caldera ghost on the same save shape as the other tracks", () => {
    const ghost = [
      { t: 0, s: 6, n: 0, heading: 0 },
      { t: 400, s: 18, n: 0.1, heading: 0 },
    ];
    const save = { version: 1 as const, best: { ember: 34_000 }, ghosts: { ember: ghost } };
    assert.equal(save.best.ember, 34_000);
    assert.equal(save.ghosts.ember?.length, 2);
    assert.equal(medalFor("ember", save.best.ember), "gold");
  });
});

describe("Storm Dock", () => {
  it("compiles a closed storm ribbon with checkpoints and boosts", () => {
    const def = TRACK_DEFS.storm;
    assert.equal(def.name, "Storm Dock");
    assert.equal(def.env, "storm");
    assert.equal(def.laps, 1);
    assert.equal(def.closed, true);
    assert.ok(def.thumb.includes("storm"));

    const track = getTrack("storm");
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
    const m = TRACK_DEFS.storm.medals;
    assert.ok(m.author < m.gold && m.gold < m.silver && m.silver < m.bronze);
    assert.equal(medalFor("storm", m.author), "author");
    assert.equal(medalFor("storm", m.gold), "gold");
    assert.equal(medalFor("storm", m.silver), "silver");
    assert.equal(medalFor("storm", m.bronze), "bronze");
    assert.equal(medalFor("storm", m.bronze + 1), null);
    const pace = medalPace("storm", 0);
    assert.equal(pace.holding, "author");
    assert.ok((pace.remain ?? 0) > 0);
  });

  it("lists Ember Caldera and Storm Dock after Black Hollow without rewriting the first seven", () => {
    const ids = allTrackDefs().map((t) => t.id);
    assert.deepEqual(ids.slice(0, 9), ["circuit", "canyon", "helix", "summit", "yard", "mesa", "hollow", "ember", "storm"]);
    assert.equal(ids[9], "custom");
    assert.equal(TRACK_DEFS.hollow.name, "Black Hollow");
    assert.equal(TRACK_DEFS.hollow.env, "grove");
    assert.equal(TRACK_DEFS.helix.env, "night");
    assert.equal(TRACK_DEFS.circuit.medals.author, 50_000);
    assert.equal(TRACK_DEFS.ember.env, "ember");
    assert.equal(TRACK_DEFS.storm.env, "storm");
  });
});
