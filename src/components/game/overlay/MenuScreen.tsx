import { Car, CircleHelp, Gamepad2, Gauge, Settings, Volume2, VolumeX } from "lucide-react";
import { LIVERY_ORDER, liveryDef } from "@/game/livery";
import { allTrackDefs, medalFor, TRACK_DEFS } from "@/game/track";
import { TRACK_ENV_LABEL } from "@/game/flow";
import { COPY } from "@/game/help";
import { padRaceHint } from "@/game/gamepad";
import { useGame } from "@/game/store";
import type { TrackId } from "@/game/types";
import { cn, formatTime } from "@/lib/utils";
import { keepPlayFocus, MedalRow } from "./chrome";

type Props = {
  ready: boolean;
  best: Partial<Record<TrackId, number>>;
  lastTimes: Partial<Record<TrackId, number>>;
  recents: Partial<Record<TrackId, number[]>>;
  muted: boolean;
  auto: boolean;
  pad: { connected: boolean; xbox: boolean; active: boolean };
  onStart: () => void;
  onTracks: () => void;
  onCup: () => void;
  cupLabel: string;
  onBack: () => void;
  onRace: (id: TrackId) => void;
  onMute: () => void;
  onAuto: () => void;
  onSettings: () => void;
  onHelp: () => void;
  onGarage: () => void;
  select: boolean;
  garage: boolean;
};

export function MenuScreen({
  ready,
  best,
  lastTimes,
  recents,
  muted,
  auto,
  pad,
  onStart,
  onTracks,
  onCup,
  cupLabel,
  onBack,
  onRace,
  onMute,
  onAuto,
  onSettings,
  onHelp,
  onGarage,
  select,
  garage,
}: Props) {
  const trackId = useGame((s) => s.trackId);
  const featured = TRACK_DEFS[trackId];

  return (
    <div
      data-overlay={garage ? "garage" : select ? "select" : "menu"}
      className="pointer-events-auto absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-bg via-bg/78 to-transparent md:justify-center"
    >
      <div
        data-allow-scroll
        className="overlay-enter flex max-h-full w-full max-w-xl flex-col gap-6 overflow-auto overscroll-contain px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(4rem,calc(env(safe-area-inset-top)+2.5rem))] md:ml-10 md:max-w-lg md:px-0"
      >
        <header className="overlay-stagger-1">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted">{COPY.productEyebrow}</p>
          <h1 className="font-display text-6xl leading-none tracking-tight md:text-7xl">RUSHLINE</h1>
          <p className="mt-3 max-w-sm text-pretty text-muted">{COPY.tagline}</p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-border/80 bg-bg/50 px-3 py-1 text-xs text-subtle">
            <Gamepad2 className="size-3.5" />
            {pad.connected
              ? `${pad.xbox ? "Xbox controller" : "Controller"} connected — A to start · ${padRaceHint(pad.xbox)}`
              : COPY.padIdle}
          </p>
        </header>

        {garage ? (
          <GaragePicker onBack={onBack} />
        ) : !select ? (
          <div className="overlay-stagger-2 flex flex-col gap-2">
            <button
              type="button"
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
              onClick={onCup}
              className="flex h-14 flex-col items-start justify-center rounded-lg border border-border bg-surface px-5 text-left text-fg transition-colors hover:bg-bg-elevated"
            >
              <span className="text-sm font-medium">Rush Cup</span>
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{cupLabel}</span>
            </button>
            <button
              type="button"
              onClick={onTracks}
              className="h-12 rounded-lg border border-border bg-surface px-5 text-sm font-medium text-fg transition-colors hover:bg-bg-elevated"
            >
              Tracks
            </button>
            <button
              type="button"
              onClick={onGarage}
              className="flex h-12 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-5 text-sm font-medium text-fg transition-colors hover:bg-bg-elevated"
            >
              <Car className="size-4" />
              Garage
            </button>
            <button
              type="button"
              onClick={onHelp}
              className="flex h-12 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-5 text-sm font-medium text-fg transition-colors hover:bg-bg-elevated"
            >
              <CircleHelp className="size-4" />
              Help & controls
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
            <p className="mt-1 hidden text-xs text-subtle md:block">{COPY.menuHint}</p>
          </div>
        ) : (
          <div className="overlay-stagger-2 flex flex-col gap-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">{COPY.selectEyebrow}</p>
            {allTrackDefs().map((t, i) => {
              const pb = best[t.id];
              const last = lastTimes[t.id];
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
                    selected ? "border-fg/45 bg-surface" : "border-border bg-surface/90 hover:border-border",
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
                    <span className="mt-2 flex flex-col gap-1 text-xs tabular-nums text-subtle">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <MedalRow medal={medal} />
                        <span>Best {formatTime(pb ?? -1)}</span>
                        {last != null && last !== pb ? <span>· Last {formatTime(last)}</span> : null}
                      </span>
                      <TrackMedalTimes trackId={t.id} recents={recents[t.id]} />
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

function GaragePicker({ onBack }: { onBack: () => void }) {
  const livery = useGame((s) => s.settings.livery);
  const setLivery = useGame((s) => s.setLivery);

  return (
    <div className="overlay-stagger-2 flex flex-col gap-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">{COPY.garageTitle}</p>
      <p className="text-xs text-subtle">{COPY.garageBlurb}</p>
      <div className="grid grid-cols-2 gap-2">
        {LIVERY_ORDER.map((id, i) => {
          const def = liveryDef(id);
          const selected = id === livery;
          return (
            <button
              key={id}
              type="button"
              onMouseDown={keepPlayFocus}
              onClick={() => setLivery(id)}
              data-livery={id}
              style={{ animationDelay: `${80 + i * 45}ms` }}
              className={cn(
                "livery-card overlay-card-in flex overflow-hidden rounded-xl border text-left transition-[transform,border-color,background-color] duration-150",
                selected ? "border-fg/45 bg-surface" : "border-border bg-surface/90 hover:border-border",
              )}
            >
              <span className="livery-thumb relative h-[5.4rem] w-[4.6rem] shrink-0 overflow-hidden sm:w-24" data-livery={id} />
              <span className="flex min-w-0 flex-1 flex-col justify-center px-3 py-2.5">
                <span className="flex items-center gap-1.5">
                  <span className="font-display text-xl leading-none tracking-tight">{def.name}</span>
                  {selected ? (
                    <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-muted">
                      On car
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 text-[11px] leading-snug text-muted">{def.blurb}</span>
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onBack}
        className="h-11 rounded-md border border-border bg-bg-elevated text-sm text-muted"
      >
        Back
      </button>
    </div>
  );
}

function TrackMedalTimes({ trackId, recents }: { trackId: TrackId; recents?: number[] }) {
  const medals = TRACK_DEFS[trackId].medals;
  return (
    <span className="flex flex-wrap gap-x-2 text-[10px] uppercase tracking-widest text-subtle">
      <span>A {formatTime(medals.author)}</span>
      <span>G {formatTime(medals.gold)}</span>
      <span>S {formatTime(medals.silver)}</span>
      <span>B {formatTime(medals.bronze)}</span>
      {recents && recents.length > 1 ? (
        <span className="normal-case tracking-normal">· {recents.length} local times</span>
      ) : null}
    </span>
  );
}
