import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ASPHALT_BASE, ROAD_TINT, roadCrown } from "./look.ts";

describe("track look tokens", () => {
  it("keeps Circuit asphalt midtones charcoal under High day lights", () => {
    const [r, g, b] = ASPHALT_BASE.stadium;
    assert.ok(r < 110 && g < 110 && b < 120, `stadium base still washed ${r},${g},${b}`);
    assert.ok(r > 50 && g > 50, "stadium asphalt should not go black");
    assert.ok(ROAD_TINT.stadium.r < 0.75 && ROAD_TINT.stadium.r > 0.5);
    const crown = roadCrown("stadium");
    assert.ok(crown.mid < 0.86 && crown.edge > crown.mid + 0.25);
  });

  it("keeps Ridge darker than Circuit and Helix cooler than both", () => {
    assert.ok(ASPHALT_BASE.canyon[0] < ASPHALT_BASE.stadium[0]);
    assert.ok(ASPHALT_BASE.night[2] > ASPHALT_BASE.night[0]);
    assert.ok(ROAD_TINT.canyon.r < ROAD_TINT.stadium.r);
    assert.ok(ROAD_TINT.night.b > ROAD_TINT.night.r);
  });
});
