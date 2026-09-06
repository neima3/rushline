import { useCallback, useEffect, useRef } from "react";
import type { Game } from "@/game/Game";
import { Overlay } from "./Overlay";
import { TouchPad } from "./TouchPad";

export function Rushline() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let game: Game | null = null;
    void import("@/game/Game").then(({ Game }) => {
      if (disposed || !canvasRef.current) return;
      game = new Game(canvasRef.current);
      gameRef.current = game;
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      if (coarse) game.setTouch(true);
    });
    return () => {
      disposed = true;
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
      <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" />
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
