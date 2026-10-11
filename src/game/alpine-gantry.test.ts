import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cablePointAt,
  gondolaCableTs,
  gondolaPosition,
  horizontalCableLayout,
} from "./alpine-gantry.ts";

describe("alpine gantry cable layout", () => {
  it("spans horizontally between mast tops with unit direction along the chord", () => {
    const layout = horizontalCableLayout(0, 20, 0, 14, 20, 0);
    assert.equal(layout.span, 14);
    assert.equal(layout.my, 20);
    assert.ok(Math.abs(layout.dirY) < 1e-9);
    assert.ok(Math.abs(layout.dirX - 1) < 1e-9);
    assert.equal(layout.mx, 7);
    assert.equal(layout.mz, 0);
  });

  it("keeps gondola sample params off mast endpoints", () => {
    assert.deepEqual(gondolaCableTs(1), [0.5]);
    const two = gondolaCableTs(2);
    assert.ok(two.every((t) => t >= 0.28 && t <= 0.72));
  });

  it("sags cable points at the center and hangs gondolas below the chord", () => {
    const sag = 0.4;
    const mid = cablePointAt(0, 10, 0, 10, 10, 0, 0.5, sag);
    assert.ok(mid.y < 10 - 0.05, "mid-span cable should dip with sag");
    const end = cablePointAt(0, 10, 0, 10, 10, 0, 0, sag);
    assert.equal(end.y, 10);

    const g = gondolaPosition(0, 10, 0, 10, 10, 0, 0.5, sag, 1.2);
    assert.ok(g.y < mid.y, "gondola hangs below the cable point");
    assert.equal(g.x, 5);
    assert.equal(g.z, 0);
  });
});
