import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickRaceGhost, ghostQuality, sampleGhost } from "./ghost.ts";
import { TRACK_DEFS, getTrack } from "./track.ts";
import { TRACK_ORDER } from "./types.ts";
import {
  AUTHOR_FINISH_S,
  AUTHOR_FRAME_MS,
  AUTHOR_START_S,
  allAuthorGhosts,
  authorGhostFor,
  buildAuthorGhost,
  clearAuthorGhostCache,
} from "./author-ghost.ts";

describe("author ghosts", () => {
  it("builds a quality tape for every stock track at Author medal pace", () => {
    clearAuthorGhostCache();
    const pack = allAuthorGhosts();
    assert.equal(Object.keys(pack).length, TRACK_ORDER.length);
    for (const id of TRACK_ORDER) {
      const frames = pack[id];
      assert.ok(frames, id);
      const author = TRACK_DEFS[id].medals.author;
      assert.equal(ghostQuality(frames), "ok", id);
      assert.ok(frames.length >= 24, `${id} frames ${frames.length}`);
      assert.ok(frames.length <= 420, `${id} too fat ${frames.length}`);
      assert.equal(frames[0]!.t, 0);
      assert.ok(Math.abs(frames[0]!.s - AUTHOR_START_S) < 1.2, `${id} start ${frames[0]!.s}`);
      const last = frames[frames.length - 1]!;
      assert.equal(last.t, author);
      assert.ok(Math.abs(last.s - AUTHOR_FINISH_S) < 0.05, `${id} finish ${last.s}`);
      for (let i = 1; i < frames.length; i++) {
        assert.ok(frames[i]!.t > frames[i - 1]!.t, `${id} time ${i}`);
        assert.ok(frames[i]!.t - frames[i - 1]!.t <= AUTHOR_FRAME_MS + 1, `${id} gap ${i}`);
      }
      const mid = sampleGhost(frames, author * 0.45, getTrack(id).length, true);
      assert.ok(mid);
      assert.ok(Number.isFinite(mid.s));
    }
  });

  it("is missing on Custom and caches stock tapes", () => {
    assert.equal(authorGhostFor("custom"), null);
    const a = authorGhostFor("circuit");
    const b = authorGhostFor("circuit");
    assert.ok(a);
    assert.equal(a, b);
  });

  it("picks the author line when no PB or import exists", () => {
    const author = authorGhostFor("helix");
    assert.ok(author);
    assert.equal(pickRaceGhost(null, null, "auto", null, author).source, "author");
    assert.equal(pickRaceGhost(author, null, "auto", null, author).source, "pb");
    assert.equal(pickRaceGhost(null, null, "auto", author, author).source, "import");
  });

  it("stays on the ribbon and roughly follows Author time", () => {
    for (const id of TRACK_ORDER) {
      const track = getTrack(id);
      const frames = buildAuthorGhost(track);
      assert.ok(frames);
      const half = track.length * 0.48;
      for (const f of frames) {
        assert.ok(Math.abs(f.n) < Math.max(2.4, half * 0.01), `${id} n ${f.n}`);
        assert.ok(Math.abs(f.heading) < 0.7, `${id} heading ${f.heading}`);
      }
      assert.equal(frames[frames.length - 1]!.t, track.def.medals.author);
    }
  });
});
