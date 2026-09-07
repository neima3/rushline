import { useMemo } from "react";
import { getTrack, sampleAt } from "@/game/track";
import type { TrackId } from "@/game/types";

type Props = {
  trackId: TrackId;
  s: number;
  n: number;
  heading: number;
  ghostS: number | null;
  ghostN: number | null;
};

export function Minimap({ trackId, s, n, heading, ghostS, ghostN }: Props) {
  const map = useMemo(() => projectTrack(trackId), [trackId]);
  const car = projectPoint(trackId, s, n, map);
  const ghost = ghostS != null && ghostN != null ? projectPoint(trackId, ghostS, ghostN, map) : null;
  const sm = sampleAt(getTrack(trackId), s);
  const yaw = Math.atan2(-(sm.tx * Math.cos(heading) - sm.rx * Math.sin(heading)), -(sm.tz * Math.cos(heading) - sm.rz * Math.sin(heading)));

  return (
    <div
      className="pointer-events-none h-[5.75rem] w-[5.75rem] overflow-hidden rounded-lg border border-border bg-bg/70 p-1.5 backdrop-blur-sm md:h-32 md:w-32"
      aria-hidden
    >
      <svg viewBox="0 0 100 100" className="size-full">
        <path d={map.d} fill="none" stroke="rgba(244,244,242,0.28)" strokeWidth="2.4" strokeLinejoin="round" />
        {ghost ? <circle cx={ghost.x} cy={ghost.y} r="2.1" fill="rgba(154,167,181,0.85)" /> : null}
        <g transform={`translate(${car.x} ${car.y}) rotate(${(yaw * 180) / Math.PI})`}>
          <polygon points="0,-3.4 2.4,3.2 -2.4,3.2" fill="#f4f4f2" />
        </g>
      </svg>
    </div>
  );
}

type MapBox = { d: string; minX: number; minZ: number; span: number };

function projectTrack(id: TrackId): MapBox {
  const samples = getTrack(id).samples;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  const step = Math.max(1, Math.floor(samples.length / 90));
  const pts: [number, number][] = [];
  for (let i = 0; i < samples.length; i += step) {
    const sm = samples[i]!;
    pts.push([sm.x, sm.z]);
    minX = Math.min(minX, sm.x);
    maxX = Math.max(maxX, sm.x);
    minZ = Math.min(minZ, sm.z);
    maxZ = Math.max(maxZ, sm.z);
  }
  const span = Math.max(maxX - minX, maxZ - minZ, 1);
  const pad = span * 0.12;
  const d = pts
    .map(([x, z], i) => {
      const px = ((x - minX + pad) / (span + pad * 2)) * 100;
      const pz = ((z - minZ + pad) / (span + pad * 2)) * 100;
      return `${i === 0 ? "M" : "L"}${px.toFixed(2)} ${pz.toFixed(2)}`;
    })
    .join(" ");
  return { d, minX, minZ, span };
}

function projectPoint(id: TrackId, s: number, n: number, box: MapBox) {
  const sm = sampleAt(getTrack(id), s);
  const x = sm.x + sm.rx * n;
  const z = sm.z + sm.rz * n;
  const pad = box.span * 0.12;
  return {
    x: ((x - box.minX + pad) / (box.span + pad * 2)) * 100,
    y: ((z - box.minZ + pad) / (box.span + pad * 2)) * 100,
  };
}
