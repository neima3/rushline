import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_LIVERY,
  LIVERIES,
  LIVERY_IDS,
  LIVERY_ORDER,
  isLiveryId,
  liveryDef,
  liveryId,
  nextLivery,
  parseLivery,
} from "./livery.ts";

describe("livery catalog", () => {
  it("ships six distinct paints", () => {
    assert.equal(LIVERY_IDS.length, 6);
    assert.equal(LIVERY_ORDER.length, 6);
    const bases = new Set(LIVERY_ORDER.map((id) => LIVERIES[id].base));
    const stripes = new Set(LIVERY_ORDER.map((id) => LIVERIES[id].stripe));
    const patterns = new Set(LIVERY_ORDER.map((id) => LIVERIES[id].pattern));
    assert.equal(bases.size, 6);
    assert.equal(stripes.size, 6);
    assert.equal(patterns.size, 6);
  });

  it("keeps Ivory as the factory default", () => {
    assert.equal(DEFAULT_LIVERY, "ivory");
    assert.equal(liveryDef("ivory").pattern, "chevron");
    assert.equal(liveryDef("ivory").base, "#f4f1ea");
    assert.equal(liveryDef("ivory").stripe, "#ef5a24");
  });
});

describe("parseLivery", () => {
  it("accepts catalog ids and rejects garbage", () => {
    assert.equal(parseLivery("violet"), "violet");
    assert.equal(parseLivery("hazard"), "hazard");
    assert.equal(parseLivery("nope"), undefined);
    assert.equal(parseLivery(null), undefined);
    assert.equal(liveryId("sun"), "sun");
    assert.equal(liveryId("turbo"), DEFAULT_LIVERY);
    assert.equal(isLiveryId("frost"), true);
    assert.equal(isLiveryId("circuit"), false);
  });

  it("cycles the garage order", () => {
    assert.equal(nextLivery("ivory", 1), "violet");
    assert.equal(nextLivery("hazard", 1), "ivory");
    assert.equal(nextLivery("ivory", -1), "hazard");
  });
});
