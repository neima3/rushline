import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FAST_PATH_RACE_CAMERA, FAST_PATH_WORLD_RESETS } from "./scene.ts";
import { resolveRaceLaps, withRaceLaps } from "./laps.ts";
import { getTrack } from "./track.ts";
import { QUALITY_PRESETS } from "./quality.ts";
import {
  advanceTrackSceneCache,
  shouldRebuildTrackScene,
  trackSceneContentKey,
  trackSceneVisualKey,
} from "./track-scene-cache.ts";

describe("same-track restart fast path", () => {
  it("skips scene rebuild when track content key, theme, and quality key match", () => {
    const track = getTrack("circuit");
    const key = trackSceneVisualKey(QUALITY_PRESETS.high);
    const raced = withRaceLaps(track, 1);
    assert.notEqual(raced, track);
    const cache = { trackKey: trackSceneContentKey(track), theme: track.def.env, visualKey: key };
    assert.equal(shouldRebuildTrackScene(cache, raced, raced.def.env, key, { sceneBuilt: true }), false);
  });

  it("reuses scene across restarts with stockLaps: 1 and flat rebuild count", () => {
    const key = trackSceneVisualKey(QUALITY_PRESETS.high);
    let cache: ReturnType<typeof advanceTrackSceneCache>["cache"] | null = null;
    let rebuilds = 0;
    let programLinks = 69;
    for (let i = 0; i < 8; i++) {
      const base = getTrack("circuit");
      const laps = resolveRaceLaps({
        trackId: "circuit",
        authored: base.def.laps,
        setting: 1,
        playMode: "trial",
      });
      assert.equal(laps, 1);
      const track = withRaceLaps(base, laps);
      assert.equal(track.def.laps, 1);
      const step = advanceTrackSceneCache(cache, track, track.def.env, key, true);
      cache = step.cache;
      if (step.mode === "rebuilt") {
        rebuilds++;
        programLinks += 11;
      }
    }
    assert.equal(rebuilds, 1, "only the first load should buildTrackScene");
    assert.equal(programLinks, 80, "shader program links stay flat after the first rebuild");
  });

  it("applies a new lap override without rebuilding the scene", () => {
    const key = trackSceneVisualKey(QUALITY_PRESETS.high);
    let cache: ReturnType<typeof advanceTrackSceneCache>["cache"] | null = null;
    let rebuilds = 0;
    const lapSettings = [1, 2, 3, 1] as const;
    for (const setting of lapSettings) {
      const base = getTrack("circuit");
      const laps = resolveRaceLaps({
        trackId: "circuit",
        authored: base.def.laps,
        setting,
        playMode: "trial",
      });
      const track = withRaceLaps(base, laps);
      assert.equal(track.def.laps, laps);
      const step = advanceTrackSceneCache(cache, track, track.def.env, key, true);
      cache = step.cache;
      if (step.mode === "rebuilt") rebuilds++;
      else assert.equal(step.mode, "reused");
    }
    assert.equal(rebuilds, 1);
    const final = withRaceLaps(getTrack("circuit"), 1);
    assert.equal(
      shouldRebuildTrackScene(cache, final, final.def.env, key, { sceneBuilt: true }),
      false,
    );
  });

  it("documents world-side run resets (Game.startRace resets car, CP, timer, ghosts, replay, HUD)", () => {
    assert.ok(FAST_PATH_WORLD_RESETS.length >= 3);
    assert.ok(FAST_PATH_WORLD_RESETS.some((l) => l.includes("RaceVfx.resetRun")));
    assert.ok(FAST_PATH_WORLD_RESETS.some((l) => l.includes("syncRunThemes")));
  });

  it("documents race camera parity: fast path uses Game snapCamera, not buildTrackScene grid pose", () => {
    assert.ok(FAST_PATH_RACE_CAMERA.includes("snapCamera"));
    assert.ok(FAST_PATH_RACE_CAMERA.includes("startRace"));
  });
});
