import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyQuality,
  applySteerSettings,
  defaultSettings,
  loadSettings,
  parseSettings,
  qualityProfile,
} from "./settings.ts";

describe("defaultSettings", () => {
  it("uses High graphics and manual throttle on desktop", () => {
    const s = defaultSettings(false);
    assert.equal(s.quality, "high");
    assert.equal(s.shadows, true);
    assert.equal(s.bloom, true);
    assert.equal(s.autoThrottle, false);
    assert.equal(s.trackAssist, "off");
    assert.equal(s.motionBlur, false);
  });

  it("uses Medium graphics and auto-throttle on touch", () => {
    const s = defaultSettings(true);
    assert.equal(s.quality, "medium");
    assert.equal(s.shadows, true);
    assert.equal(s.bloom, false);
    assert.equal(s.autoThrottle, true);
    assert.equal(s.trackAssist, "medium");
    assert.ok(qualityProfile("medium").dprCap <= 1.5);
    assert.ok(qualityProfile("medium").particleDensity < 1);
  });
});

describe("qualityProfile", () => {
  it("caps Low DPR and kills shadows/bloom", () => {
    const q = qualityProfile("low");
    assert.equal(q.shadows, false);
    assert.equal(q.bloom, false);
    assert.equal(q.dprCap, 1);
    assert.ok(q.particleDensity < 0.3);
    assert.ok(q.fogFarMul <= 0.55);
  });

  it("keeps High at full draw distance and particles", () => {
    const q = qualityProfile("high");
    assert.equal(q.dprCap, 2);
    assert.equal(q.particleDensity, 1);
    assert.equal(q.cameraFar, 900);
    assert.equal(q.shadowMap, 1536);
  });
});

describe("applyQuality", () => {
  it("resets graphics toggles to the preset", () => {
    const dirty = { ...defaultSettings(false), shadows: false, bloom: false, motionBlur: true };
    const low = applyQuality(dirty, "low");
    assert.equal(low.quality, "low");
    assert.equal(low.shadows, false);
    assert.equal(low.bloom, false);
    assert.equal(low.motionBlur, false);
    const high = applyQuality(low, "high");
    assert.equal(high.shadows, true);
    assert.equal(high.bloom, true);
  });

  it("does not wipe camera, audio, or livery", () => {
    const s = applyQuality({ ...defaultSettings(false), master: 0.2, fov: 70, livery: "frost" }, "low");
    assert.equal(s.master, 0.2);
    assert.equal(s.fov, 70);
    assert.equal(s.livery, "frost");
  });
});

describe("parseSettings", () => {
  it("returns defaults for garbage", () => {
    assert.equal(parseSettings(null, true).quality, "medium");
    assert.equal(parseSettings("nope", false).quality, "high");
  });

  it("clamps and keeps a persisted round-trip", () => {
    const s = parseSettings({
      quality: "low",
      shadows: false,
      bloom: true,
      motionBlur: true,
      showFps: true,
      master: 1.8,
      sfx: -2,
      music: 0.5,
      chaseDistance: 9,
      fov: 12,
      cameraShake: 4,
      touchSteerSensitivity: 0.1,
      trackAssist: "high",
      autoThrottle: false,
      invertSteer: true,
      showSpeed: false,
      showMinimap: false,
      ghostOpacity: 2,
    });
    assert.equal(s.quality, "low");
    assert.equal(s.shadows, false);
    assert.equal(s.bloom, true);
    assert.equal(s.master, 1);
    assert.equal(s.sfx, 0);
    assert.equal(s.chaseDistance, 1.45);
    assert.equal(s.fov, 50);
    assert.equal(s.cameraShake, 1.5);
    assert.equal(s.touchSteerSensitivity, 0.45);
    assert.equal(s.trackAssist, "high");
    assert.equal(s.invertSteer, true);
    assert.equal(s.autoThrottle, false);
    assert.equal(s.showSpeed, false);
    assert.equal(s.ghostOpacity, 1);
    assert.equal(s.livery, "ivory");
  });

  it("keeps a saved livery and falls back on garbage", () => {
    assert.equal(parseSettings({ livery: "hazard" }, false).livery, "hazard");
    assert.equal(parseSettings({ livery: "turbo" }, true).livery, "ivory");
    assert.equal(defaultSettings(false).livery, "ivory");
    assert.equal(loadSettings(false, "carbon").livery, "carbon");
    assert.equal(loadSettings(false, "nope").livery, "ivory");
  });
});

describe("parseSettings trackAssist", () => {
  it("falls back to the platform default for missing or garbage values", () => {
    assert.equal(parseSettings({}, false).trackAssist, "off");
    assert.equal(parseSettings({}, true).trackAssist, "medium");
    assert.equal(parseSettings({ trackAssist: "turbo" }, true).trackAssist, "medium");
    assert.equal(parseSettings({ trackAssist: "low" }, false).trackAssist, "low");
  });
});

describe("applySteerSettings", () => {
  it("scales only the touch stick", () => {
    assert.equal(applySteerSettings(0.2, 0, 0.5, { sensitivity: 2, invert: false }), 1);
    assert.ok(Math.abs(applySteerSettings(0.2, 0, 0, { sensitivity: 2, invert: false }) - 0.2) < 1e-6);
  });

  it("inverts the combined steer", () => {
    assert.equal(applySteerSettings(1, 0, 0, { sensitivity: 1, invert: true }), -1);
    assert.equal(applySteerSettings(0, 0, 0.4, { sensitivity: 1, invert: true }), -0.4);
  });
});
