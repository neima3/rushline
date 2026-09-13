import { useState } from "react";
import { dismissControlsHint, loadHints } from "@/game/flow";
import { cn } from "@/lib/utils";

type Props = {
  touch: boolean;
  padActive: boolean;
  onDismiss?: () => void;
};

export function FirstRunHint({ touch, padActive, onDismiss }: Props) {
  const [hidden, setHidden] = useState(() => loadHints().controlsDismissed);
  if (hidden) return null;

  const dismiss = () => {
    dismissControlsHint();
    setHidden(true);
    onDismiss?.();
  };

  const body = touch
    ? "Steer on the left pad. Accel and brake on the right. Pause is top-left — Options opens settings."
    : padActive
      ? "LT/RT brake · L-stick steer · X slide · Menu pause · Options for settings."
      : "WASD steer and throttle · Space slide · R respawn · Esc pause · Options for graphics and Track Assist.";

  return (
    <div
      data-overlay="hint"
      className={cn(
        "pointer-events-none absolute left-1/2 z-20 w-[min(22rem,calc(100%-1.5rem))] -translate-x-1/2",
        touch
          ? "top-[max(7.6rem,calc(env(safe-area-inset-top)+6.4rem))]"
          : "bottom-[max(2.6rem,calc(env(safe-area-inset-bottom)+1.4rem))]",
      )}
    >
      <div className="hud-chrome overlay-enter first-run-card pointer-events-auto flex items-start gap-3 rounded-xl px-3.5 py-3">
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-fg/90">{body}</p>
        <button
          type="button"
          onClick={dismiss}
          className="h-9 shrink-0 rounded-md bg-accent px-3 text-xs font-semibold text-accent-fg"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
