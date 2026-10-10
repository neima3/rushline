/** Pure layout math for alpine ski-lift cables and gondola hang points. */

export type CableLayout = {
  span: number;
  mx: number;
  my: number;
  mz: number;
  dirX: number;
  dirY: number;
  dirZ: number;
};

/** Midpoint, unit direction, and span between two cable anchor points. */
export function horizontalCableLayout(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): CableLayout {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const span = Math.hypot(dx, dy, dz);
  if (span < 1e-6) {
    return { span: 0, mx: ax, my: ay, mz: az, dirX: 1, dirY: 0, dirZ: 0 };
  }
  return {
    span,
    mx: (ax + bx) * 0.5,
    my: (ay + by) * 0.5,
    mz: (az + bz) * 0.5,
    dirX: dx / span,
    dirY: dy / span,
    dirZ: dz / span,
  };
}

/** Point along a straight cable; optional parabolic sag (peak at endpoints, dip at center). */
export function cablePointAt(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  t: number,
  sag = 0,
): { x: number; y: number; z: number } {
  const u = Math.max(0, Math.min(1, t));
  const sagY = sag > 0 ? sag * 4 * u * (1 - u) : 0;
  return {
    x: ax + (bx - ax) * u,
    y: ay + (by - ay) * u - sagY,
    z: az + (bz - az) * u,
  };
}

/** Gondola body center: on the cable at `t`, then dropped by `drop` on Y. */
export function gondolaPosition(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  t: number,
  sag: number,
  drop: number,
): { x: number; y: number; z: number } {
  const p = cablePointAt(ax, ay, az, bx, by, bz, t, sag);
  return { x: p.x, y: p.y - drop, z: p.z };
}
