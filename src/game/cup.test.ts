import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyCupFinish,
  commitCupRun,
  continueEvent,
  CUP_EVENTS,
  CUP_KEY,
  cupHeadline,
  emptyCup,
  getCupEvent,
  isEventUnlocked,
  medalMeets,
  parseCup,
} from "./cup.ts";
function memoryIo() {
  const data: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in data ? data[key]! : null),
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

describe("medalMeets", () => {
  it("counts Author as Gold, but Gold is not Author", () => {
    assert.equal(medalMeets("author", "gold"), true);
    assert.equal(medalMeets("gold", "gold"), true);
    assert.equal(medalMeets("silver", "gold"), false);
    assert.equal(medalMeets("gold", "author"), false);
    assert.equal(medalMeets("author", "author"), true);
    assert.equal(medalMeets(null, "gold"), false);
  });
});

describe("parseCup", () => {
  it("treats missing or garbage storage as a fresh Gold Cup", () => {
    const fresh = emptyCup();
    assert.deepEqual(parseCup(null), fresh);
    assert.deepEqual(parseCup("{"), fresh);
    assert.deepEqual(parseCup(JSON.stringify({ version: 2 })), fresh);
    assert.equal(parseCup(null).unlocked.gold, 0);
    assert.equal(parseCup(null).unlocked.author, -1);
  });

  it("keeps valid medals and unlocks Author after a Gold sweep", () => {
    const medals = Object.fromEntries(CUP_EVENTS.gold.map((e) => [e.id, "gold"]));
    const parsed = parseCup(JSON.stringify({ version: 1, medals, goldComplete: true }));
    assert.equal(parsed.goldComplete, true);
    assert.equal(parsed.unlocked.author, 0);
    assert.equal(parsed.medals["gold-circuit"], "gold");
  });
});

describe("applyCupFinish", () => {
  it("does not unlock the next event on a miss", () => {
    const after = applyCupFinish(emptyCup(), CUP_EVENTS.gold[0]!, 80_000, "bronze");
    assert.equal(after.unlocked.gold, 0);
    assert.equal(after.medals["gold-circuit"], "bronze");
    assert.equal(after.times["gold-circuit"], 80_000);
    assert.equal(continueEvent(after)?.id, "gold-circuit");
  });

  it("unlocks the next Gold event and keeps a faster retry", () => {
    const first = applyCupFinish(emptyCup(), CUP_EVENTS.gold[0]!, 55_000, "gold");
    assert.equal(first.unlocked.gold, 1);
    assert.equal(isEventUnlocked(first, CUP_EVENTS.gold[1]!), true);
    assert.equal(continueEvent(first)?.id, "gold-canyon");

    const slower = applyCupFinish(first, CUP_EVENTS.gold[0]!, 57_000, "gold");
    assert.equal(slower.times["gold-circuit"], 55_000);
    assert.equal(slower.medals["gold-circuit"], "gold");

    const author = applyCupFinish(first, CUP_EVENTS.gold[0]!, 49_000, "author");
    assert.equal(author.times["gold-circuit"], 49_000);
    assert.equal(author.medals["gold-circuit"], "author");
  });

  it("clears Gold Cup and opens Author; later results skip to the next uncleared event", () => {
    let progress = emptyCup();
    for (const ev of CUP_EVENTS.gold) {
      progress = applyCupFinish(progress, ev, 40_000, "gold");
    }
    assert.equal(progress.goldComplete, true);
    assert.equal(progress.unlocked.author, 0);
    assert.equal(continueEvent(progress)?.id, "author-circuit");

    const replay = applyCupFinish(progress, CUP_EVENTS.gold[0]!, 39_000, "author");
    assert.equal(continueEvent(replay)?.id, "author-circuit");
  });

  it("completes the campaign after the Author sweep", () => {
    let progress = emptyCup();
    for (const ev of [...CUP_EVENTS.gold, ...CUP_EVENTS.author]) {
      progress = applyCupFinish(progress, ev, 28_000, "author");
    }
    assert.equal(progress.authorComplete, true);
    assert.equal(continueEvent(progress), null);
  });
});

describe("commitCupRun", () => {
  it("persists a clear and points results at the next challenge", () => {
    const io = memoryIo();
    const { result, progress } = commitCupRun(CUP_EVENTS.gold[0]!, 54_000, "gold", io);
    assert.equal(result.cleared, true);
    assert.equal(result.firstClear, true);
    assert.equal(result.nextEventId, "gold-canyon");
    assert.equal(result.nextTrackId, "canyon");
    assert.equal(result.eventIndex, 0);
    assert.equal(result.eventTotal, 5);
    assert.equal(progress.unlocked.gold, 1);
    assert.ok(io.getItem(CUP_KEY)?.includes("gold-circuit"));

    const miss = commitCupRun(CUP_EVENTS.gold[1]!, 60_000, "silver", io, progress);
    assert.equal(miss.result.cleared, false);
    assert.equal(miss.result.firstClear, false);
    assert.equal(miss.result.nextEventId, null);
    assert.equal(cupHeadline(miss.result, "silver"), "Silver — missed");
  });

  it("announces a finished Gold Cup and feeds Author as the next challenge", () => {
    const io = memoryIo();
    let progress = emptyCup();
    for (const ev of CUP_EVENTS.gold.slice(0, 4)) {
      progress = commitCupRun(ev, 40_000, "gold", io, progress).progress;
    }
    const last = commitCupRun(CUP_EVENTS.gold[4]!, 40_000, "gold", io, progress);
    assert.equal(last.result.cupComplete, true);
    assert.equal(last.result.nextEventId, "author-circuit");
    assert.equal(cupHeadline(last.result, "gold"), "Gold Cup cleared");
  });
});

describe("getCupEvent", () => {
  it("resolves campaign ids", () => {
    assert.equal(getCupEvent("gold-helix")?.trackId, "helix");
    assert.equal(getCupEvent("author-yard")?.target, "author");
    assert.equal(getCupEvent("nope"), null);
  });
});
