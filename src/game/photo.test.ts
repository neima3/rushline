import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canvasToPngBlob,
  clampPhotoOrbit,
  defaultPhotoOrbit,
  ghostScrubSpan,
  ghostScrubTime,
  nudgePhotoOrbit,
  PHOTO_PITCH_MAX,
  PHOTO_ZOOM_MAX,
  PHOTO_ZOOM_MIN,
  photoOrbitPose,
  stillFilename,
} from "./photo.ts";
import type { GhostFrame } from "./types.ts";

describe("photoOrbitPose", () => {
  it("puts yaw=0 behind the car, looking at the target", () => {
    const pose = photoOrbitPose({ x: 10, y: 2, z: 4 }, { x: 0, y: 0, z: -1 }, defaultPhotoOrbit(), 1);
    assert.ok(pose.cam.z > pose.look.z, "camera sits behind a -Z facing car");
    assert.ok(Math.abs(pose.cam.x - 10) < 0.35);
    assert.ok(pose.cam.y > pose.look.y);
    assert.equal(pose.look.x, 10);
    assert.equal(pose.look.z, 4);
  });

  it("positive yaw orbits to the car's left", () => {
    const base = photoOrbitPose({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -1 }, { yaw: 0, pitch: 0.3, zoom: 1 }, 1);
    const left = photoOrbitPose({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -1 }, { yaw: 0.7, pitch: 0.3, zoom: 1 }, 1);
    assert.ok(left.cam.x < base.cam.x, "+yaw should move camera toward -X (car left when facing -Z)");
  });

  it("zoom pulls the camera closer", () => {
    const far = photoOrbitPose({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, { yaw: 0, pitch: 0.4, zoom: 2 }, 1);
    const near = photoOrbitPose({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, { yaw: 0, pitch: 0.4, zoom: 0.6 }, 1);
    const farD = Math.hypot(far.cam.x, far.cam.y - 1, far.cam.z);
    const nearD = Math.hypot(near.cam.x, near.cam.y - 1, near.cam.z);
    assert.ok(nearD < farD);
  });
});

describe("clamp + nudge orbit", () => {
  it("wraps yaw and clamps pitch / zoom", () => {
    const o = clampPhotoOrbit({ yaw: Math.PI * 3, pitch: 9, zoom: 40 });
    assert.ok(o.yaw > -Math.PI - 1e-6 && o.yaw <= Math.PI + 1e-6);
    assert.equal(o.pitch, PHOTO_PITCH_MAX);
    assert.equal(o.zoom, PHOTO_ZOOM_MAX);
    const n = nudgePhotoOrbit(defaultPhotoOrbit(), 0, 0, -8);
    assert.equal(n.zoom, PHOTO_ZOOM_MIN);
  });
});

describe("ghost scrub", () => {
  const tape: GhostFrame[] = [
    { t: 200, s: 0, n: 0, heading: 0 },
    { t: 1200, s: 40, n: 0, heading: 0 },
  ];

  it("needs a real span", () => {
    assert.equal(ghostScrubSpan(null), null);
    assert.equal(ghostScrubSpan([{ t: 1, s: 0, n: 0, heading: 0 }]), null);
    assert.deepEqual(ghostScrubSpan(tape), { start: 200, end: 1200 });
  });

  it("maps 0–1 onto the tape and clamps", () => {
    assert.equal(ghostScrubTime(tape, 0), 200);
    assert.equal(ghostScrubTime(tape, 1), 1200);
    assert.equal(ghostScrubTime(tape, 0.5), 700);
    assert.equal(ghostScrubTime(tape, 4), 1200);
    assert.equal(ghostScrubTime(null, 0.5), null);
  });
});

describe("still export helpers", () => {
  it("names a png without spaces", () => {
    const name = stillFilename("circuit", new Date(2026, 8, 13, 3, 17, 8));
    assert.equal(name, "rushline-circuit-20260913-031708.png");
    assert.match(stillFilename("white pass!"), /^rushline-whitepass-\d{8}-\d{6}\.png$/);
  });

  it("returns null when toBlob is missing", async () => {
    assert.equal(await canvasToPngBlob(null), null);
    assert.equal(await canvasToPngBlob({} as HTMLCanvasElement), null);
  });

  it("keeps a non-empty png blob", async () => {
    const canvas = {
      toBlob(cb: (b: Blob | null) => void) {
        cb(new Blob(["png"], { type: "image/png" }));
      },
    } as unknown as HTMLCanvasElement;
    const blob = await canvasToPngBlob(canvas);
    assert.ok(blob);
    assert.equal(blob.type, "image/png");
    assert.ok(blob.size > 0);
  });
});
