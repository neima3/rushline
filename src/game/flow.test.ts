import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildResults,
  dismissControlsHint,
  ghostFinishDeltaMs,
  HINTS_KEY,
  loadHints,
  nextTrackId,
  parseHints,
  pbDeltaMs,
  persistHints,
  resultsHeadline,
} from "./flow.ts";
import type { GhostFrame } from "./types.ts";

function ghost(t: number): GhostFrame[] {
  return [
    { t: 0, s: 0, n: 0, heading: 0 },
    { t, s: 100, n: 0, heading: 0 },
  ];
}

describe("nextTrackId", () => {
  it("walks the campaign order and wraps", () => {
    assert.equal(nextTrackId("circuit"), "canyon");
    assert.equal(nextTrackId("canyon"), "helix");
    assert.equal(nextTrackId("helix"), "circuit");
  });
});

describe("pbDeltaMs", () => {
  it("is null on a first finish", () => {
    assert.equal(pbDeltaMs(52_000, null), null);
    assert.equal(pbDeltaMs(52_000, undefined), null);
  });

  it("is negative when the new time is faster", () => {
    assert.equal(pbDeltaMs(51_000, 52_400), -1_400);
    assert.equal(pbDeltaMs(54_000, 52_400), 1_600);
  });
});

describe("ghostFinishDeltaMs", () => {
  it("needs a real ghost tape", () => {
    assert.equal(ghostFinishDeltaMs(40_000, null), null);
    assert.equal(ghostFinishDeltaMs(40_000, []), null);
    assert.equal(ghostFinishDeltaMs(40_000, [{ t: 1, s: 0, n: 0, heading: 0 }]), null);
  });

  it("is negative when the player beat the ghost", () => {
    assert.equal(ghostFinishDeltaMs(39_200, ghost(40_000)), -800);
    assert.equal(ghostFinishDeltaMs(41_000, ghost(40_000)), 1_000);
  });
});

describe("resultsHeadline", () => {
  it("leads with the medal, then PB, then finished", () => {
    assert.equal(resultsHeadline("author", true), "Author medal");
    assert.equal(resultsHeadline("gold", false), "Gold medal");
    assert.equal(resultsHeadline(null, true), "Personal best");
    assert.equal(resultsHeadline(null, false), "Finished");
  });
});

describe("buildResults", () => {
  it("records a first-finish PB without a ghost compare", () => {
    const r = buildResults({ time: 55_000, trackId: "circuit", prevBest: null, ghost: null, medal: "gold" });
    assert.equal(r.isPb, true);
    assert.equal(r.best, 55_000);
    assert.equal(r.prevBest, null);
    assert.equal(r.medal, "gold");
    assert.equal(r.hadGhost, false);
    assert.equal(r.ghostDelta, null);
    assert.equal(r.nextTrackId, "canyon");
  });

  it("keeps the standing PB when the run is slower and compares the ghost", () => {
    const r = buildResults({
      time: 70_000,
      trackId: "circuit",
      prevBest: 52_000,
      ghost: ghost(52_000),
      medal: "bronze",
    });
    assert.equal(r.isPb, false);
    assert.equal(r.best, 52_000);
    assert.equal(r.prevBest, 52_000);
    assert.equal(r.medal, "bronze");
    assert.equal(r.hadGhost, true);
    assert.equal(r.ghostDelta, 18_000);
    assert.equal(r.nextTrackId, "canyon");
  });

  it("wraps Next after Night Helix", () => {
    const r = buildResults({ time: 30_000, trackId: "helix", prevBest: null, ghost: null, medal: "gold" });
    assert.equal(r.medal, "gold");
    assert.equal(r.nextTrackId, "circuit");
  });
});

describe("hints", () => {
  it("treats missing or garbage storage as not dismissed", () => {
    assert.deepEqual(parseHints(null), { controlsDismissed: false });
    assert.deepEqual(parseHints({ controlsDismissed: "yes" }), { controlsDismissed: false });
    assert.deepEqual(parseHints({ controlsDismissed: true }), { controlsDismissed: true });
  });

  it("round-trips dismiss through a fake store", () => {
    const mem = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
    };
    assert.equal(loadHints(storage).controlsDismissed, false);
    dismissControlsHint(storage);
    assert.equal(loadHints(storage).controlsDismissed, true);
    assert.ok(mem.get(HINTS_KEY)?.includes("true"));
    persistHints({ controlsDismissed: false }, storage);
    assert.equal(loadHints(storage).controlsDismissed, false);
  });
});
