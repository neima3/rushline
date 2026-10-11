import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getTrack } from "./track.ts";
import { QUALITY_PRESETS } from "./quality.ts";
import { withRaceLaps } from "./laps.ts";
import {
  shouldRebuildTrackScene,
  trackSceneContentKey,
  trackSceneVisualKey,
  TrackTextureRegistry,
  type TrackSceneCache,
} from "./track-scene-cache.ts";

describe("track scene cache", () => {
  const circuit = getTrack("circuit");
  const canyon = getTrack("canyon");
  const highKey = trackSceneVisualKey(QUALITY_PRESETS.high);
  const lowKey = trackSceneVisualKey(QUALITY_PRESETS.low);

  it("reuses when track content key, theme, and visual key match", () => {
    const cache: TrackSceneCache = { trackKey: trackSceneContentKey(circuit), theme: "stadium", visualKey: highKey };
    assert.equal(
      shouldRebuildTrackScene(cache, circuit, "stadium", highKey, { sceneBuilt: true }),
      false,
    );
  });

  it("reuses when lap override clones the track object without changing geometry", () => {
    const cache: TrackSceneCache = { trackKey: trackSceneContentKey(circuit), theme: circuit.def.env, visualKey: highKey };
    const raced = withRaceLaps(circuit, 1);
    assert.notEqual(raced, circuit);
    assert.equal(
      shouldRebuildTrackScene(cache, raced, raced.def.env, highKey, { sceneBuilt: true }),
      false,
    );
  });

  it("rebuilds on track change, theme change, or quality key change", () => {
    const cache: TrackSceneCache = { trackKey: trackSceneContentKey(circuit), theme: "stadium", visualKey: highKey };
    assert.equal(shouldRebuildTrackScene(cache, canyon, "stadium", highKey, { sceneBuilt: true }), true);
    assert.equal(shouldRebuildTrackScene(cache, circuit, "canyon", highKey, { sceneBuilt: true }), true);
    assert.equal(shouldRebuildTrackScene(cache, circuit, "stadium", lowKey, { sceneBuilt: true }), true);
    assert.equal(shouldRebuildTrackScene(cache, circuit, "stadium", highKey, { forceRebuild: true }), true);
  });

  it("rebuilds when nothing is cached or the scene was never built", () => {
    const cache: TrackSceneCache = { trackKey: trackSceneContentKey(circuit), theme: "stadium", visualKey: highKey };
    assert.equal(shouldRebuildTrackScene(null, circuit, "stadium", highKey, { sceneBuilt: true }), true);
    assert.equal(shouldRebuildTrackScene(cache, circuit, "stadium", highKey, { sceneBuilt: false }), true);
  });
});

describe("TrackTextureRegistry", () => {
  it("disposeTrackTexturesExcept keeps the sky JPG until loadSky replaces it", () => {
    const reg = new TrackTextureRegistry();
    let skyD = 0;
    let groundD = 0;
    const sky = { dispose: () => skyD++ } as unknown as import("three").Texture;
    const ground = { dispose: () => groundD++ } as unknown as import("three").Texture;
    reg.add(sky);
    reg.add(ground);
    assert.equal(reg.disposeTrackTexturesExcept(sky), 1);
    assert.equal(skyD, 0);
    assert.equal(groundD, 1);
  });

  it("disposes track textures and keeps the live set flat across switches", () => {
    const reg = new TrackTextureRegistry();
    let disposeCount = 0;
    const make = () => {
      const tex = {
        dispose() {
          disposeCount++;
        },
      };
      return tex as unknown as import("three").Texture;
    };

    for (let round = 0; round < 5; round++) {
      const batch = [make(), make(), make()];
      for (const t of batch) reg.add(t);
      assert.equal(reg.live.length, batch.length);
      reg.disposeTrackTextures();
      assert.equal(reg.live.length, 0);
      assert.equal(disposeCount, (round + 1) * batch.length);
    }
  });
});
