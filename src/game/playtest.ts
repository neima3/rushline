/** DEV-only breadcrumbs for browser QA scripts (Playwright / CDP touch). */

export type PlaytestMark = "restartRun" | "applyRespawn" | "respawnBlocked";

export function playtestMark(kind: PlaytestMark): void {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  const w = window as Window & { __rushlinePlaytest?: { marks: PlaytestMark[] } };
  w.__rushlinePlaytest ??= { marks: [] };
  w.__rushlinePlaytest.marks.push(kind);
}

export function playtestReset(): void {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  const w = window as Window & { __rushlinePlaytest?: { marks: PlaytestMark[] } };
  w.__rushlinePlaytest = { marks: [] };
}
