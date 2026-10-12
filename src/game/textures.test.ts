import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ASPHALT_BASE,
  bannerDarkLook,
  gatePlateColor,
  contrastBarrierDarkLook,
  presentMaps,
  curbBlockHigh,
  curbColor,
  curbDims,
  curbPeriod,
  curbSidePainted,
  edgeMark,
  lipColor,
  ROAD_TINT,
  roadCrown,
  roadSurfaceTint,
  SURFACE_ARCHETYPE,
  surfaceAlbedoBase,
  surfaceRoughnessMid,
  surfaceSpec,
  terrainGroundFill,
  themeDefaultSurface,
} from "./look.ts";

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

  it("gives dirt / ice / tech their own specular so mixed ribbons do not share one asphalt slab", () => {
    const stadiumPlastic = surfaceSpec("stadium", "plastic");
    assert.equal(stadiumPlastic.roughness, 0.52);
    assert.equal(stadiumPlastic.metalness, 0.08);
    assert.equal(stadiumPlastic.emissiveIntensity, 0);
    const canyonDirt = surfaceSpec("canyon", "dirt");
    const canyonPlastic = surfaceSpec("canyon", "plastic");
    assert.ok(canyonDirt.roughness > canyonPlastic.roughness + 0.2, "dirt should read matte vs paved start");
    assert.ok(canyonDirt.metalness < canyonPlastic.metalness);
    const alpineIce = surfaceSpec("alpine", "ice");
    assert.ok(alpineIce.roughness < stadiumPlastic.roughness);
    assert.ok(alpineIce.metalness > stadiumPlastic.metalness + 0.15);
    const helixTech = surfaceSpec("night", "tech");
    assert.ok(helixTech.metalness > stadiumPlastic.metalness);
    assert.ok(helixTech.roughness < canyonDirt.roughness);
    assert.ok(surfaceRoughnessMid("canyon", "dirt") > surfaceRoughnessMid("stadium", "plastic"));
    assert.ok(surfaceRoughnessMid("alpine", "ice") < surfaceRoughnessMid("stadium", "plastic"));
    const mesaPlastic = surfaceAlbedoBase("plastic", "mesa");
    const mesaDirt = surfaceAlbedoBase("dirt", "mesa");
    assert.deepEqual(mesaPlastic, ASPHALT_BASE.stadium);
    assert.deepEqual(mesaDirt, ASPHALT_BASE.mesa);
    assert.ok(mesaDirt[0] > mesaDirt[2], "mesa dirt stays warm");
    assert.ok(mesaPlastic[2] >= mesaPlastic[0], "plastic table is cool charcoal, not mesa clay");
    const stormIce = surfaceAlbedoBase("ice", "storm");
    assert.ok(stormIce[2] > stormIce[0], "storm plaza ice should read cooler than wet streets");
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

  it("builds TM sausage curbs with a high block taller than the connector", () => {
    const high = curbDims("stadium", true);
    const low = curbDims("stadium", false);
    assert.ok(high.height > low.height * 2, "sausage high should read as a block");
    assert.ok(high.width > low.width);
    assert.ok(curbBlockHigh("stadium", 0.2) !== curbBlockHigh("stadium", curbPeriod("stadium") + 0.2));
    const red = curbColor("stadium", 1, true);
    const white = curbColor("stadium", 1, false);
    assert.ok(red.r > 0.9 && red.g < 0.2);
    assert.ok(white.r > 0.95 && white.g > 0.95);
    assert.ok(ASPHALT_BASE.stadium[0] < 110);
    assert.ok(edgeMark("stadium").width > 0.12);
    assert.ok(lipColor("stadium").r < 0.1);
  });

  it("keeps Helix neon curbs side-painted without changing night asphalt", () => {
    assert.equal(curbSidePainted("night"), true);
    assert.equal(curbSidePainted("stadium"), false);
    const left = curbColor("night", -1, true);
    const right = curbColor("night", 1, true);
    assert.ok(left.b > left.r);
    assert.ok(right.r > right.b);
    assert.ok(ASPHALT_BASE.night[2] > ASPHALT_BASE.night[0]);
  });

  it("lifts backlit canyon terrain and dirt so off-track fill is not unlit black", () => {
    const ground = terrainGroundFill("canyon");
    assert.ok(ground.emissiveIntensity >= 0.28);
    const dirt = surfaceSpec("canyon", "dirt");
    assert.ok(dirt.emissiveIntensity >= 0.09);
    assert.equal(terrainGroundFill("stadium").emissiveIntensity, 0.08);
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

describe("low-quality texture maps", () => {
  it("omits absent maps so three never sees roughnessMap: undefined", () => {
    const tex = { id: 1 };
    assert.deepEqual(presentMaps({ roughnessMap: null }), {});
    assert.deepEqual(presentMaps({ roughnessMap: undefined }), {});
    assert.equal("roughnessMap" in presentMaps({ roughnessMap: null }), false);
    assert.deepEqual(presentMaps({ roughnessMap: tex, normalMap: null }), { roughnessMap: tex });
  });

  it("road material built with Low's null roughness map logs no three warning", async () => {
    const THREE = await import("three");
    const warn = console.warn;
    const seen: unknown[][] = [];
    console.warn = (...args: unknown[]) => void seen.push(args);
    try {
      const rough: InstanceType<typeof THREE.Texture> | null = null;
      const mat = new THREE.MeshStandardMaterial({
        roughness: 0.5,
        ...presentMaps({ roughnessMap: rough }),
      });
      assert.equal(mat.roughnessMap, null);
      mat.dispose();
    } finally {
      console.warn = warn;
    }
    assert.equal(seen.filter((a) => String(a[0]).includes("roughnessMap")).length, 0);
  });
});

describe("contrast barrier dark panel", () => {
  const lum = (hex: number) =>
    (0.2126 * ((hex >> 16) & 255) + 0.7152 * ((hex >> 8) & 255) + 0.0722 * (hex & 255)) / 255;

  it("White Pass panel is matte, double-sided and lifted off black", () => {
    const look = contrastBarrierDarkLook("alpine");
    assert.equal(look.doubleSided, true);
    assert.ok(look.metalness <= 0.1, `metalness ${look.metalness}`);
    assert.ok(look.roughness >= 0.7, `roughness ${look.roughness}`);
    assert.equal(look.emissive, look.color);
    assert.ok(look.emissiveIntensity >= 0.25);
    assert.ok(lum(look.color) > 0.25, `albedo luminance ${lum(look.color)}`);
  });

  it("other themes keep the original charcoal panel", () => {
    for (const theme of [
      "stadium",
      "canyon",
      "night",
      "works",
      "mesa",
      "grove",
      "ember",
      "storm",
    ] as const) {
      const look = contrastBarrierDarkLook(theme);
      assert.equal(look.color, 0x14161c);
      assert.equal(look.metalness, 0.2);
      assert.equal(look.emissiveIntensity, 0.14);
    }
  });
});

describe("near-black art surfaces (Green CP1 banner, White Pass gate plate)", () => {
  const lum = (hex: number) =>
    (0.2126 * ((hex >> 16) & 255) + 0.7152 * ((hex >> 8) & 255) + 0.0722 * (hex & 255)) / 255;
  const others = ["canyon", "night", "works", "mesa", "grove", "ember", "storm"] as const;

  it("Green Circuit dark banner is lifted to self-lit charcoal, still darker than the light board", () => {
    const look = bannerDarkLook("stadium", 0xef5a24);
    assert.ok(lum(look.color) > 0.15, `banner albedo luminance ${lum(look.color)}`);
    assert.ok(lum(look.color) < lum(0xf4f4f2) * 0.4, "two-tone sponsor look must stay");
    assert.equal(look.emissive, look.color);
    assert.ok(look.emissiveIntensity >= 0.25, `emissive ${look.emissiveIntensity}`);
  });

  it("other themes keep the original dark banner", () => {
    for (const theme of [...others, "alpine"] as const) {
      assert.deepEqual(bannerDarkLook(theme, 0xc4a574), {
        color: 0x111318,
        emissive: 0xc4a574,
        emissiveIntensity: 0.18,
      });
    }
  });

  it("White Pass CP plate is lifted off black", () => {
    assert.ok(lum(gatePlateColor("alpine")) > 0.25, `plate luminance ${lum(gatePlateColor("alpine"))}`);
  });

  it("other themes keep their CP plate colour", () => {
    const expected = {
      stadium: 0x111318,
      canyon: 0x111318,
      night: 0x0c1020,
      works: 0x161210,
      mesa: 0x1c140c,
      grove: 0x0c1410,
      ember: 0x111318,
      storm: 0x111318,
    } as const;
    for (const [theme, hex] of Object.entries(expected)) {
      assert.equal(gatePlateColor(theme as keyof typeof expected), hex, theme);
    }
  });
});
