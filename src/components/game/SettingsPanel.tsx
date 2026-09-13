import type { ReactNode } from "react";
import { useGame } from "@/game/store";
import type { Quality, TrackAssist } from "@/game/settings";
import { cn } from "@/lib/utils";

const QUALITIES: { id: Quality; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

const ASSISTS: { id: TrackAssist; label: string; name: string }[] = [
  { id: "off", label: "Off", name: "Off" },
  { id: "low", label: "Low", name: "Low" },
  { id: "medium", label: "Med", name: "Medium" },
  { id: "high", label: "High", name: "High" },
];

export function SettingsPanel({
  onClose,
  touch,
  onUiClick,
  onMute,
}: {
  onClose: () => void;
  touch: boolean;
  onUiClick?: () => void;
  onMute?: (muted: boolean) => void;
}) {
  const s = useGame((st) => st.settings);
  const muted = useGame((st) => st.muted);
  const patch = useGame((st) => st.patchSettings);
  const setQuality = useGame((st) => st.setQuality);
  const reset = useGame((st) => st.resetSettings);
  const click = () => onUiClick?.();

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex justify-end bg-bg/70">
      <button
        type="button"
        className="absolute inset-0 hidden md:block"
        aria-label="Close settings"
        onClick={() => {
          click();
          onClose();
        }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className={cn(
          "settings-sheet relative flex h-full w-full flex-col border-border bg-surface shadow-[0_24px_80px_rgba(0,0,0,0.45)]",
          "md:max-w-md md:border-l",
        )}
      >
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-[max(1rem,env(safe-area-inset-top))] md:py-5">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted">Options</p>
            <h2 id="settings-title" className="font-display text-4xl leading-none tracking-tight">
              Settings
            </h2>
            <p className="mt-1 max-w-[16rem] text-xs text-subtle">Graphics, camera, and Track Assist. Your current preset stays put until you change it.</p>
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

        <div data-allow-scroll className="min-h-0 flex-1 overflow-auto overscroll-contain px-5 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <Section title="Graphics">
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-bg-elevated p-1">
              {QUALITIES.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => {
                    click();
                    setQuality(q.id);
                  }}
                  className={cn(
                    "h-12 rounded-md text-sm font-medium md:h-10",
                    s.quality === q.id ? "bg-accent text-accent-fg" : "text-muted",
                  )}
                >
                  {q.label}
                </button>
              ))}
            </div>
            <Toggle
              label="Shadows"
              on={s.shadows}
              onChange={(shadows) => {
                click();
                patch({ shadows });
              }}
            />
            <Toggle
              label="Bloom"
              on={s.bloom}
              onChange={(bloom) => {
                click();
                patch({ bloom });
              }}
            />
            <Toggle
              label="Motion blur"
              on={s.motionBlur}
              onChange={(motionBlur) => {
                click();
                patch({ motionBlur });
              }}
            />
            <Toggle
              label="Show FPS"
              on={s.showFps}
              onChange={(showFps) => {
                click();
                patch({ showFps });
              }}
            />
          </Section>

          <Section title="Audio">
            <Toggle
              label="Mute"
              hint="Also available from the Sound button on the menu and HUD"
              on={muted}
              onChange={(next) => {
                onMute?.(next);
                if (!next) click();
              }}
            />
            <Slider label="Master" value={s.master} onChange={(master) => patch({ master })} />
            <Slider label="SFX" value={s.sfx} onChange={(sfx) => patch({ sfx })} />
            <Slider label="Music" value={s.music} onChange={(music) => patch({ music })} />
          </Section>

          <Section title="Camera">
            <Slider
              label="Chase distance"
              value={(s.chaseDistance - 0.7) / 0.75}
              display={`${s.chaseDistance.toFixed(2)}×`}
              onChange={(v) => patch({ chaseDistance: 0.7 + v * 0.75 })}
            />
            <Slider
              label="Field of view"
              value={(s.fov - 50) / 28}
              display={`${Math.round(s.fov)}°`}
              onChange={(v) => patch({ fov: 50 + v * 28 })}
            />
            <Slider label="Camera shake" value={s.cameraShake / 1.5} onChange={(v) => patch({ cameraShake: v * 1.5 })} />
          </Section>

          <Section title="Controls">
            <Slider
              label="Touch steer"
              value={(s.touchSteerSensitivity - 0.45) / 1.55}
              display={`${s.touchSteerSensitivity.toFixed(2)}×`}
              onChange={(v) => patch({ touchSteerSensitivity: 0.45 + v * 1.55 })}
            />
            <div className="rounded-lg border border-border bg-bg-elevated px-3.5 py-2">
              <p className="text-sm font-medium text-fg">Track Assist</p>
              <p className="mt-0.5 text-xs text-subtle">How strongly the car sticks to the racing line on touch.</p>
              <div className="mt-2 grid grid-cols-4 gap-1 rounded-lg bg-bg p-1">
                {ASSISTS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    aria-label={a.name}
                    aria-pressed={s.trackAssist === a.id}
                    onClick={() => {
                      click();
                      patch({ trackAssist: a.id });
                    }}
                    className={cn(
                      "h-12 rounded-md text-sm font-medium md:h-10",
                      s.trackAssist === a.id ? "bg-accent text-accent-fg" : "text-muted",
                    )}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
            <Toggle
              label="Auto-throttle"
              hint={touch ? "Default on for touch" : "Fills throttle when you are not braking"}
              on={s.autoThrottle}
              onChange={(autoThrottle) => {
                click();
                patch({ autoThrottle });
              }}
            />
            <Toggle
              label="Invert steer"
              on={s.invertSteer}
              onChange={(invertSteer) => {
                click();
                patch({ invertSteer });
              }}
            />
            <div className="rounded-lg border border-border bg-bg-elevated px-3.5 py-2.5 text-xs leading-relaxed text-muted">
              <p className="text-sm font-medium text-fg">Gamepad</p>
              <p className="mt-1">Steer · left stick / D-pad</p>
              <p>Accel · RT / A &nbsp; Brake · LT / B</p>
              <p>Slide · LB / X &nbsp; Respawn · Y</p>
              <p>Camera · View / RB &nbsp; Pause · Menu</p>
              <p className="mt-1.5 text-subtle">Keyboard and touch stay live. Track Assist is unchanged.</p>
            </div>
          </Section>

          <Section title="HUD">
            <Toggle
              label="Speed"
              on={s.showSpeed}
              onChange={(showSpeed) => {
                click();
                patch({ showSpeed });
              }}
            />
            <Toggle
              label="Minimap"
              on={s.showMinimap}
              onChange={(showMinimap) => {
                click();
                patch({ showMinimap });
              }}
            />
            <Slider label="Ghost opacity" value={s.ghostOpacity} onChange={(ghostOpacity) => patch({ ghostOpacity })} />
          </Section>

          <button
            type="button"
            onClick={() => {
              click();
              reset(touch);
            }}
            className="mt-2 h-12 w-full rounded-md border border-border bg-bg-elevated text-sm text-muted md:h-11"
          >
            Reset defaults
          </button>
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-7">
      <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-muted">{title}</h3>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Toggle({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint?: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-border bg-bg-elevated px-3.5 py-2 text-left"
    >
      <span>
        <span className="block text-sm font-medium text-fg">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-subtle">{hint}</span> : null}
      </span>
      <span
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors",
          on ? "bg-accent" : "bg-border",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-6 rounded-full bg-fg transition-transform",
            on ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

function Slider({
  label,
  value,
  display,
  onChange,
}: {
  label: string;
  value: number;
  display?: string;
  onChange: (v: number) => void;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <label className="block rounded-lg border border-border bg-bg-elevated px-3.5 py-2">
      <span className="flex items-center justify-between text-sm">
        <span className="font-medium text-fg">{label}</span>
        <span className="tabular-nums text-muted">{display ?? `${pct}%`}</span>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={Math.max(0, Math.min(1, value))}
        onChange={(e) => onChange(Number(e.target.value))}
        className="settings-range mt-1 w-full"
        aria-label={label}
      />
    </label>
  );
}
