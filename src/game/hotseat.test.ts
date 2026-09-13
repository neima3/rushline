import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  armHotseatSeat,
  buildHotseatBoard,
  commitHotseatRun,
  emptyHotseat,
  hotseatComplete,
  hotseatDelta,
  hotseatGhost,
  hotseatHeadline,
  hotseatResultsView,
  hotseatWinner,
  rematchHotseat,
  type HotseatRun,
} from "./hotseat.ts";
import type { GhostFrame } from "./types.ts";

function frames(t: number): GhostFrame[] {
  return [
    { t: 0, s: 0, n: 0, heading: 0 },
    { t, s: 100, n: 0, heading: 0 },
  ];
}

function run(seat: 1 | 2, time: number, extra: Partial<HotseatRun> = {}): HotseatRun {
  return { seat, time, medal: "gold", validated: true, frames: frames(time), ...extra };
}

describe("hotseat session", () => {
  it("starts on P1 with no ghost", () => {
    const s = emptyHotseat("circuit");
    assert.equal(s.seat, 1);
    assert.equal(s.p1, null);
    assert.equal(hotseatGhost(s), null);
    assert.equal(hotseatComplete(s), false);
  });

  it("hands P1's tape to P2, then builds a scoreboard", () => {
    let s = emptyHotseat("mesa");
    s = commitHotseatRun(s, run(1, 52_000));
    assert.equal(hotseatComplete(s), false);
    s = armHotseatSeat(s, 2);
    const ghost = hotseatGhost(s);
    assert.ok(ghost);
    assert.equal(ghost![ghost!.length - 1]!.t, 52_000);
    s = commitHotseatRun(s, run(2, 50_400, { medal: "author", validated: false }));
    assert.equal(hotseatComplete(s), true);
    const board = buildHotseatBoard(s);
    assert.ok(board);
    assert.equal(board!.winner, 2);
    assert.equal(board!.delta, -1_600);
    assert.equal(hotseatHeadline(board!.winner), "P2 wins");
    const view = hotseatResultsView(s);
    assert.equal(view.complete, true);
    assert.equal(view.p2?.validated, false);
  });

  it("treats equal times as a dead heat", () => {
    assert.equal(hotseatWinner(40_000, 40_000), "tie");
    assert.equal(hotseatHeadline("tie"), "Dead heat");
    assert.equal(hotseatDelta(40_000, 41_200), 1_200);
  });

  it("rematch clears both seats on the same track", () => {
    let s = commitHotseatRun(emptyHotseat("hollow"), run(1, 33_000));
    s = commitHotseatRun(armHotseatSeat(s, 2), run(2, 34_000));
    const next = rematchHotseat(s);
    assert.equal(next.trackId, "hollow");
    assert.equal(next.seat, 1);
    assert.equal(next.p1, null);
    assert.equal(next.p2, null);
  });
});
