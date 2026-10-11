import type * as THREE from "three";
import type { BuiltTrack, ThemeId } from "./types.ts";
import { textureBudget, type QualityProfile } from "./quality.ts";

/** Canvas texture budget key — rebuild track meshes when this changes. */
export function trackSceneVisualKey(quality: QualityProfile): string {
  const budget = textureBudget(quality.tier);
  return `${quality.tier}:${budget.size}:${budget.roughnessMap ? 1 : 0}:${budget.anisotropy}`;
}

export type TrackSceneCache = {
  track: BuiltTrack;
  theme: ThemeId;
  visualKey: string;
};

export function shouldRebuildTrackScene(
  cache: TrackSceneCache | null,
  track: BuiltTrack,
  theme: ThemeId,
  visualKey: string,
  opts?: { forceRebuild?: boolean; sceneBuilt?: boolean },
): boolean {
  if (opts?.forceRebuild) return true;
  if (!cache || !opts?.sceneBuilt) return true;
  if (cache.track !== track) return true;
  if (cache.theme !== theme) return true;
  if (cache.visualKey !== visualKey) return true;
  return false;
}

/** Tracks canvas textures for the current track load; flat count across switches. */
export class TrackTextureRegistry {
  readonly live: THREE.Texture[] = [];
  private track: THREE.Texture[] = [];

  add(tex: THREE.Texture) {
    this.track.push(tex);
    this.live.push(tex);
  }

  disposeTrackTextures() {
    for (const tex of this.track) {
      tex.dispose();
      const idx = this.live.indexOf(tex);
      if (idx >= 0) this.live.splice(idx, 1);
    }
    this.track = [];
  }

  removeAndDispose(tex: THREE.Texture | null | undefined) {
    if (!tex) return;
    tex.dispose();
    this.drop(tex);
  }

  drop(tex: THREE.Texture) {
    let idx = this.track.indexOf(tex);
    if (idx >= 0) this.track.splice(idx, 1);
    idx = this.live.indexOf(tex);
    if (idx >= 0) this.live.splice(idx, 1);
  }
}
