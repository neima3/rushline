import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type * as THREE from "three";
import { TrackTextureRegistry } from "./track-scene-cache.ts";
import {
  disposeTrackTexturesKeepingSky,
  sceneEnvironmentIsDisposed,
  swapSkyEnvRenderTarget,
} from "./sky-env-handoff.ts";

function mockRt(label: string) {
  const texture = { uuid: label } as THREE.Texture;
  let disposed = false;
  return {
    texture,
    get disposed() {
      return disposed;
    },
    dispose() {
      disposed = true;
    },
  };
}

describe("swapSkyEnvRenderTarget", () => {
  it("keeps scene.environment on the old RT until the new bake is assigned, then disposes the old RT once", () => {
    const oldRt = mockRt("old");
    const newRt = mockRt("new");
    let sceneEnv: THREE.Texture | null = oldRt.texture;

    assert.equal(oldRt.disposed, false);
    assert.equal(sceneEnvironmentIsDisposed(sceneEnv, oldRt, false), false);

    const swap = swapSkyEnvRenderTarget(sceneEnv, oldRt, newRt);
    sceneEnv = swap.sceneEnvironment;
    swap.rtToDispose?.dispose();

    assert.equal(sceneEnv, newRt.texture);
    assert.equal(oldRt.disposed, true);
    assert.equal(newRt.disposed, false);
    assert.equal(sceneEnvironmentIsDisposed(oldRt.texture, oldRt, true), true);
    assert.equal(sceneEnvironmentIsDisposed(sceneEnv, newRt, false), false);
  });

  it("clears scene.environment and disposes the sky RT when switching to no sky env", () => {
    const oldRt = mockRt("old");
    let sceneEnv: THREE.Texture | null = oldRt.texture;
    const cleared = swapSkyEnvRenderTarget(sceneEnv, oldRt, null);
    sceneEnv = cleared.sceneEnvironment;
    cleared.rtToDispose?.dispose();
    assert.equal(sceneEnv, null);
    assert.equal(oldRt.disposed, true);
  });
});

describe("disposeTrackTexturesKeepingSky", () => {
  it("does not dispose the in-flight sky JPG during a track rebuild sweep", () => {
    const reg = new TrackTextureRegistry();
    let skyDisposes = 0;
    let roadDisposes = 0;
    const sky = { dispose: () => skyDisposes++ } as unknown as THREE.Texture;
    const road = { dispose: () => roadDisposes++ } as unknown as THREE.Texture;
    reg.add(sky);
    reg.add(road);
    assert.equal(disposeTrackTexturesKeepingSky(reg, sky), 1);
    assert.equal(skyDisposes, 0);
    assert.equal(roadDisposes, 1);
    assert.deepEqual(reg.live, [sky]);
    reg.disposeTrackTextures();
    assert.equal(skyDisposes, 1);
  });
});
