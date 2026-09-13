import {
  CUP_EVENTS,
  CUP_META,
  continueEvent,
  cupClearedCount,
  cupContinueLabel,
  isEventCleared,
  isEventUnlocked,
  type CupEvent,
} from "@/game/cup";
import { TRACK_ENV_LABEL } from "@/game/flow";
import { TRACK_DEFS } from "@/game/track";
import { useGame } from "@/game/store";
import type { CupId } from "@/game/types";
import { cn, formatTime } from "@/lib/utils";
import { keepPlayFocus, MedalRow } from "./chrome";

type Props = {
  ready: boolean;
  onContinue: () => void;
  onEvent: (id: string) => void;
  onBack: () => void;
};

export function CupScreen({ ready, onContinue, onEvent, onBack }: Props) {
  const progress = useGame((s) => s.cupProgress);
  const focusId = useGame((s) => s.cupFocusId);
  const next = continueEvent(progress);
  const goldDone = cupClearedCount(progress, "gold");
  const authorDone = cupClearedCount(progress, "author");

  return (
    <div
      data-overlay="cup"
      className="pointer-events-auto absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-bg via-bg/78 to-transparent md:justify-center"
    >
      <div
        data-allow-scroll
        className="overlay-enter flex max-h-full w-full max-w-xl flex-col gap-6 overflow-auto overscroll-contain px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(4rem,calc(env(safe-area-inset-top)+2.5rem))] md:ml-10 md:max-w-lg md:px-0"
      >
        <header className="overlay-stagger-1">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted">Challenge</p>
          <h1 className="font-display text-6xl leading-none tracking-tight md:text-7xl">RUSH CUP</h1>
          <p className="mt-3 max-w-sm text-pretty text-muted">
            A short medal campaign. Clear Gold on every track, then hunt Author. Progress stays on this device.
          </p>
          <p className="mt-3 text-xs uppercase tracking-[0.16em] text-subtle">
            Gold {goldDone}/{CUP_EVENTS.gold.length}
            <span className="mx-2 text-border">·</span>
            Author {authorDone}/{CUP_EVENTS.author.length}
          </p>
        </header>

        <div className="overlay-stagger-2 flex flex-col gap-2">
          <button
            type="button"
            disabled={!ready || !next}
            onMouseDown={keepPlayFocus}
            onClick={onContinue}
            className="group flex h-14 flex-col items-start justify-center rounded-lg bg-accent px-5 text-left text-accent-fg transition-[transform,filter] duration-150 ease-out enabled:hover:brightness-95 enabled:active:scale-[0.98] disabled:opacity-50"
          >
            <span className="text-sm font-semibold">{next ? "Continue" : "Campaign complete"}</span>
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-accent-fg/70">
              {cupContinueLabel(progress)}
            </span>
          </button>
        </div>

        <CupBlock cupId="gold" focusId={focusId} onEvent={onEvent} />
        <CupBlock cupId="author" focusId={focusId} onEvent={onEvent} />

        <button
          type="button"
          onClick={onBack}
          className="h-11 rounded-md border border-border bg-bg-elevated text-sm text-muted"
        >
          Back
        </button>
      </div>
    </div>
  );
}

function CupBlock({
  cupId,
  focusId,
  onEvent,
}: {
  cupId: CupId;
  focusId: string;
  onEvent: (id: string) => void;
}) {
  const progress = useGame((s) => s.cupProgress);
  const events = CUP_EVENTS[cupId];
  const cleared = cupClearedCount(progress, cupId);
  const locked = cupId === "author" && progress.unlocked.author < 0;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">{CUP_META[cupId].name}</p>
          <p className="mt-1 text-xs text-subtle">{locked ? "Clear Gold Cup to unlock." : CUP_META[cupId].blurb}</p>
        </div>
        <p className="text-xs tabular-nums text-muted">
          {cleared}/{events.length}
        </p>
      </div>
      {events.map((event, i) => (
        <EventCard
          key={event.id}
          event={event}
          selected={event.id === focusId}
          delay={80 + i * 45}
          onEvent={onEvent}
        />
      ))}
    </section>
  );
}

function EventCard({
  event,
  selected,
  delay,
  onEvent,
}: {
  event: CupEvent;
  selected: boolean;
  delay: number;
  onEvent: (id: string) => void;
}) {
  const progress = useGame((s) => s.cupProgress);
  const track = TRACK_DEFS[event.trackId];
  const unlocked = isEventUnlocked(progress, event);
  const cleared = isEventCleared(progress, event);
  const cupTime = progress.times[event.id];
  const cupMedal = progress.medals[event.id] ?? null;
  const targetAt = track.medals[event.target];

  return (
    <button
      type="button"
      disabled={!unlocked}
      onMouseDown={keepPlayFocus}
      onClick={() => onEvent(event.id)}
      data-cup-event={event.id}
      data-track={event.trackId}
      style={{ animationDelay: `${delay}ms` }}
      className={cn(
        "track-card overlay-card-in flex overflow-hidden rounded-xl border text-left transition-[transform,border-color,background-color,opacity] duration-150",
        selected ? "border-fg/45 bg-surface" : "border-border bg-surface/90 hover:border-border",
        !unlocked && "opacity-45",
      )}
    >
      <span className="track-card-thumb relative h-[6.5rem] w-28 shrink-0 overflow-hidden sm:w-32">
        <img src={track.thumb} alt="" className="size-full object-cover" crossOrigin="anonymous" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-center px-4 py-3">
        <span className="flex items-center gap-2">
          <span className="font-display text-2xl leading-none tracking-tight">{track.name}</span>
          <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-muted">
            {!unlocked ? "Locked" : cleared ? "Cleared" : selected ? "Ready" : "Open"}
          </span>
        </span>
        <span className="mt-1 text-[11px] uppercase tracking-[0.16em] text-subtle">
          {TRACK_ENV_LABEL[track.env]} · {event.target === "author" ? "Author" : "Gold"} {formatTime(targetAt)}
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums text-subtle">
          <MedalRow medal={cupMedal} />
          <span>Cup {formatTime(cupTime ?? -1)}</span>
        </span>
      </span>
    </button>
  );
}
