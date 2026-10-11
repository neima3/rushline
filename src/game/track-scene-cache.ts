import type * as THREE from "three";
import type { BuiltTrack, ThemeId } from "./types.ts";
import { textureBudget, type QualityProfile } from "./quality.ts";

/** Canvas texture budget key — rebuild track meshes when this changes. */
export function trackSceneVisualKey(quality: QualityProfile): string {
  const budget = textureBudget(quality.tier);
  return `${quality.tier}:${budget.size}:${budget.roughnessMap ? 1 : 0}:${budget.anisotropy}`;
}

/** Geometry / layout identity — ignores lap overrides and object identity. */
export function trackSceneContentKey(track: BuiltTrack): string {
  return `${track.def.id}:${track.samples.length}:${track.length.toFixed(3)}`;
}

export type TrackSceneCache = {
  trackKey: string;
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
  if (cache.trackKey !== trackSceneContentKey(track)) return true;
  if (cache.theme !== theme) return true;
  if (cache.visualKey !== visualKey) return true;
  return false;
}

/** Pure loadTrack cache step for tests (counts rebuild vs reuse). */
export function advanceTrackSceneCache(
  cache: TrackSceneCache | null,
  track: BuiltTrack,
  theme: ThemeId,
  visualKey: string,
  sceneBuilt: boolean,
  opts?: { forceRebuild?: boolean },
): { cache: TrackSceneCache; mode: "rebuilt" | "reused" } {
  const rebuild = shouldRebuildTrackScene(cache, track, theme, visualKey, {
    forceRebuild: opts?.forceRebuild,
    sceneBuilt,
  });
  if (rebuild) {
    return {
      cache: { trackKey: trackSceneContentKey(track), theme, visualKey },
      mode: "rebuilt",
    };
  }
  return { cache: cache!, mode: "reused" };
}

/** Tracks canvas textures for the current track load; flat count across switches. */
export class TrackTextureRegistry {
  readonly live: THREE.Texture[] = [];
  private track: THREE.Texture[] = [];

  add(tex: THREE.Texture) {
    this.track.push(tex);
    this.live.push(tex);
  }

  push(tex: THREE.Texture) {
    this.add(tex);
  }

  disposeTrackTextures() {
    this.disposeTrackTexturesExcept(null);
  }

  /** Disposes track-owned textures, optionally keeping the current sky JPG for loadSky handoff. */
  disposeTrackTexturesExcept(keep: THREE.Texture | null): number {
    let disposed = 0;
    const remaining: THREE.Texture[] = [];
    for (const tex of this.track) {
      if (keep && tex === keep) {
        remaining.push(tex);
        continue;
      }
      tex.dispose();
      disposed++;
      const idx = this.live.indexOf(tex);
      if (idx >= 0) this.live.splice(idx, 1);
    }
    this.track = remaining;
    return disposed;
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
