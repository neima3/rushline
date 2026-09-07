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
      ? [176, 178, 182]
      : theme === "canyon"
        ? [36, 32, 30]
        : [28, 30, 42];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const n =
        hash(x * 13 + y * 7) * (theme === "stadium" ? 14 : 16) +
        hash(x * 0.25 + y * 3) * 8 +
        ((x ^ y) & 3) * 2;
      const oil = Math.sin((x + y) * 0.08) * (theme === "stadium" ? 6 : 3);
      const seam = theme === "night" && (x % 64 < 2 || y % 64 < 2) ? 18 : 0;
      const edgeGrime = theme === "stadium" ? Math.max(0, (Math.abs(x - 128) / 128) * 18) : 0;
      d[i] = Math.max(0, Math.min(255, base[0] + n + oil - edgeGrime + seam));
      d[i + 1] = Math.max(0, Math.min(255, base[1] + n * 0.9 - edgeGrime + seam * 0.6));
      d[i + 2] = Math.max(0, Math.min(255, base[2] + n * 0.8 - oil - edgeGrime + seam));
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  ctx.globalAlpha = theme === "stadium" ? 0.18 : 0.14;
  ctx.fillStyle = theme === "night" ? "#6ec8ff" : theme === "canyon" ? "#1a1614" : "#2a2a2c";
  for (let i = 0; i < (theme === "stadium" ? 56 : 36); i++) {
    ctx.fillRect(hash(i + 2) * size, hash(i + 9) * size, 10 + hash(i) * 28, theme === "stadium" ? 1.5 : 1);
  }
  ctx.globalAlpha = 1;
  const t = tex(c, theme === "night" ? 14 : 16);
  t.repeat.set(1, 1);
  return t;
}

export function makeLiveryTexture(night: boolean): THREE.CanvasTexture {
  const size = 128;
  const { c, ctx } = canvas(size);
  ctx.fillStyle = night ? "#6b4ea8" : "#f4f1ea";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = night ? "#3de8ff" : "#ef5a24";
  ctx.save();
  ctx.transform(1, 0, -0.72, 1, 0, 0);
  for (let i = -size; i < size * 2; i += 26) {
    ctx.fillRect(i, -16, 12, size + 32);
  }
  ctx.restore();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = night ? "#12182a" : "#1a1a1e";
  ctx.fillRect(0, size * 0.72, size, size * 0.28);
  ctx.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
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
        ? [156, 82, 42]
        : [26, 22, 38];
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
