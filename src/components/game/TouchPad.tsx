import { useEffect, useRef, useState } from "react";
import { useGame } from "@/game/store";
import { isSpuriousHoldEnd } from "@/game/auto-throttle";
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
  const touch = useGame((s) => s.touch);
  const racing = phase === "race" || phase === "countdown";
  // Never gate on padActive — a phantom gamepad unmounts Accel and zeros throttle.
  const visible = racing;
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
      e.preventDefault();
      e.stopPropagation();
      ids.add(e.pointerId);
      read(e);
    };
    const move = (e: PointerEvent) => {
      if (!ids.has(e.pointerId)) return;
      e.preventDefault();
      read(e);
    };
    const up = (e: PointerEvent) => {
      if (!ids.has(e.pointerId)) return;
      ids.delete(e.pointerId);
      if (ids.size === 0) onSteer(0);
    };
    const opts: AddEventListenerOptions = { passive: false };
    el.addEventListener("pointerdown", down, opts);
    window.addEventListener("pointermove", move, opts);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down, opts);
      window.removeEventListener("pointermove", move, opts);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      onSteer(0);
    };
  }, [onSteer, onThrottle, onBrake, onSlide, visible]);

  if (!visible) return null;

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 pl-[max(0.85rem,env(safe-area-inset-left))] pr-[max(0.85rem,env(safe-area-inset-right))] pb-[max(0.7rem,env(safe-area-inset-bottom))] ${
        touch ? "" : "md:hidden"
      }`}
    >
      <div
        ref={steerRef}
        data-play-control="1"
        className="play-control pointer-events-auto h-32 w-[46%] max-w-60 touch-none rounded-xl border border-border bg-surface/80 select-none"
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
          data-play-control="1"
          className="play-control flex size-12 items-center justify-center rounded-md border border-border bg-surface/90 text-fg"
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRespawn();
          }}
        >
          <RotateCcw className="size-5" strokeWidth={1.75} />
        </button>
        <HoldButton label="Slide" onHold={onSlide} />
        <HoldButton label="Brake" onHold={onBrake} />
        <HoldButton label="Accel" accent onHold={onThrottle} />
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
  const holdRef = useRef(false);
  const pidRef = useRef<number | null>(null);
  const btnRef = useRef<HTMLDivElement>(null);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const el = btnRef.current;
    if (!el) return;

    const release = (id?: number) => {
      if (id != null && pidRef.current != null && id !== pidRef.current) return;
      if (!holdRef.current) return;
      holdRef.current = false;
      pidRef.current = null;
      setHeld(false);
      onHold(0);
    };

    const down = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      pidRef.current = e.pointerId;
      holdRef.current = true;
      setHeld(true);
      onHold(1);
    };

    const end = (e: PointerEvent) => {
      if (isSpuriousHoldEnd(e.type)) return;
      release(e.pointerId);
    };

    const touchEnd = (e: TouchEvent) => {
      if (isSpuriousHoldEnd(e.type)) return;
      release();
    };

    const opts: AddEventListenerOptions = { passive: false };
    el.addEventListener("pointerdown", down, opts);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    el.addEventListener("touchend", touchEnd);
    el.addEventListener("touchcancel", touchEnd);
    return () => {
      el.removeEventListener("pointerdown", down, opts);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      el.removeEventListener("touchend", touchEnd);
      el.removeEventListener("touchcancel", touchEnd);
      if (holdRef.current) onHold(0);
      holdRef.current = false;
      pidRef.current = null;
    };
  }, [onHold]);

  return (
    <div
      ref={btnRef}
      role="button"
      tabIndex={0}
      data-play-control="1"
      aria-label={label}
      aria-pressed={held}
      className={`play-control h-14 min-h-14 w-24 touch-none select-none rounded-lg border text-sm font-medium ${
        accent
          ? "border-accent bg-accent text-accent-fg"
          : "border-border bg-surface/90 text-fg"
      } ${held ? "brightness-125" : ""}`}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </div>
  );
}
