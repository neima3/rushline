import { hotseatHeadline } from "@/game/hotseat";
import { MEDAL_LABEL } from "@/game/flow";
import { getTrackDef } from "@/game/track";
import type { HotseatResults, Medal, TrackId } from "@/game/types";
import { validationLabel } from "@/game/validate";
import { cn, formatDelta, formatTime } from "@/lib/utils";
import { keepPlayFocus } from "./chrome";

export function HotseatScreen({
  trackId,
  board,
  onRematch,
  onRetryP2,
  onMenu,
  onPhoto,
}: {
  trackId: TrackId;
  board: HotseatResults;
  onRematch: () => void;
  onRetryP2: () => void;
  onMenu: () => void;
  onPhoto?: () => void;
}) {
  const track = getTrackDef(trackId);
  const winner = board.winner ?? "tie";
  const headline = hotseatHeadline(winner);
  const p1 = board.p1;
  const p2 = board.p2;

  return (
    <div
      data-overlay="hotseat"
      className="pointer-events-auto absolute inset-0 flex items-end justify-center bg-gradient-to-t from-bg via-bg/80 to-bg/35 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] md:items-center"
    >
      <div
        data-allow-scroll
        data-hotseat-board
        className="hud-chrome hud-pause-card overlay-enter results-card max-h-full w-full max-w-md overflow-y-auto overscroll-contain p-6"
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">Hotseat · {track.name}</p>
        <h2 className="font-display text-4xl leading-none tracking-tight md:text-5xl">{headline}</h2>
        {board.delta != null ? (
          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-subtle">
            {board.delta === 0 ? "Same time" : `P2 ${formatDelta(board.delta)} vs P1`}
          </p>
        ) : null}

        <ol className="mt-6 space-y-2">
          <SeatRow seat={1} time={p1?.time ?? 0} medal={p1?.medal ?? null} validated={p1?.validated ?? true} win={winner === 1} />
          <SeatRow seat={2} time={p2?.time ?? 0} medal={p2?.medal ?? null} validated={p2?.validated ?? true} win={winner === 2} />
        </ol>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onMouseDown={keepPlayFocus}
            onClick={onRematch}
            className="h-12 rounded-md bg-accent text-sm font-semibold text-accent-fg transition-[transform,filter] duration-150 ease-out enabled:hover:brightness-95 enabled:active:scale-[0.98]"
          >
            Rematch
          </button>
          <button
            type="button"
            onMouseDown={keepPlayFocus}
            onClick={onRetryP2}
            className="h-11 rounded-md border border-border bg-bg-elevated text-sm font-medium text-fg"
          >
            Retry P2
          </button>
          {onPhoto ? (
            <button
              type="button"
              onMouseDown={keepPlayFocus}
              onClick={onPhoto}
              className="h-11 rounded-md border border-border bg-bg-elevated text-sm font-medium text-fg"
            >
              Photo
            </button>
          ) : null}
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

function SeatRow({
  seat,
  time,
  medal,
  validated,
  win,
}: {
  seat: 1 | 2;
  time: number;
  medal: Medal | null;
  validated: boolean;
  win: boolean;
}) {
  return (
    <li
      data-hotseat-seat={seat}
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3",
        win ? "border-fg/40 bg-fg/10" : "border-border bg-bg/40",
      )}
    >
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
          P{seat}
          {win ? " · winner" : ""}
        </p>
        <p className="font-display text-3xl leading-none tracking-tight tabular-nums">{formatTime(time)}</p>
      </div>
      <div className="flex flex-col items-end gap-1 text-right">
        <span
          className={cn(
            "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em]",
            validated ? "border-ok/35 text-ok" : "border-border text-subtle",
          )}
        >
          {validationLabel(validated)}
        </span>
        <span className="text-[11px] uppercase tracking-widest text-subtle">{medal ? MEDAL_LABEL[medal] : "—"}</span>
      </div>
    </li>
  );
}
