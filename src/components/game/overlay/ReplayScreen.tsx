import { Pause, Play, X } from "lucide-react";
import { cameraLabel } from "@/game/camera";
import { replayHint } from "@/game/help";
import { useGame } from "@/game/store";
import type { GhostSource } from "@/game/types";
import { cn, formatTime } from "@/lib/utils";
import { keepPlayFocus } from "./chrome";

type Props = {
  touch: boolean;
  onPlay: (v: boolean) => void;
  onScrub: (u: number) => void;
  onSource: (source: GhostSource) => void;
  onCamera: () => void;
  onClose: () => void;
};

export function ReplayScreen({ touch, onPlay, onScrub, onSource, onCamera, onClose }: Props) {
  const playing = useGame((s) => s.replayPlaying);
  const scrub = useGame((s) => s.replayScrub);
  const source = useGame((s) => s.replaySource);
  const label = useGame((s) => s.replayLabel);
  const duration = useGame((s) => s.replayDuration);
  const choices = useGame((s) => s.replayChoices);
  const camera = useGame((s) => s.camera);
  const ended = duration > 0 && scrub >= 0.995;

  return (
    <div data-overlay="replay" className="pointer-events-none absolute inset-0 z-30">
      <div className="pointer-events-auto absolute top-[max(0.75rem,env(safe-area-inset-top))] left-[max(0.75rem,env(safe-area-inset-left))] right-[max(0.75rem,env(safe-area-inset-right))] flex items-start justify-between">
        <p className="hud-chip inline-flex h-11 items-center gap-2 rounded-md px-3 text-xs font-medium uppercase tracking-[0.18em] text-muted">
          Replay
          <span className="text-fg">{label || "Ghost"}</span>
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="play-control hud-chip flex h-11 items-center rounded-md px-3 text-xs font-medium uppercase tracking-widest text-muted"
            onMouseDown={keepPlayFocus}
            onClick={onCamera}
            data-camera={camera}
            aria-label="Cycle camera"
          >
            {cameraLabel(camera)}
          </button>
          <button
            type="button"
            className="play-control hud-chip flex h-11 items-center gap-2 rounded-md px-3 text-fg"
            onMouseDown={keepPlayFocus}
            onClick={onClose}
            aria-label="Exit replay"
          >
            <X className="size-4" />
            <span className="text-xs font-medium uppercase tracking-widest text-muted">Done</span>
          </button>
        </div>
      </div>

      <div className="pointer-events-auto absolute bottom-[max(0.85rem,env(safe-area-inset-bottom))] left-1/2 flex w-[min(32rem,calc(100%-1.4rem))] -translate-x-1/2 flex-col gap-2">
        {choices.length > 1 ? (
          <div className="flex flex-wrap justify-center gap-1.5">
            {choices.map((choice) => (
              <button
                key={choice.source}
                type="button"
                onMouseDown={keepPlayFocus}
                onClick={() => onSource(choice.source)}
                className={cn(
                  "h-9 rounded-md px-3 text-[11px] font-semibold uppercase tracking-widest",
                  source === choice.source ? "bg-accent text-accent-fg" : "hud-chip text-muted",
                )}
              >
                {choice.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="hud-chrome photo-tray rounded-xl px-3.5 py-2.5">
          <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-muted">
            <span>Timeline</span>
            <span className="font-mono text-xs tabular-nums tracking-wide text-fg">
              {formatTime(scrub * duration)}
              <span className="text-subtle"> / {formatTime(duration)}</span>
            </span>
          </div>
          <label className="mt-2 flex items-center gap-3">
            <span className="sr-only">Scrub replay</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.002}
              value={scrub}
              data-allow-scroll
              className="settings-range photo-scrub min-w-0 flex-1"
              onChange={(e) => onScrub(Number(e.target.value))}
            />
          </label>
        </div>

        <button
          type="button"
          onMouseDown={keepPlayFocus}
          onClick={() => onPlay(ended ? true : !playing)}
          className="play-control flex h-12 items-center justify-center gap-2 rounded-md bg-accent text-sm font-semibold text-accent-fg"
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          {playing ? "Pause" : ended ? "Replay from start" : "Play"}
        </button>

        <p className="text-center text-[11px] leading-snug text-muted">{replayHint(touch)}</p>
      </div>
    </div>
  );
}
