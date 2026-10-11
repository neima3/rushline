import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isResumeKey,
  pauseMenuKeyAction,
  shouldBypassGameKeyCapture,
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
