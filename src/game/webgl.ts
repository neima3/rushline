/** WebGL / drawing-buffer guards. Scene uses these; look presets stay unchanged. */

import type { QualityTier } from "./quality";

/** ~2× a 1512×982 retina laptop, or ~2.9× 1080p. Larger frames trigger Chrome Aw Snap. */
export const MAX_DRAW_PIXELS = 6_000_000;
/** Phones / coarse pointers: tighter than desktop so 3× DPR tablets stay under GPU RAM. */
export const MAX_DRAW_PIXELS_MOBILE = 3_200_000;

export function drawingPixelBudget(coarsePointer: boolean): number {
  return coarsePointer ? MAX_DRAW_PIXELS_MOBILE : MAX_DRAW_PIXELS;
}

export function clampDrawingPixelRatio(
  devicePixelRatio: number,
  cap: number,
  cssWidth: number,
  cssHeight: number,
  maxPixels = MAX_DRAW_PIXELS,
): number {
  const allowed = Math.max(0.75, cap);
  const raw = Math.min(Math.max(devicePixelRatio || 1, 0.75), allowed);
  const area = Math.max(1, cssWidth) * Math.max(1, cssHeight);
  const maxDpr = Math.sqrt(maxPixels / area);
  return Math.round(Math.max(0.75, Math.min(raw, maxDpr)) * 100) / 100;
}

/** MSAA + high DPR doubles GPU memory. Skip AA on phones, retina, and Low/Med. */
export function preferMsaa(
  devicePixelRatio: number,
  coarsePointer: boolean,
  quality: QualityTier | null = null,
): boolean {
  if (quality === "low" || quality === "medium") return false;
  if (coarsePointer) return false;
  return (devicePixelRatio || 1) < 1.75;
}

export function isGlContextLost(gl: WebGLRenderingContext | WebGL2RenderingContext | null | undefined): boolean {
  if (!gl) return true;
  try {
    return typeof gl.isContextLost === "function" ? gl.isContextLost() : false;
  } catch {
    return true;
  }
}

export function bindContextLoss(
  canvas: HTMLCanvasElement,
  hooks: { onLost: () => void; onRestored: () => void },
): () => void {
  const onLost = (e: Event) => {
    e.preventDefault();
    hooks.onLost();
  };
  const onRestored = () => hooks.onRestored();
  canvas.addEventListener("webglcontextlost", onLost, false);
  canvas.addEventListener("webglcontextrestored", onRestored, false);
  return () => {
    canvas.removeEventListener("webglcontextlost", onLost, false);
    canvas.removeEventListener("webglcontextrestored", onRestored, false);
  };
}
