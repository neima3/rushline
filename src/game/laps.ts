import type { BuiltTrack, PlayMode, TrackDef, TrackId } from "./types.ts";

export const STOCK_LAP_CHOICES = [1, 2, 3] as const;
export type StockLapCount = (typeof STOCK_LAP_CHOICES)[number];
export type StockLapsSetting = StockLapCount | "track";

export type MedalTimes = TrackDef["medals"];

export function isStockLapsSetting(v: unknown): v is StockLapsSetting {
  return v === "track" || v === 1 || v === 2 || v === 3;
}

/** Custom and Rush Cup keep authored laps. Time trial / hotseat honor Settings. */
export function resolveRaceLaps(opts: {
  trackId: TrackId;
  authored: number;
  setting: StockLapsSetting;
  playMode: PlayMode;
}): number {
  const authored = Math.max(1, Math.round(opts.authored) || 1);
  if (opts.trackId === "custom" || opts.playMode === "cup") return authored;
  if (opts.setting === "track") return authored;
  return opts.setting;
}

export function scaleMedals(medals: MedalTimes, authoredLaps: number, raceLaps: number): MedalTimes {
  const from = Math.max(1, authoredLaps);
  const to = Math.max(1, raceLaps);
  if (from === to) return medals;
  const k = to / from;
  return {
    author: Math.round(medals.author * k),
    gold: Math.round(medals.gold * k),
    silver: Math.round(medals.silver * k),
    bronze: Math.round(medals.bronze * k),
  };
}

/** Clone a built track's def so the compiled cache stays at authored laps. */
export function withRaceLaps(track: BuiltTrack, laps: number): BuiltTrack {
  const authored = track.def.laps;
  if (authored === laps) return track;
  return {
    ...track,
    def: {
      ...track.def,
      laps,
      medals: scaleMedals(track.def.medals, authored, laps),
    },
  };
}
