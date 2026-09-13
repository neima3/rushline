import { useEffect, useRef, useState, type RefObject } from "react";
import { useGame } from "@/game/store";
import { hitDrivePad, reduceHold, type HoldLatch } from "@/game/auto-throttle";
import { shapeTouchSteer } from "@/game/feel";
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
  const photoMode = useGame((s) => s.photoMode);
  const racing = phase === "race" || phase === "countdown";
  // Never gate on padActive — a phantom gamepad unmounts Accel and zeros throttle.
  // Photo mode hides the pads so orbit drag and Capture stay clean.
  const visible = racing && !photoMode;
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
      onSteer(shapeTouchSteer(steer));
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
        className="play-control pointer-events-auto h-36 w-[48%] max-w-64 touch-none rounded-xl border border-border bg-surface/80 select-none"
        aria-label="Steer"
      >
        <div className="relative flex h-full items-center justify-between px-5 text-sm font-medium text-muted">
          <span className="pointer-events-none absolute top-2 bottom-2 left-1/2 w-px -translate-x-1/2 bg-fg/20" />
          <span>L</span>
          <span className="text-xs uppercase tracking-widest">Steer</span>
          <span>R</span>
        </div>
      </div>
      <div className="pointer-events-auto flex flex-col items-end gap-2.5">
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
        <DriveCluster onThrottle={onThrottle} onBrake={onBrake} onSlide={onSlide} />
      </div>
    </div>
  );
}

type Finger = { kind: "brake" | "accel" | "slide"; x: number; y: number };

/**
 * One pointer router for Slide / Brake / Accel. Post-#13 FAIL: a finger that
 * started on Accel (or sat on the seam) kept touchThrottle=1 after the chrome
 * sat on Brake, so Auto+Accel climbed 64→110. One reduceHold latch (same as
 * #13) plus per-frame hit-test; Brake is exclusive over Accel.
 */
function DriveCluster({
  onThrottle,
  onBrake,
  onSlide,
}: {
  onThrottle: (v: number) => void;
  onBrake: (v: number) => void;
  onSlide: (v: 0 | 1) => void;
}) {
  const clusterRef = useRef<HTMLDivElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const brakeRef = useRef<HTMLDivElement>(null);
  const accelRef = useRef<HTMLDivElement>(null);
  const fingersRef = useRef(new Set<number>());
  const latchRef = useRef<HoldLatch>({ held: false, cancelUntil: 0, downId: null });
  const spotsRef = useRef(new Map<number, Finger>());
  const [held, setHeld] = useState({ slide: false, brake: false, accel: false });

  useEffect(() => {
    const root = clusterRef.current;
    if (!root) return;

    const padRect = (el: HTMLDivElement | null) => {
      const r = el?.getBoundingClientRect();
      return { left: r?.left ?? 0, top: r?.top ?? 0, right: r?.right ?? 0, bottom: r?.bottom ?? 0 };
    };

    const hit = (x: number, y: number) =>
      hitDrivePad(x, y, {
        brake: padRect(brakeRef.current),
        accel: padRect(accelRef.current),
        slide: padRect(slideRef.current),
      });

    const emit = () => {
      if (!latchRef.current.held) {
        onBrake(0);
        onThrottle(0);
        onSlide(0);
        setHeld({ slide: false, brake: false, accel: false });
        return;
      }
      const kinds = new Set<string>();
      for (const p of spotsRef.current.values()) kinds.add(p.kind);
      const brake = kinds.has("brake");
      const accel = kinds.has("accel") && !brake;
      const slide = kinds.has("slide");
      onBrake(brake ? 1 : 0);
      onThrottle(accel ? 1 : 0);
      onSlide(slide ? 1 : 0);
      setHeld({ slide, brake, accel });
    };

    const applyLatch = (
      type: string,
      extra: {
        id?: number;
        x?: number;
        y?: number;
        pointerType?: string;
        buttons?: number;
        remainingTouches?: number;
      },
    ) => {
      const next = reduceHold(latchRef.current, {
        type,
        now: performance.now(),
        remainingTouches: extra.remainingTouches ?? fingersRef.current.size,
        pointerType: extra.pointerType,
        pointerId: extra.id,
        buttons: extra.buttons,
      });
      latchRef.current = next;
      if (next.downId != null) latchRef.current.downId = next.downId;
      if (!next.held) {
        spotsRef.current.clear();
        emit();
        return;
      }
      if (extra.id != null && extra.x != null && extra.y != null) {
        const kind = hit(extra.x, extra.y) ?? spotsRef.current.get(extra.id)?.kind ?? "brake";
        spotsRef.current.set(extra.id, { kind, x: extra.x, y: extra.y });
      }
      emit();
    };

    const down = (e: PointerEvent) => {
      const kind = hit(e.clientX, e.clientY);
      if (!kind) return;
      e.preventDefault();
      e.stopPropagation();
      applyLatch("pointerdown", {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        pointerType: e.pointerType,
        buttons: e.buttons,
        remainingTouches: Math.max(1, fingersRef.current.size),
      });
    };

    const move = (e: PointerEvent) => {
      if (!latchRef.current.held) return;
      e.preventDefault();
      const prev = spotsRef.current.get(e.pointerId) ?? [...spotsRef.current.values()][0];
      const kind = hit(e.clientX, e.clientY) ?? prev?.kind ?? "brake";
      spotsRef.current.set(e.pointerId, { kind, x: e.clientX, y: e.clientY });
      emit();
    };

    const end = (e: PointerEvent) => {
      if (!latchRef.current.held) return;
      const now = performance.now();
      const ghost =
        e.type === "pointercancel" ||
        e.type === "lostpointercapture" ||
        e.pointerType !== "mouse" ||
        now < latchRef.current.cancelUntil ||
        e.buttons > 0;
      applyLatch(e.type, {
        id: e.pointerId,
        pointerType: e.pointerType,
        buttons: e.buttons,
        remainingTouches: ghost ? Math.max(1, fingersRef.current.size) : fingersRef.current.size,
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
      if (t && t !== root && !root.contains(t)) return;
      e.preventDefault();
      noteFingers(e, true);
      const touch = e.changedTouches[0];
      if (!touch) return;
      applyLatch("touchstart", {
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        remainingTouches: Math.max(1, fingersRef.current.size),
      });
    };

    const onTouchEnd = (e: TouchEvent) => {
      let ours = false;
      for (const t of Array.from(e.changedTouches)) {
        if (fingersRef.current.has(t.identifier) || spotsRef.current.has(t.identifier)) ours = true;
      }
      if (latchRef.current.held && e.target && root.contains(e.target as Node)) ours = true;
      noteFingers(e, false);
      if (!ours && !latchRef.current.held) return;
      const now = performance.now();
      const ghost = e.type === "touchcancel" || now < latchRef.current.cancelUntil;
      applyLatch(e.type, {
        remainingTouches: ghost ? Math.max(1, e.touches.length) : e.touches.length,
      });
    };

    const opts: AddEventListenerOptions = { passive: false };
    root.addEventListener("pointerdown", down, opts);
    window.addEventListener("pointermove", move, opts);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    root.addEventListener("lostpointercapture", end);
    root.addEventListener("touchstart", onTouchStart, opts);
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    let raf = 0;
    const tick = () => {
      if (latchRef.current.held) {
        for (const [id, p] of spotsRef.current) {
          const kind = hit(p.x, p.y) ?? p.kind;
          if (kind !== p.kind) spotsRef.current.set(id, { ...p, kind });
        }
        emit();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      root.removeEventListener("pointerdown", down, opts);
      window.removeEventListener("pointermove", move, opts);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      root.removeEventListener("lostpointercapture", end);
      root.removeEventListener("touchstart", onTouchStart, opts);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      latchRef.current = { held: false, cancelUntil: 0, downId: null };
      spotsRef.current.clear();
      fingersRef.current.clear();
      onBrake(0);
      onThrottle(0);
      onSlide(0);
    };
  }, [onThrottle, onBrake, onSlide]);

  return (
    <div ref={clusterRef} className="flex flex-col items-end gap-3" data-drive-cluster="1">
      <PadFace label="Slide" faceRef={slideRef} pressed={held.slide} size="md" />
      <PadFace label="Brake" faceRef={brakeRef} pressed={held.brake} size="lg" />
      <PadFace label="Accel" faceRef={accelRef} pressed={held.accel} size="lg" accent />
    </div>
  );
}

function PadFace({
  label,
  faceRef,
  pressed,
  accent,
  size = "md",
}: {
  label: string;
  faceRef: RefObject<HTMLDivElement | null>;
  pressed: boolean;
  accent?: boolean;
  size?: "md" | "lg";
}) {
  const box = size === "lg" ? "h-[4.15rem] min-h-[4.15rem] w-[7.6rem]" : "h-16 min-h-16 w-[7.25rem]";
  return (
    <div
      ref={faceRef}
      role="button"
      tabIndex={0}
      data-play-control="1"
      data-control={label.toLowerCase()}
      aria-label={label}
      aria-pressed={pressed}
      data-held={pressed ? "1" : "0"}
      className={`play-control flex items-center justify-center touch-none select-none rounded-lg border text-sm font-medium ${box} ${
        accent ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface/90 text-fg"
      } ${pressed ? "ring-2 ring-fg brightness-125" : ""}`}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </div>
  );
}
