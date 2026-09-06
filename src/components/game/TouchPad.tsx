import { useEffect, useRef, useState } from "react";
import { useGame } from "@/game/store";
import { reduceHold } from "@/game/auto-throttle";
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
  const cancelUntilRef = useRef(0);
  const fingersRef = useRef(new Set<number>());
  const btnRef = useRef<HTMLDivElement>(null);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const el = btnRef.current;
    if (!el) return;

    const press = () => {
      holdRef.current = true;
      setHeld(true);
      onHold(1);
    };

    const release = () => {
      if (!holdRef.current) return;
      holdRef.current = false;
      pidRef.current = null;
      fingersRef.current.clear();
      setHeld(false);
      onHold(0);
    };

    const apply = (
      type: string,
      extra?: { remainingTouches?: number; pointerType?: string; pointerId?: number; buttons?: number },
    ) => {
      const next = reduceHold(
        { held: holdRef.current, cancelUntil: cancelUntilRef.current, downId: pidRef.current },
        {
          type,
          now: performance.now(),
          remainingTouches: extra?.remainingTouches ?? fingersRef.current.size,
          pointerType: extra?.pointerType,
          pointerId: extra?.pointerId,
          buttons: extra?.buttons,
        },
      );
      cancelUntilRef.current = next.cancelUntil;
      if (next.downId != null) pidRef.current = next.downId;
      if (next.held) press();
      else release();
    };

    const down = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      pidRef.current = e.pointerId;
      // Do not setPointerCapture — capture loss is what emits lostpointercapture
      // + ghost pointerup while the finger is still on Brake.
      apply("pointerdown", {
        remainingTouches: Math.max(1, fingersRef.current.size),
        pointerType: e.pointerType,
        pointerId: e.pointerId,
        buttons: e.buttons,
      });
    };

    const end = (e: PointerEvent) => {
      if (pidRef.current != null && e.pointerId !== pidRef.current) return;
      // Keep remainingTouches > 0 on cancel / lost capture / in-grace ups so
      // a solitary ghost pointerup cannot look like a lift.
      const now = performance.now();
      const ghost =
        e.type === "pointercancel" ||
        e.type === "lostpointercapture" ||
        e.pointerType !== "mouse" ||
        now < cancelUntilRef.current ||
        e.buttons > 0;
      apply(e.type, {
        remainingTouches: ghost ? Math.max(1, fingersRef.current.size) : fingersRef.current.size,
        pointerType: e.pointerType,
        pointerId: e.pointerId,
        buttons: e.buttons,
      });
    };

    const noteFingers = (e: TouchEvent, add: boolean) => {
      for (const t of Array.from(e.changedTouches)) {
        if (add) fingersRef.current.add(t.identifier);
        else fingersRef.current.delete(t.identifier);
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      const t = e.target as Node | null;
      if (t && t !== el && !el.contains(t)) return;
      e.preventDefault();
      noteFingers(e, true);
      apply("touchstart");
    };

    const onTouchEnd = (e: TouchEvent) => {
      let ours = false;
      for (const t of Array.from(e.changedTouches)) {
        if (fingersRef.current.has(t.identifier)) ours = true;
      }
      noteFingers(e, false);
      if (!ours) return;
      const now = performance.now();
      const ghost = e.type === "touchcancel" || now < cancelUntilRef.current;
      const remaining = e.touches.length;
      apply(e.type, {
        remainingTouches: ghost ? Math.max(1, remaining) : remaining,
      });
    };

    const opts: AddEventListenerOptions = { passive: false };
    el.addEventListener("pointerdown", down, opts);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    el.addEventListener("lostpointercapture", end);
    el.addEventListener("touchstart", onTouchStart, opts);
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    let raf = 0;
    const tick = () => {
      if (holdRef.current) onHold(1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerdown", down, opts);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      el.removeEventListener("lostpointercapture", end);
      el.removeEventListener("touchstart", onTouchStart, opts);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      if (holdRef.current) onHold(0);
      holdRef.current = false;
      pidRef.current = null;
      fingersRef.current.clear();
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
      data-held={held ? "1" : "0"}
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
