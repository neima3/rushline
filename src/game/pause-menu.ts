/** Pause overlay keyboard routing (pure — safe to unit test). */

export function isResumeKey(code: string, key: string): boolean {
  return code === "Enter" || code === "Space" || key === "Enter" || key === " ";
}

export function isPauseMenuButton(el: Element | null): el is HTMLButtonElement {
  if (!el || typeof el !== "object") return false;
  const label = (el as HTMLButtonElement).dataset?.pauseMenuBtn;
  return typeof label === "string" && label.length > 0;
}

export type PauseMenuKeyAction = "resume" | "activate-focused" | "ignore";

/**
 * Enter / Space on the pause card:
 * - Resume when the primary Resume control is focused, or focus is not on a menu button.
 * - Otherwise activate the focused menu button (Restart, Options, …).
 */
export function pauseMenuKeyAction(
  code: string,
  key: string,
  activeElement: Element | null,
  menuRoot: Element | null,
): PauseMenuKeyAction {
  if (!menuRoot) return "ignore";
  if (!isResumeKey(code, key)) return "ignore";

  if (!activeElement || !menuRoot.contains(activeElement)) {
    return "resume";
  }

  if (isPauseMenuButton(activeElement)) {
    if (activeElement.dataset.pauseMenuBtn === "Resume") return "resume";
    return "activate-focused";
  }

  return "resume";
}

/** Keys handled inside the pause menu should not go through game capture (Enter / Space). */
export function shouldBypassGameKeyCapture(code: string, target: EventTarget | null, menuRoot: HTMLElement | null): boolean {
  if (!menuRoot || !target || typeof target !== "object") return false;
  if (!menuRoot.contains(target as Node)) return false;
  return code === "Enter" || code === "Space";
}
