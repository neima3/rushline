import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emptyPauseMenuFreshKeys,
  isResumeKey,
  pauseMenuKeyAction,
  pauseMenuPanelKeyDown,
  pauseMenuPanelKeyUp,
  resumeCallsFromEscWhilePaused,
  shouldBlockStalePauseMenuKeyUp,
  shouldBypassGameKeyCapture,
  shouldCapturePlayFocusAfterPauseMenuAction,
} from "./pause-menu.ts";

function menuButton(label: string) {
  return { dataset: { pauseMenuBtn: label } } as unknown as HTMLButtonElement;
}

function menuRoot(...inside: Element[]) {
  const root = {
    contains(el: Element | null) {
      if (!el) return false;
      return inside.includes(el) || el === (root as unknown as Element);
    },
  };
  return root as unknown as HTMLElement;
}

describe("pauseMenuKeyAction", () => {
  it("treats Enter and Space as resume keys", () => {
    assert.equal(isResumeKey("Enter", "Enter"), true);
    assert.equal(isResumeKey("Space", " "), true);
    assert.equal(isResumeKey("KeyW", "w"), false);
  });

  it("resumes when focus is outside the menu", () => {
    const root = menuRoot();
    const outside = {} as Element;
    assert.equal(pauseMenuKeyAction("Enter", "Enter", outside, root), "resume");
  });

  it("resumes when Resume is focused", () => {
    const resume = menuButton("Resume");
    const root = menuRoot(resume);
    assert.equal(pauseMenuKeyAction("Enter", "Enter", resume, root), "resume");
    assert.equal(pauseMenuKeyAction("Space", " ", resume, root), "resume");
  });

  it("activates the focused non-resume button", () => {
    const restart = menuButton("Restart");
    const root = menuRoot(restart);
    assert.equal(pauseMenuKeyAction("Enter", "Enter", restart, root), "activate-focused");
  });

  it("resumes when focus is on the card but not a button", () => {
    const root = menuRoot();
    assert.equal(pauseMenuKeyAction("Enter", "Enter", root, root), "resume");
  });
});

describe("resumeCallsFromEscWhilePaused", () => {
  it("one Esc press resumes once when the hotkey consumes the pause edge", () => {
    const out = resumeCallsFromEscWhilePaused({ hotkeyResumed: true, pauseActionFromSample: false });
    assert.equal(out.resumeCalls, 1);
    assert.equal(out.phase, "race");
  });

  it("does not resume twice when hotkey and loop pause edge both fire", () => {
    const buggy = resumeCallsFromEscWhilePaused({ hotkeyResumed: true, pauseActionFromSample: true });
    assert.equal(buggy.resumeCalls, 1);
    assert.equal(buggy.phase, "race");
  });
});

describe("shouldCapturePlayFocusAfterPauseMenuAction", () => {
  it("returns focus to the play surface for driving actions but not sub-panels", () => {
    assert.equal(shouldCapturePlayFocusAfterPauseMenuAction("Restart"), true);
    assert.equal(shouldCapturePlayFocusAfterPauseMenuAction("Menu"), true);
    assert.equal(shouldCapturePlayFocusAfterPauseMenuAction("Options"), false);
    assert.equal(shouldCapturePlayFocusAfterPauseMenuAction("Help"), false);
  });
});

function panelResumeScenario(code: "Enter" | "Space", key: string) {
  const resume = menuButton("Resume");
  const root = menuRoot(resume);
  return { resume, root, code, key };
}

describe("pauseMenuPanelKeyDown (Enter and Space)", () => {
  for (const { code, key } of [
    { code: "Enter" as const, key: "Enter" },
    { code: "Space" as const, key: " " },
  ]) {
    it(`${code}: repeat keydown on focused Resume prevents default and does not resume`, () => {
      const { resume, root } = panelResumeScenario(code, key);
      const out = pauseMenuPanelKeyDown({
        code,
        key,
        repeat: true,
        activeElement: resume,
        menuRoot: root,
        freshBefore: emptyPauseMenuFreshKeys(),
      });
      assert.equal(out.preventDefault, true);
      assert.equal(out.resume, false);
      assert.equal(out.activateFocused, false);
    });

    it(`${code}: fresh press on focused Resume resumes`, () => {
      const { resume, root } = panelResumeScenario(code, key);
      const out = pauseMenuPanelKeyDown({
        code,
        key,
        repeat: false,
        activeElement: resume,
        menuRoot: root,
        freshBefore: emptyPauseMenuFreshKeys(),
      });
      assert.equal(out.preventDefault, true);
      assert.equal(out.resume, true);
    });

    it(`${code}: keyup without a fresh menu keydown blocks stale activation`, () => {
      assert.equal(shouldBlockStalePauseMenuKeyUp(code, key, emptyPauseMenuFreshKeys()), true);
      const up = pauseMenuPanelKeyUp(code, key, emptyPauseMenuFreshKeys());
      assert.equal(up.preventDefault, true);
    });

    it(`${code}: key held through pause then released does not resume via panel keyup`, () => {
      const fresh = emptyPauseMenuFreshKeys();
      const up = pauseMenuPanelKeyUp(code, key, fresh);
      assert.equal(up.preventDefault, true);
      assert.equal(up.freshKeys.enter, false);
      assert.equal(up.freshKeys.space, false);
    });
  }
});

describe("shouldBypassGameKeyCapture", () => {
  it("bypasses Enter and Space only for targets inside the menu root", () => {
    const restart = menuButton("Restart");
    const root = menuRoot(restart);
    assert.equal(shouldBypassGameKeyCapture("Enter", restart, root), true);
    assert.equal(shouldBypassGameKeyCapture("Space", restart, root), true);
    assert.equal(shouldBypassGameKeyCapture("KeyW", restart, root), false);
    assert.equal(shouldBypassGameKeyCapture("Enter", {} as EventTarget, root), false);
  });
});
