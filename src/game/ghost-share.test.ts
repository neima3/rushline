import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickRaceGhost } from "./ghost.ts";
import {
  SHARE_KEY,
  clearImportedGhost,
  commitImportedGhost,
  decodeGhostFile,
  encodeGhostFile,
  ghostDecodeMessage,
  ghostFilename,
  ghostHudTag,
  importGhostFromText,
  isTrackId,
  packTape,
  parseGhostText,
  parseShare,
  pickExportGhost,
} from "./ghost-share.ts";
import { LAST_KEY, SAVE_KEY, commitRun, memoryIo, parseSave } from "./persist.ts";
import { PLAYABLE_ORDER, TRACK_ORDER, type GhostFrame } from "./types.ts";

function rec(n = 40, step = 40): GhostFrame[] {
  return Array.from({ length: n }, (_, i) => ({
    t: i * step,
    s: i * 2,
    n: Math.sin(i * 0.15) * 0.3,
    heading: i * 0.03,
  }));
}

describe("ghost file encode/decode", () => {
  it("round-trips a compact tape and keeps the track + time", () => {
    const frames = rec(36);
    const file = encodeGhostFile({ trackId: "helix", time: 28_400, source: "pb", frames });
    assert.equal(file.kind, "rushline-ghost");
    assert.equal(file.version, 1);
    assert.equal(file.trackId, "helix");
    assert.equal(file.time, 28_400);
    assert.ok(file.tape.length >= 2);
    const decoded = decodeGhostFile(file);
    assert.equal(decoded.ok, true);
    if (!decoded.ok) return;
    assert.equal(decoded.file.trackId, "helix");
    assert.equal(decoded.frames.length, file.tape.length);
    assert.equal(decoded.frames[0]!.t, frames[0]!.t);
  });

  it("accepts object frames, packed columns, and track alias", () => {
    const objects = decodeGhostFile({
      kind: "rushline-ghost",
      version: 1,
      track: "yard",
      time: 33_000,
      frames: [
        { t: 0, s: 1, n: 0, heading: 0 },
        { t: 400, s: 8, n: 0.1, heading: 0.2 },
      ],
    });
    assert.equal(objects.ok, true);

    const packed = decodeGhostFile({
      kind: "rushline-ghost",
      version: 1,
      trackId: "summit",
      time: 31_000,
      t: [0, 200, 400],
      s: [2, 6, 11],
      n: [0, 0.1, -0.1],
      h: [0, 0.1, 0.2],
    });
    assert.equal(packed.ok, true);
    if (packed.ok) assert.equal(packed.file.trackId, "summit");
  });

  it("rejects junk, wrong kind, and unknown tracks", () => {
    assert.equal(parseGhostText("{").ok, false);
    assert.equal(decodeGhostFile({ kind: "replay" }).ok, false);
    assert.equal(decodeGhostFile({ kind: "rushline-ghost", version: 9, trackId: "circuit", time: 1 }).ok, false);
    assert.equal(decodeGhostFile({ kind: "rushline-ghost", version: 1, trackId: "moon", time: 4000, tape: packTape(rec(8)) }).ok, false);
    assert.equal(decodeGhostFile({ kind: "rushline-ghost", version: 1, trackId: "circuit", time: 0, tape: packTape(rec(8)) }).ok, false);
    assert.equal(decodeGhostFile({ kind: "rushline-ghost", version: 1, trackId: "circuit", time: 4000, tape: [] }).ok, false);
    assert.match(ghostDecodeMessage("kind"), /not a Rushline ghost/);
    assert.match(ghostDecodeMessage("track"), /unknown circuit/);
  });

  it("names the download after track, source, and time", () => {
    assert.equal(ghostFilename({ trackId: "circuit", source: "pb", time: 52_140.4 }), "rushline-circuit-pb-52140.json");
    assert.equal(ghostFilename({ trackId: "canyon", source: "last", time: 40_000 }), "rushline-canyon-last-40000.json");
    assert.equal(ghostHudTag("import"), "RIVAL");
    assert.equal(ghostHudTag("author"), "AUTH");
    assert.equal(ghostHudTag("pb"), "GHOST");
    assert.equal(ghostHudTag("hotseat"), "P1");
  });

  it("accepts Ember Caldera and Storm Dock keys from the nine-track campaign", () => {
    assert.deepEqual(TRACK_ORDER.slice(-2), ["ember", "storm"]);
    assert.equal(isTrackId("ember"), true);
    assert.equal(isTrackId("storm"), true);
    assert.equal(isTrackId("ember-caldera"), false);
    assert.equal(isTrackId("custom"), true);
    for (const trackId of ["ember", "storm"] as const) {
      const file = encodeGhostFile({ trackId, time: 36_000, source: "last", frames: rec(20) });
      assert.equal(file.trackId, trackId);
      const decoded = decodeGhostFile(file);
      assert.equal(decoded.ok, true);
      if (!decoded.ok) continue;
      assert.equal(decoded.file.trackId, trackId);
      assert.equal(ghostFilename(file), `rushline-${trackId}-last-36000.json`);
    }
  });

  it("encodes and decodes a Custom ribbon ghost", () => {
    assert.deepEqual(PLAYABLE_ORDER.at(-1), "custom");
    const file = encodeGhostFile({ trackId: "custom", time: 44_000, source: "pb", frames: rec(24) });
    assert.equal(file.trackId, "custom");
    const decoded = decodeGhostFile(file);
    assert.equal(decoded.ok, true);
    if (!decoded.ok) return;
    assert.equal(decoded.file.trackId, "custom");
    assert.equal(ghostFilename(file), "rushline-custom-pb-44000.json");
  });
});

describe("imported rival persist", () => {
  it("stores a rival without touching PB, last run, or livery", () => {
    const io = memoryIo({
      [SAVE_KEY]: JSON.stringify({ version: 1, best: { circuit: 50_000 }, ghosts: {}, livery: "carbon" }),
    });
    commitRun("circuit", 50_000, rec(40), io, parseSave(io.getItem(SAVE_KEY)));
    const before = io.getItem(SAVE_KEY);
    const lastBefore = io.getItem(LAST_KEY);
    const saved = commitImportedGhost("circuit", 48_200, rec(50), io);
    assert.ok(saved);
    assert.equal(saved.time, 48_200);
    assert.equal(io.getItem(SAVE_KEY), before);
    assert.equal(io.getItem(LAST_KEY), lastBefore);
    assert.ok(io.getItem(SHARE_KEY));
    const share = parseShare(io.getItem(SHARE_KEY));
    assert.equal(share.imports.circuit?.time, 48_200);
    assert.equal(parseSave(io.getItem(SAVE_KEY)).livery, "carbon");
    assert.equal(parseSave(io.getItem(SAVE_KEY)).best.circuit, 50_000);
  });

  it("imports from JSON text and can be cleared per track", () => {
    const io = memoryIo();
    const file = encodeGhostFile({ trackId: "canyon", time: 41_500, source: "pb", frames: rec(30) });
    const result = importGhostFromText(JSON.stringify(file), io);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.file.trackId, "canyon");
    assert.equal(pickExportGhost("canyon", "import", io)?.time, 41_500);
    assert.equal(pickExportGhost("circuit", "import", io), null);
    assert.equal(clearImportedGhost("canyon", io), true);
    assert.equal(pickExportGhost("canyon", "import", io), null);
  });

  it("keeps Red Mesa and Black Hollow rivals on separate keys", () => {
    const io = memoryIo();
    assert.ok(commitImportedGhost("mesa", 40_000, rec(22), io));
    assert.ok(commitImportedGhost("hollow", 29_000, rec(18), io));
    assert.equal(pickExportGhost("mesa", "import", io)?.time, 40_000);
    assert.equal(pickExportGhost("hollow", "import", io)?.time, 29_000);
    assert.equal(clearImportedGhost("mesa", io), true);
    assert.equal(pickExportGhost("mesa", "import", io), null);
    assert.equal(pickExportGhost("hollow", "import", io)?.time, 29_000);
  });

  it("exports PB and last from the existing save keys", () => {
    const io = memoryIo();
    commitRun("summit", 32_000, rec(44), io);
    commitRun("summit", 34_000, rec(36, 42), io);
    const pb = pickExportGhost("summit", "pb", io);
    const last = pickExportGhost("summit", "last", io);
    assert.ok(pb);
    assert.ok(last);
    assert.equal(pb.time, 32_000);
    assert.equal(last.time, 34_000);
    assert.equal(pb.source, "pb");
    assert.equal(last.source, "last");
  });
});

describe("pickRaceGhost + imported rival", () => {
  it("uses the imported tape when preferred or on auto", () => {
    const pb = rec(40);
    const last = rec(36, 40);
    const rival = rec(48, 35);
    assert.equal(pickRaceGhost(pb, last, "import", rival).source, "import");
    assert.equal(pickRaceGhost(pb, last, "auto", rival).source, "import");
    assert.equal(pickRaceGhost(pb, last, "pb", rival).source, "pb");
    assert.equal(pickRaceGhost(pb, last, "last", rival).source, "last");
    assert.equal(pickRaceGhost(pb, last, "import", null).source, "pb");
    assert.equal(pickRaceGhost(pb, last, "auto").source, "pb");
  });
});
