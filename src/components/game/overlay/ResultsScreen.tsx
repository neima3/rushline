import { MEDAL_LABEL, resultsHeadline } from "@/game/flow";
import { medalPace, TRACK_DEFS } from "@/game/track";
import type { Medal, ResultsState, TrackId } from "@/game/types";
import { cn, formatDelta, formatTime } from "@/lib/utils";
import { keepPlayFocus, MedalRow } from "./chrome";

type Props = {
  results: ResultsState;
  nextName: string;
  onRetry: () => void;
  onNext: () => void;
  onMenu: () => void;
};

export function ResultsScreen({ results, nextName, onRetry, onNext, onMenu }: Props) {
  const track = TRACK_DEFS[results.trackId];
  const pbDelta = results.prevBest == null ? null : results.time - results.prevBest;
  const headline = resultsHeadline(results.medal, results.isPb);

  return (
    <div
      data-overlay="results"
      className="pointer-events-auto absolute inset-0 flex items-end justify-center bg-gradient-to-t from-bg via-bg/80 to-bg/35 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] md:items-center"
    >
      <div className="hud-chrome hud-pause-card overlay-enter results-card w-full max-w-md overflow-hidden p-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">{track.name}</p>
        <h2 className="font-display text-4xl leading-none tracking-tight md:text-5xl">{headline}</h2>

        <p className="results-time mt-5 font-display text-6xl leading-none tracking-tight tabular-nums md:text-7xl">
          {formatTime(results.time)}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <CompareChip
            label={results.prevBest == null ? "First finish" : results.isPb ? "vs last" : "vs PB"}
            value={pbDelta == null ? "New" : formatDelta(pbDelta)}
            tone={pbDelta == null || pbDelta < 0 ? "ok" : pbDelta > 0 ? "bad" : "even"}
            accent={results.isPb}
          />
          <CompareChip
            label="Ghost"
            value={results.hadGhost && results.ghostDelta != null ? formatDelta(results.ghostDelta) : "None"}
            tone={
              !results.hadGhost || results.ghostDelta == null
                ? "even"
                : results.ghostDelta < 0
                  ? "ok"
                  : results.ghostDelta > 0
                    ? "bad"
                    : "even"
            }
          />
        </div>

        <MedalCelebrate medal={results.medal} />
        <MedalBoard trackId={results.trackId} time={results.time} earned={results.medal} />

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onMouseDown={keepPlayFocus}
            onClick={onRetry}
            className="h-12 rounded-md bg-accent text-sm font-semibold text-accent-fg transition-[transform,filter] duration-150 ease-out enabled:hover:brightness-95 enabled:active:scale-[0.98]"
          >
            Retry
          </button>
          <button
            type="button"
            onMouseDown={keepPlayFocus}
            onClick={onNext}
            className="h-11 rounded-md border border-border bg-bg-elevated text-sm font-medium text-fg"
          >
            Next · {nextName}
          </button>
          <button
            type="button"
            onMouseDown={keepPlayFocus}
            onClick={onMenu}
            className="h-11 rounded-md border border-border bg-bg-elevated text-sm font-medium text-muted"
          >
            Menu
          </button>
        </div>
      </div>
    </div>
  );
}

function CompareChip({
  label,
  value,
  tone,
  accent,
}: {
  label: string;
  value: string;
  tone: "ok" | "bad" | "even";
  accent?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-2 rounded-full border px-3 py-1 text-xs tabular-nums",
        accent ? "results-pb-chip border-fg/35 bg-fg/10" : "border-border bg-bg/45",
        tone === "ok" ? "text-ok" : tone === "bad" ? "text-danger" : "text-muted",
      )}
    >
      <span className="font-medium uppercase tracking-[0.16em] text-subtle">{label}</span>
      <span className="font-mono text-sm font-semibold">{value}</span>
    </span>
  );
}

function MedalCelebrate({ medal }: { medal: Medal | null }) {
  if (!medal) {
    return <p className="mt-5 text-sm text-subtle">No medal this run — hunt bronze on the next.</p>;
  }
  const tone =
    medal === "author"
      ? "text-fg"
      : medal === "gold"
        ? "text-medal-gold"
        : medal === "silver"
          ? "text-medal-silver"
          : "text-medal-bronze";
  return (
    <div className="results-medal-stamp mt-5 flex items-center gap-3">
      <span
        className={cn(
          "hud-medal results-medal-orb inline-flex size-10 items-center justify-center rounded-full border text-xs font-bold uppercase",
          medal === "author" && "border-fg bg-fg text-accent-fg",
          medal === "gold" && "border-medal-gold bg-medal-gold text-accent-fg",
          medal === "silver" && "border-medal-silver bg-medal-silver text-accent-fg",
          medal === "bronze" && "border-medal-bronze bg-medal-bronze text-accent-fg",
        )}
      >
        {medal === "author" ? "A" : medal[0]!.toUpperCase()}
      </span>
      <div>
        <p className={cn("font-display text-3xl leading-none tracking-tight", tone)}>{MEDAL_LABEL[medal]}</p>
        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-subtle">Medal unlocked</p>
      </div>
    </div>
  );
}

function MedalBoard({ trackId, time, earned }: { trackId: TrackId; time: number; earned: Medal | null }) {
  const medals = TRACK_DEFS[trackId].medals;
  const pace = medalPace(trackId, time);
  const rows: { id: Medal; label: string; at: number }[] = [
    { id: "author", label: "Author", at: medals.author },
    { id: "gold", label: "Gold", at: medals.gold },
    { id: "silver", label: "Silver", at: medals.silver },
    { id: "bronze", label: "Bronze", at: medals.bronze },
  ];
  return (
    <div className="mt-5 space-y-2">
      <MedalRow medal={earned} />
      <ul className="space-y-1 text-sm">
        {rows.map((row) => {
          const got = !pace.lost.includes(row.id);
          const current = earned === row.id;
          return (
            <li
              key={row.id}
              className={cn(
                "flex items-center justify-between gap-3 tabular-nums",
                current ? "text-fg" : got ? "text-muted" : "text-subtle/70",
              )}
            >
              <span className="uppercase tracking-widest">
                {row.label}
                {current ? " · earned" : ""}
              </span>
              <span>
                {got ? "✓" : "·"} {formatTime(row.at)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
