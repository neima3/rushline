import { useRef, useState } from "react";
import {
  clearImportedGhost,
  exportStoredGhost,
  ghostDecodeMessage,
  importGhostFromText,
  readShare,
} from "@/game/ghost-share";
import { COPY } from "@/game/help";
import { getTrackDef } from "@/game/track";
import { writeShareCache, useGame } from "@/game/store";
import type { TrackId } from "@/game/types";
import { formatTime } from "@/lib/utils";
import { keepPlayFocus } from "./chrome";

type Props = {
  trackId: TrackId;
  /** Results: export the run that just finished (same tape as last). */
  exportLastLabel?: string;
  allowImport?: boolean;
  allowRaceRival?: boolean;
  onRaceRival?: () => void;
  onUiClick?: () => void;
};

export function GhostShare({
  trackId,
  exportLastLabel = "Export last",
  allowImport = true,
  allowRaceRival = false,
  onRaceRival,
  onUiClick,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const imports = useGame((s) => s.imports);
  const best = useGame((s) => s.best);
  const lastTimes = useGame((s) => s.lastTimes);
  const refreshBest = useGame((s) => s.refreshBest);
  const rivalTime = imports[trackId];
  const hasPb = best[trackId] != null;
  const hasLast = lastTimes[trackId] != null;
  const trackName = getTrackDef(trackId).name;

  const click = () => onUiClick?.();

  const refresh = () => {
    writeShareCache(readShare());
    refreshBest();
  };

  const exportOne = (source: "pb" | "last") => {
    click();
    const ok = exportStoredGhost(trackId, source);
    setNote(ok ? `Saved ${source === "pb" ? "PB" : "last-run"} ghost for ${trackName}.` : "No ghost to export yet.");
  };

  const onPickFile = async (list: FileList | null) => {
    const file = list?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    click();
    setBusy(true);
    try {
      const text = await file.text();
      const result = importGhostFromText(text);
      if (!result.ok) {
        setNote(ghostDecodeMessage(result.error));
        return;
      }
      refresh();
      const name = getTrackDef(result.file.trackId).name;
      setNote(
        result.file.trackId === trackId
          ? `Rival loaded · ${formatTime(result.file.time)}`
          : `Rival loaded for ${name} · ${formatTime(result.file.time)}`,
      );
    } catch {
      setNote(ghostDecodeMessage("json"));
    } finally {
      setBusy(false);
    }
  };

  const clearRival = () => {
    click();
    clearImportedGhost(trackId);
    refresh();
    setNote("Rival cleared — next time trial uses your PB or last run.");
  };

  return (
    <div data-ghost-share={trackId} className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">{COPY.ghostTitle}</p>
      <p className="text-xs leading-snug text-subtle">{COPY.ghostBlurb}</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!hasLast}
          onMouseDown={keepPlayFocus}
          onClick={() => exportOne("last")}
          className="h-11 rounded-md border border-border bg-bg-elevated text-sm font-medium text-fg disabled:opacity-40"
        >
          {exportLastLabel}
        </button>
        <button
          type="button"
          disabled={!hasPb}
          onMouseDown={keepPlayFocus}
          onClick={() => exportOne("pb")}
          className="h-11 rounded-md border border-border bg-bg-elevated text-sm font-medium text-fg disabled:opacity-40"
        >
          Export PB
        </button>
        {allowImport ? (
          <button
            type="button"
            disabled={busy}
            onMouseDown={keepPlayFocus}
            onClick={() => {
              click();
              fileRef.current?.click();
            }}
            className="h-11 rounded-md border border-border bg-bg-elevated text-sm font-medium text-fg disabled:opacity-40"
          >
            Import rival
          </button>
        ) : null}
        {rivalTime != null ? (
          <button
            type="button"
            onMouseDown={keepPlayFocus}
            onClick={clearRival}
            className="h-11 rounded-md border border-border bg-bg-elevated text-sm font-medium text-muted"
          >
            Clear rival
          </button>
        ) : null}
      </div>
      {allowRaceRival && rivalTime != null && onRaceRival ? (
        <button
          type="button"
          onMouseDown={keepPlayFocus}
          onClick={() => {
            click();
            onRaceRival();
          }}
          className="h-11 w-full rounded-md border border-border bg-bg-elevated text-sm font-medium text-fg"
        >
          Race rival · {formatTime(rivalTime)}
        </button>
      ) : rivalTime != null ? (
        <p className="text-xs tabular-nums text-muted">
          Rival {formatTime(rivalTime)} — next time trial on {trackName} uses this ghost.
        </p>
      ) : null}
      {note ? <p className="text-xs leading-snug text-subtle">{note}</p> : null}
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-label="Import ghost file"
        onChange={(e) => {
          void onPickFile(e.target.files);
        }}
      />
    </div>
  );
}
