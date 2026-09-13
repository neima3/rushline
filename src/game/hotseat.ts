import type { GhostFrame, Medal, TrackId } from "./types.ts";

export type HotseatSeat = 1 | 2;

export type HotseatRun = {
  seat: HotseatSeat;
  time: number;
  medal: Medal | null;
  validated: boolean;
  frames: GhostFrame[];
};

export type HotseatSession = {
  trackId: TrackId;
  seat: HotseatSeat;
  p1: HotseatRun | null;
  p2: HotseatRun | null;
};

export type HotseatWinner = 1 | 2 | "tie";

export type HotseatBoard = {
  trackId: TrackId;
  p1: HotseatRun;
  p2: HotseatRun;
  winner: HotseatWinner;
  delta: number;
};

export function emptyHotseat(trackId: TrackId): HotseatSession {
  return { trackId, seat: 1, p1: null, p2: null };
}

export function commitHotseatRun(session: HotseatSession, run: HotseatRun): HotseatSession {
  if (run.seat === 1) return { ...session, trackId: session.trackId, seat: 1, p1: run };
  return { ...session, trackId: session.trackId, seat: 2, p2: run };
}

export function armHotseatSeat(session: HotseatSession, seat: HotseatSeat): HotseatSession {
  if (seat === 1) return { ...session, seat: 1, p1: null };
  return { ...session, seat: 2, p2: null };
}

export function hotseatComplete(session: HotseatSession | null | undefined): boolean {
  return Boolean(session?.p1 && session?.p2);
}

export function hotseatWinner(p1: number, p2: number): HotseatWinner {
  if (!Number.isFinite(p1) || !Number.isFinite(p2)) return "tie";
  if (p1 < p2) return 1;
  if (p2 < p1) return 2;
  return "tie";
}

/** P2 − P1. Negative means P2 was faster. */
export function hotseatDelta(p1: number, p2: number): number {
  return p2 - p1;
}

export function hotseatHeadline(winner: HotseatWinner): string {
  if (winner === "tie") return "Dead heat";
  return winner === 1 ? "P1 wins" : "P2 wins";
}

/** P2 races P1's tape. P1 has no opponent ghost. */
export function hotseatGhost(session: HotseatSession | null | undefined): GhostFrame[] | null {
  if (!session || session.seat !== 2) return null;
  const frames = session.p1?.frames;
  return frames && frames.length >= 2 ? frames : null;
}

export function rematchHotseat(session: HotseatSession): HotseatSession {
  return emptyHotseat(session.trackId);
}

export function buildHotseatBoard(session: HotseatSession | null | undefined): HotseatBoard | null {
  if (!session?.p1 || !session.p2) return null;
  return {
    trackId: session.trackId,
    p1: session.p1,
    p2: session.p2,
    winner: hotseatWinner(session.p1.time, session.p2.time),
    delta: hotseatDelta(session.p1.time, session.p2.time),
  };
}

export function hotseatResultsView(session: HotseatSession | null | undefined) {
  const board = buildHotseatBoard(session);
  return {
    seat: session?.seat ?? 1,
    complete: board != null,
    p1: session?.p1 ? { time: session.p1.time, medal: session.p1.medal, validated: session.p1.validated } : null,
    p2: session?.p2 ? { time: session.p2.time, medal: session.p2.medal, validated: session.p2.validated } : null,
    winner: board?.winner ?? null,
    delta: board?.delta ?? null,
  };
}
