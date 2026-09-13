import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ghostSpeedAt,
  isReplaySource,
  listReplayTapes,
  pickReplayTape,
  replayDurationMs,
  replayProgress,
  replaySourceLabel,
  replayTimeAt,
  stepReplayClock,
} from "./replay.ts";
import type { GhostFrame } from "./types.ts";

function rec(n = 40, step = 40, sStep = 2): GhostFrame[] {
  return Array.from({ length: n }, (_, i) => ({
    t: i * step,
    s: i * sStep,
    n: 0,
    heading: i * 0.02,
  }));
}

describe("replay catalog", () => {
  it("lists last, shipped author, PB, and imported rivals as distinct tapes", () => {
    const last = { time: 52_000, frames: rec(40) };
    const pb = { time: 50_000, frames: rec(36, 40, 2.1) };
    const imported = { time: 48_400, frames: rec(48, 35) };
    const author = { time: 51_000, frames: rec(50, 40, 1.8) };
    const tapes = listReplayTapes({
      trackId: "circuit",
      last,
      pb,
      imported,
      author,
    });
    assert.deepEqual(
      tapes.map((t) => t.source),
      ["author", "import", "pb", "last"],
    );
    assert.equal(tapes.find((t) => t.source === "author")?.label, "Author ghost");
    assert.equal(tapes.find((t) => t.source === "import")?.label, "Rival");
    assert.equal(pickReplayTape(tapes)?.source, "last");
    assert.equal(pickReplayTape(tapes, "import")?.source, "import");
    assert.equal(pickReplayTape(tapes, "pb")?.source, "pb");
    assert.equal(pickReplayTape(tapes, "author")?.source, "author");
  });

  it("does not relabel a beating-author PB as the shipped author tape", () => {
    const pb = { time: 48_000, frames: rec(36, 40, 2.1) };
    const author = { time: 50_000, frames: rec(50, 40, 1.8) };
    const tapes = listReplayTapes({
      trackId: "ember",
      pb,
      author,
    });
    assert.deepEqual(
      tapes.map((t) => t.source),
      ["author", "pb"],
    );
  });

  it("collapses a just-set PB onto one PB tape instead of last+PB", () => {
    const frames = rec(30);
    const run = { time: 49_500, frames };
    const tapes = listReplayTapes({
      trackId: "storm",
      last: run,
      pb: run,
    });
    assert.equal(tapes.length, 1);
    assert.equal(tapes[0]!.source, "pb");
  });

  it("keeps a slower last run next to a standing PB", () => {
    const tapes = listReplayTapes({
      trackId: "canyon",
      last: { time: 44_000, frames: rec(28, 42) },
      pb: { time: 40_000, frames: rec(32) },
    });
    assert.deepEqual(
      tapes.map((t) => t.source),
      ["pb", "last"],
    );
    assert.equal(replaySourceLabel("pb"), "PB ghost");
  });

  it("lists a hotseat tape beside last and author", () => {
    const last = { time: 41_200, frames: rec(28, 42) };
    const hotseat = { time: 39_800, frames: rec(34, 38, 2.2) };
    const author = { time: 40_000, frames: rec(50, 40, 1.8) };
    const tapes = listReplayTapes({
      trackId: "helix",
      last,
      hotseat,
      author,
    });
    assert.deepEqual(
      tapes.map((t) => t.source),
      ["author", "hotseat", "last"],
    );
    assert.equal(replaySourceLabel("hotseat"), "Hotseat");
    assert.equal(pickReplayTape(tapes, "hotseat")?.source, "hotseat");
  });

  it("returns nothing when every tape is missing or thin", () => {
    assert.deepEqual(
      listReplayTapes({
        trackId: "helix",
        last: { time: 20_000, frames: [{ t: 0, s: 0, n: 0, heading: 0 }] },
        pb: null,
        imported: null,
        author: null,
        hotseat: null,
      }),
      [],
    );
    assert.equal(pickReplayTape([]), null);
    assert.equal(isReplaySource("author"), true);
    assert.equal(isReplaySource("hotseat"), true);
    assert.equal(isReplaySource("none"), false);
  });
});

describe("replay clock + scrub", () => {
  const frames = rec(11, 100);

  it("maps 0–1 onto the tape and reports duration", () => {
    assert.equal(replayTimeAt(frames, 0), 0);
    assert.equal(replayTimeAt(frames, 1), 1000);
    assert.equal(replayTimeAt(frames, 0.5), 500);
    assert.equal(replayDurationMs(frames), 1000);
    assert.equal(replayProgress(frames, 250), 0.25);
    assert.equal(replayProgress(null, 10), 0);
    assert.equal(replayTimeAt(null, 0.4), null);
  });

  it("advances while playing and freezes at the finish", () => {
    const mid = stepReplayClock(200, 50, true, frames);
    assert.equal(mid.time, 250);
    assert.equal(mid.playing, true);
    assert.equal(mid.ended, false);
    const end = stepReplayClock(980, 80, true, frames);
    assert.equal(end.time, 1000);
    assert.equal(end.playing, false);
    assert.equal(end.ended, true);
    const paused = stepReplayClock(400, 200, false, frames);
    assert.equal(paused.time, 400);
    assert.equal(paused.playing, false);
  });

  it("estimates ribbon speed from neighboring samples", () => {
    const speed = ghostSpeedAt(rec(20, 40, 2), 200, 200);
    assert.ok(speed > 40 && speed < 60, `speed ${speed}`);
    assert.equal(ghostSpeedAt(null, 0), 0);
  });
});
