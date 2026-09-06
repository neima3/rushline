import * as THREE from "three";
import type { ThemeId } from "./types";

function canvas(size: number) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  return { c, ctx };
}

function hash(i: number) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function tex(c: HTMLCanvasElement, repeat = 18) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

export function makeAsphaltTexture(theme: ThemeId): THREE.CanvasTexture {
  const size = 256;
  const { c, ctx } = canvas(size);
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const base =
    theme === "stadium"
      ? [38, 42, 48]
      : theme === "canyon"
        ? [46, 40, 38]
        : [22, 26, 36];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const n =
        hash(x * 13 + y * 7) * 18 +
        hash(x * 0.25 + y * 3) * 10 +
        ((x ^ y) & 3) * 2;
      const oil = Math.sin((x + y) * 0.08) * 4;
      d[i] = Math.max(0, Math.min(255, base[0] + n + oil));
      d[i + 1] = Math.max(0, Math.min(255, base[1] + n * 0.9));
      d[i + 2] = Math.max(0, Math.min(255, base[2] + n * 0.8 - oil));
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = theme === "night" ? "#6aa0ff" : "#ffffff";
  for (let i = 0; i < 40; i++) {
    ctx.fillRect(hash(i + 2) * size, hash(i + 9) * size, 8 + hash(i) * 18, 1);
  }
  ctx.globalAlpha = 1;
  const t = tex(c, theme === "night" ? 14 : 16);
  t.repeat.set(1, 1);
  return t;
}

export function makeGroundTexture(theme: ThemeId): THREE.CanvasTexture {
  const size = 256;
  const { c, ctx } = canvas(size);
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const base =
    theme === "stadium"
      ? [92, 138, 72]
      : theme === "canyon"
        ? [138, 88, 52]
        : [14, 16, 22];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const n = hash(x * 3 + y * 11) * 28 + hash((x >> 3) + (y >> 2) * 17) * 16;
      d[i] = Math.max(0, Math.min(255, base[0] + n - 10));
      d[i + 1] = Math.max(0, Math.min(255, base[1] + n * 0.7));
      d[i + 2] = Math.max(0, Math.min(255, base[2] + n * 0.35));
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return tex(c, 48);
}

export function makeMetalTexture(): THREE.CanvasTexture {
  const size = 128;
  const { c, ctx } = canvas(size);
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, "#c8ccd4");
  g.addColorStop(0.5, "#8a909a");
  g.addColorStop(1, "#d4d8de");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 0.15;
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = hash(i) > 0.5 ? "#fff" : "#000";
    ctx.fillRect(hash(i + 1) * size, hash(i + 4) * size, 2, 12);
  }
  ctx.globalAlpha = 1;
  const t = tex(c, 2);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeCheckerTexture(): THREE.CanvasTexture {
  const size = 128;
  const { c, ctx } = canvas(size);
  const n = 8;
  const cell = size / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#f4f4f2" : "#111113";
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}
