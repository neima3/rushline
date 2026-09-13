import { useEffect, useRef, useState } from "react";
import { Car, ChevronDown, CircleHelp, Gamepad2, Gauge, Pencil, Settings, Users, Volume2, VolumeX } from "lucide-react";
import { LIVERY_ORDER, liveryDef } from "@/game/livery";
import { resolveRaceLaps, scaleMedals } from "@/game/laps";
import { allTrackDefs, getTrackDef, medalFromTimes } from "@/game/track";
import { TRACK_ENV_LABEL } from "@/game/flow";
import { COPY, selectListHint } from "@/game/help";
import { padRaceHint } from "@/game/gamepad";
import { useGame } from "@/game/store";
import { TRACK_ORDER, type TrackId } from "@/game/types";
import { cn, formatTime } from "@/lib/utils";
import { keepPlayFocus, MedalRow } from "./chrome";
import { GhostShare } from "./GhostShare";

function useOverflowBelow(active: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [below, setBelow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !active) {
      setBelow(false);
      return;
    }
    const update = () => {
      setBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 28);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    for (const child of el.children) ro.observe(child);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [active]);

  return { ref, below };
}

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
  onHotseat: () => void;
  hotseatSelect?: boolean;
  onCup: () => void;
  cupLabel: string;
  onBack: () => void;
  onRace: (id: TrackId) => void;
  onRaceRival?: (id: TrackId) => void;
  onUiClick?: () => void;
  onEditCustom: () => void;
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
  onHotseat,
  hotseatSelect,
  onCup,
  cupLabel,
  onBack,
  onRace,
  onRaceRival,
  onUiClick,
  onEditCustom,
  onMute,
  onAuto,
  onSettings,
  onHelp,
  onGarage,
  select,
  garage,
}: Props) {
  const trackId = useGame((s) => s.trackId);
  const featured = getTrackDef(trackId);
  const imports = useGame((s) => s.imports);
  const stockLaps = useGame((s) => s.settings.stockLaps);
  const picking = select && !garage;
  const scrollCue = useOverflowBelow(picking);

  return (
    <div
      data-overlay={garage ? "garage" : select ? "select" : "menu"}
      className="pointer-events-auto absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-bg via-bg/78 to-transparent md:justify-center"
    >
      <div
        ref={scrollCue.ref}
        data-allow-scroll
        className={cn(
          "overlay-enter flex max-h-full w-full max-w-xl flex-col overflow-auto overscroll-contain px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(4rem,calc(env(safe-area-inset-top)+2.5rem))] md:ml-10 md:max-w-lg md:px-0",
          picking ? "gap-4" : "gap-6",
        )}
      >
        <header className="overlay-stagger-1">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted">{COPY.productEyebrow}</p>
          <h1
            className={cn(
              "font-display leading-none tracking-tight",
              picking ? "text-5xl md:text-6xl" : "text-6xl md:text-7xl",
            )}
          >
            RUSHLINE
          </h1>
          {!picking ? (
            <>
              <p className="mt-3 max-w-sm text-pretty text-muted">{COPY.tagline}</p>
              <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-border/80 bg-bg/50 px-3 py-1 text-xs text-subtle">
                <Gamepad2 className="size-3.5" />
                {pad.connected
                  ? `${pad.xbox ? "Xbox controller" : "Controller"} connected — A to start · ${padRaceHint(pad.xbox)}`
                  : COPY.padIdle}
              </p>
            </>
          ) : null}
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
              data-hotseat
              onClick={onHotseat}
              className="flex h-14 flex-col items-start justify-center rounded-lg border border-border bg-surface px-5 text-left text-fg transition-colors hover:bg-bg-elevated"
            >
              <span className="inline-flex items-center gap-2 text-sm font-medium">
                <Users className="size-4" />
                Hotseat
              </span>
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                P1 then P2 · same circuit · ghosts
              </span>
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
          <div className="overlay-stagger-2 flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
                {hotseatSelect ? COPY.selectHotseatEyebrow : COPY.selectEyebrow}
              </p>
              <p data-track-scroll-hint className="text-xs text-subtle">
                {selectListHint(TRACK_ORDER.length)}
              </p>
            </div>
            {allTrackDefs().map((t, i) => {
              const pb = best[t.id];
              const last = lastTimes[t.id];
              const raceLaps = resolveRaceLaps({
                trackId: t.id,
                authored: t.laps,
                setting: stockLaps,
                playMode: hotseatSelect ? "hotseat" : "trial",
              });
              const raceMedals = scaleMedals(t.medals, t.laps, raceLaps);
              const medal = medalFromTimes(raceMedals, pb ?? Number.POSITIVE_INFINITY);
              const selected = t.id === trackId;
              const body = (
                <>
                  <span className="track-card-thumb relative h-[6.25rem] w-28 shrink-0 overflow-hidden sm:h-[5.5rem] sm:w-28">
                    <img src={t.thumb} alt="" className="size-full object-cover" crossOrigin="anonymous" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col justify-center px-3.5 py-2.5 sm:py-2">
                    <span className="flex items-center gap-2">
                      <span className="font-display text-2xl leading-none tracking-tight">{t.name}</span>
                      {t.id === "custom" ? (
                        <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-muted">
                          Custom
                        </span>
                      ) : selected ? (
                        <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-muted">
                          Ready
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 text-[11px] uppercase tracking-[0.16em] text-subtle">
                      {TRACK_ENV_LABEL[t.env]} · {raceLaps} {raceLaps === 1 ? "lap" : "laps"}
                    </span>
                    <span className="mt-1 line-clamp-2 text-xs text-muted sm:line-clamp-1">{t.blurb}</span>
                    <span className="mt-2 flex flex-col gap-1 text-xs tabular-nums text-subtle">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <MedalRow medal={medal} />
                        <span>Best {formatTime(pb ?? -1)}</span>
                        {last != null && last !== pb ? <span>· Last {formatTime(last)}</span> : null}
                      </span>
                      {imports[t.id] != null ? (
                        <span className="text-[11px] uppercase tracking-[0.14em] text-ok">
                          Rival {formatTime(imports[t.id]!)}
                        </span>
                      ) : t.id !== "custom" && pb == null ? (
                        <span className="text-[11px] uppercase tracking-[0.14em] text-muted">
                          Author ghost {formatTime(t.medals.author)}
                        </span>
                      ) : null}
                      <TrackMedalTimes trackId={t.id} recents={recents[t.id]} medals={raceMedals} />
                    </span>
                    {t.id === "custom" ? (
                      <span className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          data-editor-open
                          onMouseDown={keepPlayFocus}
                          onClick={onEditCustom}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-bg-elevated px-2.5 text-[11px] font-medium uppercase tracking-widest text-fg"
                        >
                          <Pencil className="size-3" />
                          Edit ribbon
                        </button>
                        <button
                          type="button"
                          data-custom-drive
                          onMouseDown={keepPlayFocus}
                          onClick={() => onRace("custom")}
                          className="inline-flex h-8 items-center rounded-md bg-accent px-2.5 text-[11px] font-medium uppercase tracking-widest text-accent-fg"
                        >
                          Drive
                        </button>
                      </span>
                    ) : null}
                  </span>
                </>
              );
              const cardClass = cn(
                "track-card overlay-card-in flex overflow-hidden rounded-xl border text-left transition-[transform,border-color,background-color] duration-150",
                selected ? "border-fg/45 bg-surface" : "border-border bg-surface/90 hover:border-border",
              );
              if (t.id === "custom") {
                return (
                  <div key={t.id} data-track={t.id} style={{ animationDelay: `${80 + i * 55}ms` }} className={cardClass}>
                    {body}
                  </div>
                );
              }
              return (
                <button
                  key={t.id}
                  type="button"
                  onMouseDown={keepPlayFocus}
                  onClick={() => onRace(t.id)}
                  data-track={t.id}
                  style={{ animationDelay: `${80 + i * 55}ms` }}
                  className={cardClass}
                >
                  {body}
                </button>
              );
            })}
            <TrackGhostShare trackId={trackId} onRaceRival={onRaceRival} onUiClick={onUiClick} />
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
      {picking && scrollCue.below ? (
        <div
          data-track-more
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-start px-5 md:pl-10 md:pr-0"
        >
          <div className="flex h-20 w-full max-w-xl flex-col items-center justify-end bg-gradient-to-t from-bg via-bg/80 to-transparent pb-3 md:max-w-lg">
            <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-bg/85 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              <ChevronDown className="size-3.5" />
              {COPY.selectMoreHint}
            </span>
          </div>
        </div>
      ) : null}
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

function TrackGhostShare({
  trackId,
  onRaceRival,
  onUiClick,
}: {
  trackId: TrackId;
  onRaceRival?: (id: TrackId) => void;
  onUiClick?: () => void;
}) {
  const [shareId, setShareId] = useState(trackId);
  return (
    <div className="rounded-xl border border-border bg-surface/90 p-4">
      <label className="mb-3 flex flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">Circuit</span>
        <select
          value={shareId}
          onChange={(e) => setShareId(e.target.value as TrackId)}
          className="h-11 rounded-md border border-border bg-bg-elevated px-3 text-sm text-fg"
        >
          {allTrackDefs().map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <GhostShare
        trackId={shareId}
        allowImport
        allowRaceRival={Boolean(onRaceRival)}
        onRaceRival={onRaceRival ? () => onRaceRival(shareId) : undefined}
        onUiClick={onUiClick}
      />
    </div>
  );
}

function TrackMedalTimes({
  trackId,
  recents,
  medals: raceMedals,
}: {
  trackId: TrackId;
  recents?: number[];
  medals?: { author: number; gold: number; silver: number; bronze: number };
}) {
  const medals = raceMedals ?? getTrackDef(trackId).medals;
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
