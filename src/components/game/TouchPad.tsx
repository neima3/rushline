import { useEffect, useRef } from "react";
import { useGame } from "@/game/store";
import { RotateCcw } from "lucide-react";

type Props = {
  onSteer: (v: number) => void;
  onThrottle: (v: number) => void;
  onBrake: (v: number) => void;
  onSlide: (v: 0 | 1) => void;
  onRespawn: () => void;
};

export function TouchPad({ onSteer, onThrottle, onBrake, onSlide, onRespawn }: Props) {
  const phase = useGame((s) => s.phase);
  const auto = useGame((s) => s.autoThrottle);
  const padActive = useGame((s) => s.pad.active);
  const visible = (phase === "race" || phase === "countdown") && !padActive;
  const steerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) {
      onSteer(0);
      onThrottle(0);
      onBrake(0);
      onSlide(0);
      return;
    }
    const el = steerRef.current;
    if (!el) return;
    const ids = new Set<number>();
    const read = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const steer = -(x - 0.5) * 2;
      onSteer(Math.max(-1, Math.min(1, steer)));
    };
    const down = (e: PointerEvent) => {
      ids.add(e.pointerId);
      el.setPointerCapture(e.pointerId);
      read(e);
    };
    const move = (e: PointerEvent) => {
      if (!ids.has(e.pointerId)) return;
      read(e);
    };
    const up = (e: PointerEvent) => {
      ids.delete(e.pointerId);
      if (ids.size === 0) onSteer(0);
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      onSteer(0);
    };
  }, [onSteer, onThrottle, onBrake, onSlide, visible]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden">
      <div
        ref={steerRef}
        className="pointer-events-auto h-28 w-[46%] max-w-56 rounded-xl border border-border bg-surface/80"
        aria-label="Steer"
      >
        <div className="flex h-full items-center justify-between px-5 text-sm font-medium text-muted">
          <span>L</span>
          <span className="text-xs uppercase tracking-widest">Steer</span>
          <span>R</span>
        </div>
      </div>
      <div className="pointer-events-auto flex flex-col items-end gap-2">
        <button
          type="button"
          aria-label="Respawn"
          onPointerDown={onRespawn}
          className="flex size-12 items-center justify-center rounded-md border border-border bg-surface/90 text-fg"
        >
          <RotateCcw className="size-5" strokeWidth={1.75} />
        </button>
        <HoldButton label="Slide" onHold={onSlide} />
        <HoldButton label="Brake" onHold={onBrake} />
        {!auto ? <HoldButton label="Accel" accent onHold={onThrottle} /> : null}
      </div>
    </div>
  );
}

function HoldButton({
  label,
  onHold,
  accent,
}: {
  label: string;
  onHold: (v: 0 | 1) => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      className={`h-14 min-h-14 w-24 rounded-lg border text-sm font-medium ${
        accent
          ? "border-accent bg-accent text-accent-fg"
          : "border-border bg-surface/90 text-fg"
      }`}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onHold(1);
      }}
      onPointerUp={() => onHold(0)}
      onPointerCancel={() => onHold(0)}
    >
      {label}
    </button>
  );
}
