/** Page Lifecycle helpers. Game already pauses the RAF on hide — this tightens the signal. */

export type PageLike = {
  hidden?: boolean;
  visibilityState?: string;
};

/** True when the tab is backgrounded, prerendered, or frozen. */
export function pageIsHidden(doc: PageLike | null | undefined): boolean {
  if (!doc) return false;
  if (doc.hidden) return true;
  const state = doc.visibilityState;
  return state === "hidden" || state === "prerender";
}

/** iOS Safari often fires pagehide before visibilitychange. Treat either as hide. */
export function shouldPauseForBackground(doc: PageLike | null | undefined, pagehide = false): boolean {
  return pagehide || pageIsHidden(doc);
}
