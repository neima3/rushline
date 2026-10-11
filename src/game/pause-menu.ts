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

/** Models Game Esc: synchronous hotkey resume, then loop pause edge (keyboard Esc sets edge consumed). */
export function resumeCallsFromEscWhilePaused(input: {
  hotkeyResumed: boolean;
  pauseActionFromSample: boolean;
}): { phase: "paused" | "race"; resumeCalls: number } {
  let phase: "paused" | "race" = "paused";
  let resumeCalls = 0;
  const resume = () => {
    if (phase !== "paused") return;
    phase = "race";
    resumeCalls++;
  };
  if (input.hotkeyResumed) resume();
  if (input.pauseActionFromSample && phase === "paused") resume();
  return { phase, resumeCalls };
}

/** Pause menu actions that leave driving need canvas focus; sub-panels keep overlay focus. */
export function shouldCapturePlayFocusAfterPauseMenuAction(label: string): boolean {
  return label !== "Options" && label !== "Help";
}

export type PauseMenuFreshKeys = { enter: boolean; space: boolean };

export const emptyPauseMenuFreshKeys = (): PauseMenuFreshKeys => ({ enter: false, space: false });

/** OS auto-repeat Enter/Space must not resume or activate a focused menu button. */
export function pauseMenuPanelRepeatKeyDown(code: string, key: string, repeat: boolean): boolean {
  return repeat && isResumeKey(code, key);
}

export type PauseMenuPanelKeyDownResult = {
  preventDefault: boolean;
  resume: boolean;
  activateFocused: boolean;
  freshKeys: PauseMenuFreshKeys;
};

export function pauseMenuPanelKeyDown(input: {
  code: string;
  key: string;
  repeat: boolean;
  activeElement: Element | null;
  menuRoot: Element | null;
  freshBefore: PauseMenuFreshKeys;
}): PauseMenuPanelKeyDownResult {
  const freshKeys = { ...input.freshBefore };
  if (pauseMenuPanelRepeatKeyDown(input.code, input.key, input.repeat)) {
    return { preventDefault: true, resume: false, activateFocused: false, freshKeys };
  }
  if (!isResumeKey(input.code, input.key)) {
    return { preventDefault: false, resume: false, activateFocused: false, freshKeys };
  }
  if (!input.menuRoot) {
    return { preventDefault: false, resume: false, activateFocused: false, freshKeys };
  }
  if (input.code === "Enter" || input.key === "Enter") freshKeys.enter = true;
  if (input.code === "Space" || input.key === " ") freshKeys.space = true;

  const action = pauseMenuKeyAction(input.code, input.key, input.activeElement, input.menuRoot);
  if (action === "ignore") {
    return { preventDefault: false, resume: false, activateFocused: false, freshKeys };
  }
  if (action === "resume") {
    return { preventDefault: true, resume: true, activateFocused: false, freshKeys };
  }
  return { preventDefault: true, resume: false, activateFocused: true, freshKeys };
}

/** Block native Space keyup / stale Enter activation on focused menu buttons. */
export function pauseMenuPanelKeyUp(code: string, key: string, freshBefore: PauseMenuFreshKeys): {
  preventDefault: boolean;
  freshKeys: PauseMenuFreshKeys;
} {
  const freshKeys = { ...freshBefore };
  if (!isResumeKey(code, key)) {
    return { preventDefault: false, freshKeys };
  }
  if (code === "Enter" || key === "Enter") freshKeys.enter = false;
  if (code === "Space" || key === " ") freshKeys.space = false;
  return { preventDefault: true, freshKeys };
}

/** True when a stale (pre-menu) release must not synthesize a button click. */
export function shouldBlockStalePauseMenuKeyUp(code: string, key: string, fresh: PauseMenuFreshKeys): boolean {
  if (code === "Space" || key === " ") return !fresh.space;
  if (code === "Enter" || key === "Enter") return !fresh.enter;
  return false;
}
