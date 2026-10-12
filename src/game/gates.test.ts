import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as THREE from "three";
import { buildGate } from "./gates.ts";
import { GATE_LOOK } from "./presentation.ts";
import type { Sample, ThemeId } from "./types.ts";

const sm = {
  s: 0, x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 1, rx: 1, ry: 0, rz: 0, ux: 0, uy: 1, uz: 0,
  width: 12, bank: 0, surface: "plastic",
} as unknown as Sample;

function cpPlate(theme: ThemeId) {
  const gate = buildGate(sm, theme, false);
  const plates: THREE.Mesh[] = [];
  gate.group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !(m.geometry instanceof THREE.PlaneGeometry)) return;
    const p = m.geometry.parameters;
    if (Math.abs(p.width - 1.45) < 1e-6 && Math.abs(p.height - 0.42) < 1e-6) plates.push(m);
  });
  assert.equal(plates.length, 1, `${theme}: one CP plate`);
  return { gate, mat: plates[0].material as THREE.MeshBasicMaterial };
}

describe("CP gate plate", () => {
  it("White Pass plate is double-sided and not near-black", () => {
    const { mat } = cpPlate("alpine");
    assert.equal(mat.side, THREE.DoubleSide);
    const c = mat.color;
    const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    assert.ok(lum > 0.04, `alpine plate linear luminance ${lum}`);
    assert.equal(mat.color.getHex(), 0x4a5868);
  });

  it("every theme's plate is double-sided with its pinned colour", () => {
    const expected: Record<ThemeId, number> = {
      stadium: 0x111318,
      canyon: 0x111318,
      night: 0x0c1020,
      alpine: 0x4a5868,
      works: 0x161210,
      mesa: 0x5a4632,
      grove: 0x0c1410,
      ember: 0x111318,
      storm: 0x3e4a56,
    };
    for (const [theme, hex] of Object.entries(expected) as [ThemeId, number][]) {
      const { mat } = cpPlate(theme);
      assert.equal(mat.side, THREE.DoubleSide, theme);
      assert.equal(mat.color.getHex(), hex, theme);
    }
  });

  it("Red Mesa and Storm Dock plates are double-sided and not near-black", () => {
    for (const theme of ["mesa", "storm"] as const) {
      const { mat } = cpPlate(theme);
      assert.equal(mat.side, THREE.DoubleSide, theme);
      const c = mat.color;
      const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
      assert.ok(lum > 0.04, `${theme} plate linear luminance ${lum}`);
    }
  });

  it("alpine CP arch keeps the day gate look emissive (flash source)", () => {
    const { gate } = cpPlate("alpine");
    const std = gate.mats.find((m) => (m as THREE.MeshStandardMaterial).isMeshStandardMaterial && (m as THREE.MeshStandardMaterial).emissiveIntensity > 0.5) as THREE.MeshStandardMaterial;
    assert.ok(std, "arch material present");
    assert.equal(std.color.getHex(), GATE_LOOK.cpDay);
    assert.equal(std.emissive.getHex(), GATE_LOOK.cpEmissiveDay);
    assert.equal(std.emissiveIntensity, 0.85);
  });
});
