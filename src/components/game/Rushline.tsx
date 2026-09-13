import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Game } from "@/game/Game";
import { muteFromSearch } from "@/game/audio";
import { loadSettings } from "@/game/settings";
import { readSave, useGame } from "@/game/store";
import { GameErrorBoundary } from "./GameErrorBoundary";
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

function bootMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "WebGL failed to start. Try another browser or turn off extra GPU flags.";
}

export function Rushline() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const ready = useGame((s) => s.ready);
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootGen, setBootGen] = useState(0);

  useLayoutEffect(() => {
    useGame.getState().hydrateSettings(loadSettings(isTouchPlay(), readSave().livery));
    if (muteFromSearch(window.location.search)) useGame.getState().setMuted(true);
    applyTouchDefaults();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let game: Game | null = null;
    applyTouchDefaults();
    setBootError(null);
    useGame.getState().setReady(false);

    void import("@/game/Game")
      .then(({ Game }) => {
        if (disposed || !canvasRef.current) return;
        try {
          game = new Game(canvasRef.current);
        } catch (err) {
          setBootError(bootMessage(err));
          return;
        }
        gameRef.current = game;
        if (isTouchPlay()) game.setTouch(true);
      })
      .catch((err: unknown) => {
        if (!disposed) setBootError(bootMessage(err));
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
  }, [bootGen]);

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
      {!ready && !bootError ? <BootScreen /> : null}
      {bootError ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
          <p className="font-display text-4xl tracking-tight">Can't start 3D</p>
          <p className="max-w-sm text-sm text-muted">{bootError}</p>
          <button
            type="button"
            className="h-11 rounded-lg bg-accent px-5 text-sm font-medium text-accent-fg"
            onClick={() => setBootGen((n) => n + 1)}
          >
            Retry
          </button>
        </div>
      ) : null}
      <GameErrorBoundary>
        <Overlay gameRef={gameRef} />
        <TouchPad
          onSteer={onSteer}
          onThrottle={onThrottle}
          onBrake={onBrake}
          onSlide={onSlide}
          onRespawn={onRespawn}
        />
      </GameErrorBoundary>
    </main>
  );
}

function BootScreen() {
  return (
    <div
      className="rushline-boot pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-bg px-6 text-center"
      role="status"
      aria-live="polite"
    >
      <p className="font-display text-6xl leading-none tracking-tight md:text-7xl">RUSHLINE</p>
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted">Loading circuit</p>
      <span className="rushline-boot-bar" aria-hidden />
    </div>
  );
}
