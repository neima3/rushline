import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Medal } from "@/game/types";

export function keepPlayFocus(e: { preventDefault: () => void }) {
  e.preventDefault();
}

export function MedalRow({ medal, compact, pace }: { medal: Medal | null; compact?: boolean; pace?: boolean }) {
  const items: { id: Medal; ring: string; fill: string; label: string }[] = [
    { id: "bronze", ring: "border-medal-bronze", fill: "bg-medal-bronze", label: "B" },
    { id: "silver", ring: "border-medal-silver", fill: "bg-medal-silver", label: "S" },
    { id: "gold", ring: "border-medal-gold", fill: "bg-medal-gold", label: "G" },
    { id: "author", ring: "border-fg", fill: "bg-fg", label: "A" },
  ];
  const order: Medal[] = ["bronze", "silver", "gold", "author"];
  const reached = medal ? order.indexOf(medal) : -1;
  return (
    <span className={cn("flex items-center gap-1.5", compact ? "" : "justify-center")}>
      {items.map((m, i) => {
        const current = pace && i === reached;
        const filled = pace ? i === reached : i <= reached;
        const available = pace && i < reached;
        return (
          <span
            key={m.id}
            className={cn(
              "hud-medal inline-flex items-center justify-center rounded-full border",
              m.ring,
              filled ? m.fill : available ? "bg-transparent opacity-80" : "bg-transparent opacity-35",
              current && "hud-medal-now",
              compact ? "size-3" : "size-4",
            )}
            title={m.label}
            aria-label={m.label}
          />
        );
      })}
    </span>
  );
}

export function Modal({
  title,
  subtitle,
  extra,
  actions,
  chrome,
}: {
  title: string;
  subtitle?: string;
  extra?: ReactNode;
  chrome?: boolean;
  actions: { label: string; onClick: () => void; primary?: boolean }[];
}) {
  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-bg/70 px-4">
      <div
        className={cn(
          "overlay-enter w-full max-w-sm p-6",
          chrome
            ? "hud-chrome hud-pause-card"
            : "rounded-xl border border-border bg-surface shadow-[0_24px_80px_rgba(0,0,0,0.45)]",
        )}
      >
        {subtitle ? <p className="text-xs uppercase tracking-[0.18em] text-muted">{subtitle}</p> : null}
        <h2 className={cn("font-display leading-none tracking-tight", chrome ? "text-3xl uppercase" : "text-4xl")}>
          {title}
        </h2>
        {extra}
        <div className="mt-6 flex flex-col gap-2">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onMouseDown={keepPlayFocus}
              onClick={a.onClick}
              className={cn(
                "h-11 rounded-md text-sm font-medium transition-[transform,filter] duration-150 ease-out enabled:active:scale-[0.98]",
                a.primary ? "bg-accent text-accent-fg" : "border border-border bg-bg-elevated text-fg",
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
