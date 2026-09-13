import { useEffect, useRef, useState } from "react";
import { Aperture, Camera, X } from "lucide-react";
import { photoHint } from "@/game/help";
import { PHOTO_DRAG_PITCH, PHOTO_DRAG_YAW } from "@/game/photo";
import { useGame } from "@/game/store";
import { cn } from "@/lib/utils";
import { keepPlayFocus } from "./chrome";

type Props = {
  touch: boolean;
  onNudge: (dyaw: number, dpitch: number, dzoom?: number) => void;
  onCapture: () => void;
  onClose: () => void;
  onScrub: (u: number) => void;
  onFollowGhost: (v: boolean) => void;
};

export function PhotoScreen({ touch, onNudge, onCapture, onClose, onScrub, onFollowGhost }: Props) {
  const capturing = useGame((s) => s.photoCapturing);
  const canGhost = useGame((s) => s.photoGhost);
  const scrub = useGame((s) => s.photoScrub);
  const follow = useGame((s) => s.photoFollowGhost);
  const [flash, setFlash] = useState(false);
  const orbitRef = useRef<HTMLDivElement>(null);
  const nudgeRef = useRef(onNudge);
  nudgeRef.current = onNudge;

  useEffect(() => {
    if (!capturing) return;
    setFlash(true);
    const id = window.setTimeout(() => setFlash(false), 180);
    return () => window.clearTimeout(id);
  }, [capturing]);

  useEffect(() => {
    const el = orbitRef.current;
    if (!el || capturing) return;
    const drag = { id: -1, x: 0, y: 0, pinch: 0 };
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.("[data-photo-chrome]")) return;
      e.preventDefault();
      drag.id = e.pointerId;
      drag.x = e.clientX;
      drag.y = e.clientY;
      el.setPointerCapture?.(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (drag.id !== e.pointerId) return;
      e.preventDefault();
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      nudgeRef.current(dx * PHOTO_DRAG_YAW, -dy * PHOTO_DRAG_PITCH);
    };
    const up = (e: PointerEvent) => {
      if (drag.id !== e.pointerId) return;
      drag.id = -1;
      try {
        el.releasePointerCapture?.(e.pointerId);
      } catch {
        /* already released */
      }
    };
    const wheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.("[data-photo-chrome]")) return;
      e.preventDefault();
      nudgeRef.current(0, 0, e.deltaY > 0 ? 0.08 : -0.08);
    };
    const opts: AddEventListenerOptions = { passive: false };
    el.addEventListener("pointerdown", down, opts);
    el.addEventListener("pointermove", move, opts);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, opts);
    return () => {
      el.removeEventListener("pointerdown", down, opts);
      el.removeEventListener("pointermove", move, opts);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel, opts);
    };
  }, [capturing]);

  return (
    <div
      ref={orbitRef}
      data-overlay="photo"
      className="pointer-events-auto absolute inset-0 z-30 touch-none"
    >
      {flash || capturing ? <div className="photo-shutter pointer-events-none absolute inset-0" /> : null}

      {!capturing ? (
        <>
          <div
            data-photo-chrome
            className="absolute top-[max(0.75rem,env(safe-area-inset-top))] left-[max(0.75rem,env(safe-area-inset-left))] right-[max(0.75rem,env(safe-area-inset-right))] flex items-start justify-between"
          >
            <p className="hud-chip inline-flex h-11 items-center gap-2 rounded-md px-3 text-xs font-medium uppercase tracking-[0.18em] text-muted">
              <Camera className="size-4 text-fg" />
              Photo
            </p>
            <button
              type="button"
              className="play-control hud-chip flex h-11 items-center gap-2 rounded-md px-3 text-fg"
              onMouseDown={keepPlayFocus}
              onClick={onClose}
              aria-label="Exit photo mode"
            >
              <X className="size-4" />
              <span className="text-xs font-medium uppercase tracking-widest text-muted">Done</span>
            </button>
          </div>

          <div
            data-photo-chrome
            className="absolute bottom-[max(0.85rem,env(safe-area-inset-bottom))] left-1/2 flex w-[min(28rem,calc(100%-1.4rem))] -translate-x-1/2 flex-col gap-2"
          >
            {canGhost ? (
              <div className="hud-chrome photo-tray rounded-xl px-3.5 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Ghost cam</p>
                  <button
                    type="button"
                    onMouseDown={keepPlayFocus}
                    onClick={() => onFollowGhost(!follow)}
                    className={cn(
                      "h-9 rounded-md px-3 text-xs font-semibold uppercase tracking-widest",
                      follow ? "bg-accent text-accent-fg" : "border border-border bg-bg-elevated text-muted",
                    )}
                  >
                    {follow ? "Following" : "Chase car"}
                  </button>
                </div>
                <label className="mt-2 flex items-center gap-3">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-subtle">Scrub</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={scrub}
                    data-allow-scroll
                    className="settings-range photo-scrub min-w-0 flex-1"
                    onChange={(e) => onScrub(Number(e.target.value))}
                  />
                </label>
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onMouseDown={keepPlayFocus}
                onClick={onCapture}
                className="play-control flex h-12 flex-1 items-center justify-center gap-2 rounded-md bg-accent text-sm font-semibold text-accent-fg"
              >
                <Aperture className="size-4" />
                Capture still
              </button>
              <button
                type="button"
                onMouseDown={keepPlayFocus}
                onClick={() => onNudge(0, 0, -0.12)}
                className="play-control hud-chip flex size-12 items-center justify-center rounded-md text-lg text-fg"
                aria-label="Zoom in"
              >
                +
              </button>
              <button
                type="button"
                onMouseDown={keepPlayFocus}
                onClick={() => onNudge(0, 0, 0.12)}
                className="play-control hud-chip flex size-12 items-center justify-center rounded-md text-lg text-fg"
                aria-label="Zoom out"
              >
                −
              </button>
            </div>

            <p className="text-center text-[11px] leading-snug text-muted">{photoHint(touch)}</p>
          </div>
        </>
      ) : null}
    </div>
  );
}
