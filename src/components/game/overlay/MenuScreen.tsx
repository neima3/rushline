import { Gamepad2, Gauge, Settings, Volume2, VolumeX } from "lucide-react";
import { allTrackDefs, medalFor, TRACK_DEFS } from "@/game/track";
import { TRACK_ENV_LABEL } from "@/game/flow";
import { useGame } from "@/game/store";
import type { TrackId } from "@/game/types";
import { cn, formatTime } from "@/lib/utils";
import { keepPlayFocus, MedalRow } from "./chrome";

type Props = {
  ready: boolean;
  best: Partial<Record<TrackId, number>>;
  muted: boolean;
  auto: boolean;
  pad: { connected: boolean; xbox: boolean; active: boolean };
  onStart: () => void;
  onTracks: () => void;
  onBack: () => void;
  onRace: (id: TrackId) => void;
  onMute: () => void;
  onAuto: () => void;
  onSettings: () => void;
  select: boolean;
};

export function MenuScreen({
  ready,
  best,
  muted,
  auto,
  pad,
  onStart,
  onTracks,
  onBack,
  onRace,
  onMute,
  onAuto,
  onSettings,
  select,
}: Props) {
  const trackId = useGame((s) => s.trackId);
  const featured = TRACK_DEFS[trackId];

  return (
    <div
      data-overlay={select ? "select" : "menu"}
      className="pointer-events-auto absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-bg via-bg/78 to-transparent md:justify-center"
    >
      <div
        data-allow-scroll
        className="overlay-enter flex max-h-full w-full max-w-xl flex-col gap-6 overflow-auto overscroll-contain px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(4rem,calc(env(safe-area-inset-top)+2.5rem))] md:ml-10 md:max-w-lg md:px-0"
      >
        <header className="overlay-stagger-1">
          {select ? (
            <>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted">Time trial</p>
              <h1 className="font-display text-5xl leading-none tracking-tight md:text-6xl">Tracks</h1>
              <p className="mt-2 max-w-sm text-pretty text-muted">Pick a circuit. Beat the medals. Your ghost rides shotgun.</p>
            </>
          ) : (
            <>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted">Time trial</p>
              <h1 className="font-display text-6xl leading-none tracking-tight md:text-7xl">RUSHLINE</h1>
              <p className="mt-3 max-w-sm text-pretty text-muted">
                A precision 3D circuit racer. Hit every checkpoint, keep the car on the plastic, beat the medals.
              </p>
              <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-border/80 bg-bg/50 px-3 py-1 text-xs text-subtle">
                <Gamepad2 className="size-3.5" />
                {pad.connected
                  ? `${pad.xbox ? "Xbox controller" : "Controller"} connected — A to start`
                  : "Xbox controller supported — press any button"}
              </p>
            </>
          )}
        </header>

        {!select ? (
          <div className="overlay-stagger-2 flex flex-col gap-2">
            <button
              type="button"
              data-action="start"
              disabled={!ready}
              onMouseDown={keepPlayFocus}
              onClick={onStart}
              className="group flex h-14 flex-col items-start justify-center rounded-lg bg-accent px-5 text-left text-accent-fg transition-[transform,filter] duration-150 ease-out enabled:hover:brightness-95 enabled:active:scale-[0.98] disabled:opacity-50"
            >
              <span className="text-sm font-semibold">{ready ? "Start" : "Loading…"}</span>
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-accent-fg/70">
                {featured.name}
              </span>
            </button>
            <button
              type="button"
              onClick={onTracks}
              className="h-12 rounded-lg border border-border bg-surface px-5 text-sm font-medium text-fg transition-colors hover:bg-bg-elevated"
            >
              Tracks
            </button>
            <div className="mt-1 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={onMute}
                className="flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-bg-elevated text-sm text-muted"
              >
                {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                <span className="hidden sm:inline">{muted ? "Muted" : "Sound"}</span>
              </button>
              <button
                type="button"
                onClick={onAuto}
                className="flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-bg-elevated text-sm text-muted"
              >
                <Gauge className="size-4" />
                <span className="hidden sm:inline">{auto ? "Auto" : "Manual"}</span>
              </button>
              <button
                type="button"
                onClick={onSettings}
                className="flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-bg-elevated text-sm text-muted"
                aria-label="Settings"
              >
                <Settings className="size-4" />
                <span className="hidden sm:inline">Settings</span>
              </button>
            </div>
            <p className="mt-1 hidden text-xs text-subtle md:block">
              WASD steer · Space slide · Esc pause · Settings for graphics and Track Assist
            </p>
          </div>
        ) : (
          <div className="overlay-stagger-2 flex flex-col gap-3">
            {allTrackDefs().map((t, i) => {
              const pb = best[t.id];
              const medal = medalFor(t.id, pb ?? Number.POSITIVE_INFINITY);
              const selected = t.id === trackId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onMouseDown={keepPlayFocus}
                  onClick={() => onRace(t.id)}
                  data-track={t.id}
                  style={{ animationDelay: `${80 + i * 55}ms` }}
                  className={cn(
                    "track-card overlay-card-in flex overflow-hidden rounded-xl border text-left transition-[transform,border-color,background-color] duration-150",
                    selected
                      ? "track-card-selected border-[rgba(94,232,255,0.42)] bg-surface"
                      : "border-border bg-surface/90 hover:border-fg/20",
                  )}
                >
                  <span className="track-card-thumb relative h-[6.5rem] w-28 shrink-0 overflow-hidden sm:w-32">
                    <img src={t.thumb} alt="" className="size-full object-cover" crossOrigin="anonymous" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col justify-center px-4 py-3">
                    <span className="flex items-center gap-2">
                      <span className="font-display text-2xl leading-none tracking-tight">{t.name}</span>
                      {selected ? (
                        <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-muted">
                          Ready
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 text-[11px] uppercase tracking-[0.16em] text-subtle">
                      {TRACK_ENV_LABEL[t.env]} · {t.laps} {t.laps === 1 ? "lap" : "laps"}
                    </span>
                    <span className="mt-1 text-xs text-muted">{t.blurb}</span>
                    <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums text-subtle">
                      <MedalRow medal={medal} />
                      <span>Best {formatTime(pb ?? -1)}</span>
                    </span>
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={onBack}
              className="h-11 rounded-md border border-border bg-bg-elevated text-sm text-muted"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
