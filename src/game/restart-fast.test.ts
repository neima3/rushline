import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FAST_PATH_WORLD_RESETS } from "./scene.ts";
import { getTrack } from "./track.ts";
import { QUALITY_PRESETS } from "./quality.ts";
import { shouldRebuildTrackScene, trackSceneVisualKey } from "./track-scene-cache.ts";

describe("same-track restart fast path", () => {
  it("skips scene rebuild when track ref, theme, and quality key match", () => {
    const track = getTrack("circuit");
    const key = trackSceneVisualKey(QUALITY_PRESETS.high);
    const cache = { track, theme: track.def.env, visualKey: key };
    assert.equal(shouldRebuildTrackScene(cache, track, track.def.env, key, { sceneBuilt: true }), false);
  });

  it("documents world-side run resets (Game.startRace resets car, CP, timer, ghosts, replay, HUD)", () => {
    assert.ok(FAST_PATH_WORLD_RESETS.length >= 3);
    assert.ok(FAST_PATH_WORLD_RESETS.some((l) => l.includes("RaceVfx.resetRun")));
    assert.ok(FAST_PATH_WORLD_RESETS.some((l) => l.includes("syncRunThemes")));
  });
});
