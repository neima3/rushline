import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { commitRun, emptySave, memoryIo, parseSave, pushRecent } from "./persist.ts";
import type { GhostFrame } from "./types.ts";

function rec(n = 40): GhostFrame[] {
  return Array.from({ length: n }, (_, i) => ({ t: i * 40, s: i * 2, n: 0, heading: 0 }));
}

describe("commitRun", () => {
  it("writes PB time + ghost and keeps a last-run copy", () => {
    const io = memoryIo();
    const first = commitRun("circuit", 52_000, rec(50), io);
    assert.equal(first.isPb, true);
    assert.equal(first.savedBest, true);
    assert.equal(first.savedGhost, true);
    assert.equal(first.savedLast, true);
    const save = parseSave(io.getItem("rushline-v1"));
    assert.equal(save.best.circuit, 52_000);
    assert.ok((save.ghosts.circuit?.length ?? 0) >= 2);

    const slower = commitRun("circuit", 58_000, rec(44), io);
    assert.equal(slower.isPb, false);
    assert.equal(slower.best, 52_000);
    const after = parseSave(io.getItem("rushline-v1"));
    assert.equal(after.best.circuit, 52_000);
    assert.equal(after.ghosts.circuit?.length, save.ghosts.circuit?.length);
  });

  it("still records a last run when the PB write is refused", () => {
    const io = memoryIo();
    const realSet = io.setItem;
    io.setItem = (key, value) => {
      if (key === "rushline-v1") throw new Error("quota");
      realSet(key, value);
    };
    const result = commitRun("helix", 33_000, rec(30), io);
    assert.equal(result.savedBest, false);
    assert.equal(result.savedLast, true);
    assert.ok(io.getItem("rushline-last-v1"));
  });
});

describe("parseSave livery", () => {
  it("keeps a garage pick through a PB write", () => {
    const io = memoryIo({
      "rushline-v1": JSON.stringify({ version: 1, best: {}, ghosts: {}, livery: "carbon" }),
    });
    const save = parseSave(io.getItem("rushline-v1"));
    assert.equal(save.livery, "carbon");
    commitRun("circuit", 50_000, rec(40), io, save);
    const after = parseSave(io.getItem("rushline-v1"));
    assert.equal(after.livery, "carbon");
    assert.equal(after.best.circuit, 50_000);
  });

  it("drops an unknown paint without wiping times", () => {
    const parsed = parseSave(JSON.stringify({ version: 1, best: { circuit: 40_000 }, ghosts: {}, livery: "turbo" }));
    assert.equal(parsed.livery, undefined);
    assert.equal(parsed.best.circuit, 40_000);
    assert.equal(emptySave().livery, undefined);
  });
});

describe("pushRecent", () => {
  it("keeps a short local board newest-first", () => {
    const list = pushRecent(pushRecent(pushRecent([], 40_000), 39_000), 41_000);
    assert.deepEqual(list, [41_000, 39_000, 40_000]);
    const more = pushRecent([1, 2, 3, 4, 5], 6);
    assert.equal(more.length, 5);
    assert.equal(more[0], 6);
  });
});
