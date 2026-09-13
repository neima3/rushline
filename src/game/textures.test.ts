import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ASPHALT_BASE, ROAD_TINT, roadCrown, roadSurfaceTint, SURFACE_ARCHETYPE, themeDefaultSurface } from "./look.ts";

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

  it("keeps alpine packed-ice cooler than Circuit without washing midtones", () => {
    const [r, g, b] = ASPHALT_BASE.alpine;
    assert.ok(b > r && g > r, `alpine base should read cool ${r},${g},${b}`);
    assert.ok(r < 110 && b < 140);
    assert.ok(ROAD_TINT.alpine.b > ROAD_TINT.alpine.r);
    assert.ok(ROAD_TINT.alpine.r < ROAD_TINT.stadium.r);
    const crown = roadCrown("alpine");
    assert.ok(crown.edge > crown.mid);
  });

  it("keeps works asphalt darker and warmer than Circuit without matching Helix", () => {
    const [r, g, b] = ASPHALT_BASE.works;
    assert.ok(r < ASPHALT_BASE.stadium[0] && r > ASPHALT_BASE.night[0]);
    assert.ok(r >= g && g >= b, `works base should read warm ${r},${g},${b}`);
    assert.ok(ROAD_TINT.works.r < ROAD_TINT.stadium.r);
    assert.ok(ROAD_TINT.works.r < ROAD_TINT.night.b);
    const crown = roadCrown("works");
    assert.ok(crown.edge > crown.mid);
  });

  it("keeps Circuit plastic on the stadium tint and pulls mixed surfaces toward their archetype", () => {
    assert.equal(themeDefaultSurface("stadium"), "plastic");
    assert.equal(themeDefaultSurface("canyon"), "dirt");
    assert.equal(themeDefaultSurface("alpine"), "ice");
    assert.equal(themeDefaultSurface("works"), "tech");
    assert.equal(themeDefaultSurface("mesa"), "dirt");
    assert.equal(themeDefaultSurface("grove"), "dirt");
    assert.equal(themeDefaultSurface("ember"), "dirt");
    assert.equal(themeDefaultSurface("storm"), "plastic");
    const plastic = roadSurfaceTint("stadium", "plastic");
    assert.equal(plastic.r, ROAD_TINT.stadium.r);
    assert.equal(plastic.g, ROAD_TINT.stadium.g);
    const dirtOnCanyon = roadSurfaceTint("canyon", "dirt");
    assert.equal(dirtOnCanyon.r, ROAD_TINT.canyon.r);
    const dirtOnMesa = roadSurfaceTint("mesa", "dirt");
    assert.equal(dirtOnMesa.r, ROAD_TINT.mesa.r);
    const icePatch = roadSurfaceTint("stadium", "ice");
    assert.ok(icePatch.b > plastic.b, "ice on Circuit should read cooler");
    assert.ok(SURFACE_ARCHETYPE.dirt.r > SURFACE_ARCHETYPE.dirt.b);
    assert.ok(SURFACE_ARCHETYPE.ice.b > SURFACE_ARCHETYPE.ice.r);
  });

  it("keeps mesa heat warmer than Circuit without matching Ridge dusk", () => {
    const [r, g, b] = ASPHALT_BASE.mesa;
    assert.ok(r > g && g > b, `mesa base should read warm ${r},${g},${b}`);
    assert.ok(ASPHALT_BASE.mesa[0] > ASPHALT_BASE.canyon[0]);
    assert.ok(ROAD_TINT.mesa.r > ROAD_TINT.canyon.r);
    assert.ok(ROAD_TINT.mesa.r < ROAD_TINT.stadium.r);
    const crown = roadCrown("mesa");
    assert.ok(crown.edge > crown.mid);
  });

  it("keeps grove asphalt darker and greener than Helix without rewriting night tokens", () => {
    const [r, g, b] = ASPHALT_BASE.grove;
    assert.ok(g > r && g >= b, `grove base should read green ${r},${g},${b}`);
    assert.ok(ASPHALT_BASE.grove[2] < ASPHALT_BASE.night[2]);
    assert.ok(ROAD_TINT.grove.g > ROAD_TINT.grove.r);
    assert.ok(ROAD_TINT.night.b > ROAD_TINT.night.r);
    const crown = roadCrown("grove");
    assert.ok(crown.edge > crown.mid);
  });

  it("keeps ember lava warmer than Mesa without matching Ridge dusk", () => {
    const [r, g, b] = ASPHALT_BASE.ember;
    assert.ok(r > g && g > b, `ember base should read lava ${r},${g},${b}`);
    assert.ok(ASPHALT_BASE.ember[0] > ASPHALT_BASE.canyon[0]);
    assert.ok(ROAD_TINT.ember.r > ROAD_TINT.canyon.r);
    assert.ok(ROAD_TINT.ember.r < ROAD_TINT.stadium.r);
    const crown = roadCrown("ember");
    assert.ok(crown.edge > crown.mid);
  });

  it("keeps storm asphalt cooler and wetter than Circuit without rewriting Helix", () => {
    const [r, g, b] = ASPHALT_BASE.storm;
    assert.ok(b > r && b >= g, `storm base should read wet ${r},${g},${b}`);
    assert.ok(ASPHALT_BASE.storm[2] < ASPHALT_BASE.night[2] + 20);
    assert.ok(ROAD_TINT.storm.b > ROAD_TINT.storm.r);
    assert.ok(ROAD_TINT.night.b > ROAD_TINT.night.r);
    const crown = roadCrown("storm");
    assert.ok(crown.edge > crown.mid);
  });
});
