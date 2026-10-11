import type * as THREE from "three";
import { TrackTextureRegistry } from "./track-scene-cache.ts";

export type EnvRenderTarget = {
  texture: THREE.Texture;
  dispose(): void;
};

/** Assign a new sky PMREM RT; dispose the previous RT only after the scene points at the new one. */
export function swapSkyEnvRenderTarget(
  sceneEnvironment: THREE.Texture | null | undefined,
  previousRt: EnvRenderTarget | null,
  nextRt: EnvRenderTarget | null,
): { sceneEnvironment: THREE.Texture | null; rtToDispose: EnvRenderTarget | null } {
  if (!nextRt) {
    const linked = previousRt != null && sceneEnvironment === previousRt.texture;
    return {
      sceneEnvironment: linked ? null : (sceneEnvironment ?? null),
      rtToDispose: linked ? previousRt : null,
    };
  }
  const rtToDispose = previousRt && previousRt !== nextRt ? previousRt : null;
  return { sceneEnvironment: nextRt.texture, rtToDispose };
}

/** True when scene.environment still references a disposed RT (invalid). */
export function sceneEnvironmentIsDisposed(
  sceneEnvironment: THREE.Texture | null | undefined,
  rt: EnvRenderTarget | null,
  rtDisposed: boolean,
): boolean {
  if (!sceneEnvironment || !rt || !rtDisposed) return false;
  return sceneEnvironment === rt.texture;
}

/** Disposes track-owned textures except the in-flight sky JPG (handed off in loadSky). */
export function disposeTrackTexturesKeepingSky(
  registry: TrackTextureRegistry,
  keepSkyJpg: THREE.Texture | null | undefined,
): number {
  return registry.disposeTrackTexturesExcept(keepSkyJpg ?? null);
}
