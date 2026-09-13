import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clamp01,
  engineMix,
  landGain,
  masterLin,
  medalNotes,
  musicDuck,
  muteFromSearch,
  scrapeMix,
} from "./audio.ts";

describe("muteFromSearch", () => {
  it("honors mute=1 and aliases", () => {
    assert.equal(muteFromSearch("?mute=1"), true);
    assert.equal(muteFromSearch("mute=true"), true);
    assert.equal(muteFromSearch("?foo=1&muted=yes"), true);
    assert.equal(muteFromSearch("?mute=on"), true);
    assert.equal(muteFromSearch("?mute=0"), false);
    assert.equal(muteFromSearch(""), false);
    assert.equal(muteFromSearch("?track=circuit"), false);
  });
});

describe("masterLin", () => {
  it("zeros when muted and scales the slider", () => {
    assert.equal(masterLin(true, 1), 0);
    assert.ok(masterLin(false, 1) > 0.8);
    assert.ok(masterLin(false, 0.5) < masterLin(false, 1));
    assert.equal(masterLin(false, 0), 0);
  });
});

describe("musicDuck", () => {
  it("ducks the bed under race and lifts it in the menu", () => {
    assert.ok(musicDuck("race") < musicDuck("countdown"));
    assert.ok(musicDuck("countdown") < musicDuck("paused"));
    assert.ok(musicDuck("paused") < musicDuck("results"));
    assert.ok(musicDuck("results") < musicDuck("menu"));
    assert.equal(musicDuck("menu"), musicDuck("select"));
    assert.ok(musicDuck("race") < 0.2);
  });
});

describe("engineMix", () => {
  const idle = engineMix({ speed: 0, throttle: 0, boost: 0, airborne: false, racing: true });
  const stab = engineMix({ speed: 0, throttle: 1, boost: 0, airborne: false, racing: true });
  const cruise = engineMix({ speed: 28, throttle: 1, boost: 0, airborne: false, racing: true });
  const air = engineMix({ speed: 28, throttle: 1, boost: 0, airborne: true, racing: true });
  const boost = engineMix({ speed: 28, throttle: 1, boost: 1.1, airborne: false, racing: true });
  const parked = engineMix({ speed: 32, throttle: 1, boost: 1, airborne: false, racing: false });

  it("raises RPM and gain with throttle instead of sitting on a drone", () => {
    assert.ok(stab.rpm > idle.rpm + 800);
    assert.ok(stab.gain > idle.gain);
    assert.ok(stab.fundHz > idle.fundHz);
  });

  it("climbs with speed and opens the filter", () => {
    assert.ok(cruise.rpm > stab.rpm);
    assert.ok(cruise.cutoff > idle.cutoff + 400);
    assert.ok(cruise.gain > idle.gain);
  });

  it("unloads in the air and screams more under boost", () => {
    assert.ok(air.rpm > cruise.rpm);
    assert.ok(air.gain < cruise.gain);
    assert.ok(boost.rpm > cruise.rpm);
    assert.ok(boost.whine > cruise.whine);
    assert.ok(boost.cutoff > cruise.cutoff);
    assert.ok(boost.noise > cruise.noise);
  });

  it("stays silent off the race clock", () => {
    assert.equal(parked.gain, 0);
    assert.equal(parked.whine, 0);
    assert.equal(parked.noise, 0);
  });
});

describe("scrapeMix", () => {
  it("scrapes only when sliding on the plastic", () => {
    const grip = scrapeMix({ speed: 22, slide: 0.1, airborne: false, racing: true });
    const drift = scrapeMix({ speed: 22, slide: 0.8, airborne: false, racing: true });
    const air = scrapeMix({ speed: 22, slide: 0.8, airborne: true, racing: true });
    const menu = scrapeMix({ speed: 22, slide: 0.8, airborne: false, racing: false });
    assert.equal(grip.gain, 0);
    assert.ok(drift.gain > 0.02);
    assert.equal(air.gain, 0);
    assert.equal(menu.gain, 0);
    assert.ok(drift.freq > grip.freq);
  });
});

describe("stinger tables", () => {
  it("gives author the longest fanfare", () => {
    assert.ok(medalNotes("author").length > medalNotes("gold").length);
    assert.ok(medalNotes("gold").length > medalNotes("silver").length);
    assert.ok(medalNotes("silver").length > medalNotes("bronze").length);
    assert.deepEqual(medalNotes(null), []);
  });

  it("hits harder on a fast landing", () => {
    assert.ok(landGain(32) > landGain(8));
    assert.ok(landGain(8) > 0);
    assert.ok(landGain(80) <= 0.16);
  });

  it("clamps unit values", () => {
    assert.equal(clamp01(-1), 0);
    assert.equal(clamp01(2), 1);
    assert.equal(clamp01(0.4), 0.4);
  });
});
