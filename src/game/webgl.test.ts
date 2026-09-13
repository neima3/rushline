import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_DRAW_PIXELS,
  clampDrawingPixelRatio,
  isGlContextLost,
  preferMsaa,
} from "./webgl.ts";

describe("clampDrawingPixelRatio", () => {
  it("honors the quality cap on a phone-sized frame", () => {
    assert.equal(clampDrawingPixelRatio(3, 1.5, 390, 844), 1.5);
    assert.equal(clampDrawingPixelRatio(3, 1, 390, 844), 1);
  });

  it("keeps 1× 1080p and 2× 14-inch retina under the Aw Snap budget", () => {
    assert.equal(clampDrawingPixelRatio(1, 2, 1920, 1080), 1);
    assert.equal(clampDrawingPixelRatio(2, 2, 1512, 982), 2);
    assert.ok(1512 * 982 * 2 * 2 <= MAX_DRAW_PIXELS);
  });

  it("drops DPR on huge CSS frames so the buffer stays bounded", () => {
    const dpr = clampDrawingPixelRatio(2, 2, 3840, 2160);
    assert.ok(dpr < 2);
    assert.ok(dpr >= 0.75);
    assert.ok(3840 * 2160 * dpr * dpr <= MAX_DRAW_PIXELS * 1.01);
  });

  it("never goes below 0.75", () => {
    assert.equal(clampDrawingPixelRatio(0.5, 0.5, 100, 100), 0.75);
  });
});

describe("preferMsaa", () => {
  it("keeps MSAA on 1× desktop and drops it on retina or coarse pointers", () => {
    assert.equal(preferMsaa(1, false), true);
    assert.equal(preferMsaa(2, false), false);
    assert.equal(preferMsaa(1, true), false);
  });
});

describe("isGlContextLost", () => {
  it("treats a missing context as lost", () => {
    assert.equal(isGlContextLost(null), true);
    assert.equal(isGlContextLost(undefined), true);
  });

  it("reads isContextLost when present", () => {
    const lost = { isContextLost: () => true } as unknown as WebGLRenderingContext;
    const ok = { isContextLost: () => false } as unknown as WebGLRenderingContext;
    assert.equal(isGlContextLost(lost), true);
    assert.equal(isGlContextLost(ok), false);
  });
});
