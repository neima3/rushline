import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { Game } from "@/game/Game";
import { loadSettings } from "@/game/settings";
import { useGame } from "@/game/store";
import { Overlay } from "./Overlay";
import { TouchPad } from "./TouchPad";

function isTouchPlay(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768;
}

function applyTouchDefaults() {
  if (!isTouchPlay()) return;
  useGame.getState().setTouch(true);
}

export function Rushline() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);

  useLayoutEffect(() => {
    useGame.getState().hydrateSettings(loadSettings());
    applyTouchDefaults();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let game: Game | null = null;
    applyTouchDefaults();
    void import("@/game/Game").then(({ Game }) => {
      if (disposed || !canvasRef.current) return;
      game = new Game(canvasRef.current);
      gameRef.current = game;
      if (isTouchPlay()) game.setTouch(true);
    });

    const syncTouch = () => {
      if (isTouchPlay()) gameRef.current?.setTouch(true);
    };
    const mq = window.matchMedia("(pointer: coarse)");
    mq.addEventListener("change", syncTouch);
    window.addEventListener("resize", syncTouch);

    const blockScrollZoom = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("[data-allow-scroll]")) return;
      e.preventDefault();
    };
    const opts: AddEventListenerOptions = { passive: false };
    document.addEventListener("touchmove", blockScrollZoom, opts);
    document.addEventListener("gesturestart", blockScrollZoom, opts);
    document.addEventListener("gesturechange", blockScrollZoom, opts);
    document.addEventListener("gestureend", blockScrollZoom, opts);

    return () => {
      disposed = true;
      mq.removeEventListener("change", syncTouch);
      window.removeEventListener("resize", syncTouch);
      document.removeEventListener("touchmove", blockScrollZoom, opts);
      document.removeEventListener("gesturestart", blockScrollZoom, opts);
      document.removeEventListener("gesturechange", blockScrollZoom, opts);
      document.removeEventListener("gestureend", blockScrollZoom, opts);
      game?.dispose();
      gameRef.current = null;
    };
  }, []);

  const onSteer = useCallback((v: number) => gameRef.current?.setTouchSteer(v), []);
  const onThrottle = useCallback((v: number) => gameRef.current?.setTouchThrottle(v), []);
  const onBrake = useCallback((v: number) => gameRef.current?.setTouchBrake(v), []);
  const onSlide = useCallback((v: number) => gameRef.current?.setTouchSlide(v), []);
  const onRespawn = useCallback(() => gameRef.current?.respawn(), []);

  return (
    <main className="game-root relative h-dvh w-full overflow-hidden bg-bg">
      <canvas
        ref={canvasRef}
        tabIndex={0}
        className="absolute inset-0 size-full touch-none outline-none"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement | null)?.closest?.("[data-play-control]")) return;
          gameRef.current?.capturePlayFocus();
        }}
      />
      <Overlay gameRef={gameRef} />
      <TouchPad
        onSteer={onSteer}
        onThrottle={onThrottle}
        onBrake={onBrake}
        onSlide={onSlide}
        onRespawn={onRespawn}
      />
    </main>
  );
}
