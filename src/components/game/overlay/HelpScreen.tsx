import type { ReactNode } from "react";
import {
  COPY,
  MENU_CONTROL_ROWS,
  PHOTO_CONTROL_ROWS,
  RACE_CONTROL_ROWS,
  type ControlRow,
} from "@/game/help";
import { cn } from "@/lib/utils";

type Props = {
  touch: boolean;
  padConnected: boolean;
  onClose: () => void;
  onUiClick?: () => void;
};

export function HelpScreen({ touch, padConnected, onClose, onUiClick }: Props) {
  const click = () => onUiClick?.();

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex justify-end bg-bg/70">
      <button
        type="button"
        className="absolute inset-0 hidden md:block"
        aria-label="Close help"
        onClick={() => {
          click();
          onClose();
        }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        data-overlay="help"
        className={cn(
          "settings-sheet relative flex h-full w-full flex-col border-border bg-surface shadow-[0_24px_80px_rgba(0,0,0,0.45)]",
          "md:max-w-md md:border-l",
        )}
      >
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-[max(1rem,env(safe-area-inset-top))] md:py-5">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted">{COPY.helpEyebrow}</p>
            <h2 id="help-title" className="font-display text-4xl leading-none tracking-tight">
              {COPY.helpTitle}
            </h2>
            <p className="mt-1 max-w-[18rem] text-xs text-subtle">{COPY.helpBlurb}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              click();
              onClose();
            }}
            className="h-12 min-w-20 rounded-md bg-accent px-4 text-sm font-medium text-accent-fg md:h-11"
          >
            Done
          </button>
        </header>

        <div
          data-allow-scroll
          className="min-h-0 flex-1 overflow-auto overscroll-contain px-5 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        >
          <Section title={COPY.driveTitle}>
            <BindTable rows={RACE_CONTROL_ROWS} />
            <p className="text-xs leading-relaxed text-subtle">{COPY.padNote}</p>
            {padConnected ? (
              <p className="text-xs text-muted">A controller is connected. Keyboard and touch stay live.</p>
            ) : null}
          </Section>

          <Section title={COPY.touchTitle}>
            <ul className="space-y-1.5 text-sm leading-relaxed text-muted">
              {COPY.touchItems.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {touch ? (
              <p className="text-xs text-subtle">This session is in touch layout — pads appear during a race.</p>
            ) : null}
          </Section>

          <Section title={COPY.photoTitle}>
            <BindTable rows={PHOTO_CONTROL_ROWS} />
            <ul className="space-y-1.5 text-sm leading-relaxed text-muted">
              {COPY.photoNotes.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </Section>

          <Section title={COPY.menuTitle}>
            <BindTable rows={MENU_CONTROL_ROWS} />
            <ul className="space-y-1.5 text-sm leading-relaxed text-muted">
              {COPY.playNotes.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </Section>
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-7">
      <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-muted">{title}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function BindTable({ rows }: { rows: ControlRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-bg-elevated">
      <div className="hidden grid-cols-[minmax(0,0.9fr)_minmax(0,1.15fr)_minmax(0,1.2fr)] gap-2 border-b border-border px-3.5 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-subtle sm:grid">
        <span>Action</span>
        <span>Keyboard</span>
        <span>Gamepad</span>
      </div>
      <ul>
        {rows.map((row, i) => (
          <li
            key={row.id}
            className={cn(
              "grid gap-1 px-3.5 py-2.5 text-sm sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.15fr)_minmax(0,1.2fr)] sm:items-baseline sm:gap-2",
              i > 0 && "border-t border-border/80",
            )}
          >
            <span className="font-medium text-fg">{row.action}</span>
            <span className="text-xs text-muted sm:text-sm">
              <span className="mr-1.5 uppercase tracking-widest text-subtle sm:hidden">Keys</span>
              {row.keys}
            </span>
            <span className="text-xs text-muted sm:text-sm">
              <span className="mr-1.5 uppercase tracking-widest text-subtle sm:hidden">Pad</span>
              {row.pad}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

