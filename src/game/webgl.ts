/** WebGL / drawing-buffer guards. Scene uses these; look presets stay unchanged. */

/** ~2× a 1512×982 retina laptop, or ~2.9× 1080p. Larger frames trigger Chrome Aw Snap. */
export const MAX_DRAW_PIXELS = 6_000_000;

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

/** MSAA + high DPR doubles GPU memory. Skip AA on phones and retina. */
export function preferMsaa(devicePixelRatio: number, coarsePointer: boolean): boolean {
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
