import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compactFrames,
  ghostQuality,
  pickRaceGhost,
  sampleGhost,
  sanitizeFrames,
  shouldRecord,
  wrapAngle,
} from "./ghost.ts";
import type { GhostFrame } from "./types.ts";

function frames(n: number, step = 40, sStep = 2): GhostFrame[] {
  return Array.from({ length: n }, (_, i) => ({
    t: i * step,
    s: i * sStep,
    n: Math.sin(i * 0.2) * 0.4,
    heading: i * 0.04,
  }));
}

describe("sanitize + quality", () => {
  it("drops junk and sorts by time", () => {
    const clean = sanitizeFrames([
      { t: 80, s: 4, n: 0, heading: 0 },
      { t: 40, s: 2, n: 0, heading: 0 },
      { t: 40, s: 9, n: 0, heading: 0 },
      { t: -1, s: 0, n: 0, heading: 0 },
      { t: 120, s: Number.NaN, n: 0, heading: 0 },
    ]);
    assert.ok(clean);
    assert.equal(clean.length, 2);
    assert.equal(clean[0]!.t, 40);
    assert.equal(ghostQuality(null), "none");
    assert.equal(ghostQuality(frames(4)), "weak");
    assert.equal(ghostQuality(frames(80)), "ok");
  });
});

describe("pickRaceGhost", () => {
  it("prefers a solid PB, then last run when PB is missing or thin", () => {
    const pb = frames(40);
    const last = frames(36, 40, 2.1);
    assert.equal(pickRaceGhost(pb, last).source, "pb");
    assert.equal(pickRaceGhost(frames(3), last).source, "last");
    assert.equal(pickRaceGhost(null, last).source, "last");
    assert.equal(pickRaceGhost(null, null).source, "none");
    assert.equal(pickRaceGhost(pb, last, "last").source, "last");
  });
});

describe("sampleGhost", () => {
  it("interpolates smoothly and holds the finish", () => {
    const rec = frames(20, 40, 3);
    const mid = sampleGhost(rec, 60, 200, true);
    assert.ok(mid);
    assert.ok(mid.s > rec[1]!.s && mid.s < rec[2]!.s);
    const done = sampleGhost(rec, 50_000, 200, true);
    assert.equal(done?.s, rec[rec.length - 1]!.s);
    const first = sampleGhost(rec, -10, 200, true);
    assert.equal(first?.s, rec[0]!.s);
  });

  it("wraps heading instead of lerping the long way", () => {
    const rec: GhostFrame[] = [
      { t: 0, s: 0, n: 0, heading: 3.0 },
      { t: 40, s: 2, n: 0, heading: -3.0 },
    ];
    const mid = sampleGhost(rec, 20, 100, false);
    assert.ok(mid);
    assert.ok(Math.abs(wrapAngle(mid.heading)) > 2.5, `heading ${mid.heading}`);
  });

  it("snaps across a respawn jump instead of stretching s", () => {
    const rec: GhostFrame[] = [
      { t: 0, s: 90, n: 0, heading: 0 },
      { t: 40, s: 4, n: 0, heading: 0 },
    ];
    const early = sampleGhost(rec, 10, 100, true);
    assert.equal(early?.s, 90);
  });
});

describe("record + compact", () => {
  it("caps record rate and keeps endpoints when compacting", () => {
    const a = { t: 0, s: 0, n: 0, heading: 0 };
    const tooSoon = { t: 8, s: 1, n: 0, heading: 0 };
    const due = { t: 40, s: 3, n: 0, heading: 0.2 };
    assert.equal(shouldRecord(undefined, a), true);
    assert.equal(shouldRecord(a, tooSoon), false);
    assert.equal(shouldRecord(a, due), true);
    const fat = frames(2000, 20, 1);
    const small = compactFrames(fat, 80);
    assert.ok(small.length <= 80);
    assert.equal(small[0]!.t, 0);
    assert.equal(small[small.length - 1]!.t, fat[fat.length - 1]!.t);
  });
});
