import type { ReactNode, RefObject } from "react";
import { Flag, Gamepad2, Gauge, Pause, Volume2, VolumeX } from "lucide-react";
import type { Game } from "@/game/Game";
import { allTrackDefs, TRACK_DEFS } from "@/game/track";
import { useGame } from "@/game/store";
import type { Medal, TrackId } from "@/game/types";
import { cn, formatSpeed, formatTime } from "@/lib/utils";

type Props = {
  gameRef: RefObject<Game | null>;
};

export function Overlay({ gameRef }: Props) {
  const phase = useGame((s) => s.phase);
  const hud = useGame((s) => s.hud);
  const results = useGame((s) => s.results);
  const muted = useGame((s) => s.muted);
  const camera = useGame((s) => s.camera);
  const best = useGame((s) => s.best);
  const ready = useGame((s) => s.ready);
  const auto = useGame((s) => s.autoThrottle);
  const pad = useGame((s) => s.pad);
  const g = () => gameRef.current;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 text-fg">
      {phase === "menu" || phase === "select" ? (
        <Menu
          ready={ready}
          best={best}
          muted={muted}
          auto={auto}
          pad={pad}
          onStart={() => g()?.startRace("circuit")}
          onTracks={() => g()?.setPhase("select")}
          onBack={() => g()?.menu()}
          onRace={(id) => g()?.startRace(id)}
          onMute={() => g()?.setMuted(!muted)}
          onAuto={() => g()?.setAutoThrottle(!auto)}
          select={phase === "select"}
        />
      ) : null}

      {phase === "countdown" || phase === "race" || phase === "paused" ? (
        <Hud
          time={hud.time}
          speed={hud.speed}
          cp={hud.cp}
          cpTotal={hud.cpTotal}
          lap={hud.lap}
          laps={hud.laps}
          medal={hud.medal}
          wrongWay={hud.wrongWay}
          countdown={phase === "countdown" ? hud.countdown : null}
          boost={hud.boost}
          driftCharge={hud.driftCharge}
        />
      ) : null}

      {phase === "race" || phase === "countdown" ? (
        <div className="pointer-events-auto absolute top-[max(0.75rem,env(safe-area-inset-top))] left-3 right-3 flex items-start justify-between">
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-md border border-border bg-surface/90 text-fg"
            onClick={() => g()?.pause()}
            aria-label="Pause"
          >
            <Pause className="size-4" strokeWidth={1.75} />
          </button>
          <div className="flex items-center gap-2">
            {pad.connected ? <PadChip xbox={pad.xbox} /> : null}
            <div className="hidden gap-2 md:flex">
              <GhostChip
                label={camera === "chase" ? "Chase" : "Hood"}
                onClick={() => g()?.setCamera(camera === "chase" ? "hood" : "chase")}
              />
              <button
                type="button"
                className="flex size-11 items-center justify-center rounded-md border border-border bg-surface/90"
                onClick={() => g()?.setMuted(!muted)}
                aria-label={muted ? "Unmute" : "Mute"}
              >
                {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {phase === "paused" ? (
        <Modal
          title="Paused"
          actions={[
            { label: "Resume", primary: true, onClick: () => g()?.resume() },
            { label: "Restart", onClick: () => g()?.startRace() },
            { label: "Menu", onClick: () => g()?.menu() },
          ]}
        />
      ) : null}

      {phase === "results" && results ? (
        <Modal
          title={results.isPb ? "Personal best" : "Finished"}
          subtitle={TRACK_DEFS[results.trackId].name}
          extra={
            <div className="mt-5 space-y-3">
              <p className="font-display text-5xl tabular-nums leading-none tracking-tight">{formatTime(results.time)}</p>
              <MedalRow medal={results.medal} />
              <p className="text-sm text-muted">Best {formatTime(results.best ?? results.time)}</p>
            </div>
          }
          actions={[
            { label: "Retry", primary: true, onClick: () => g()?.startRace(results.trackId) },
            { label: "Tracks", onClick: () => g()?.setPhase("select") },
            { label: "Menu", onClick: () => g()?.menu() },
          ]}
        />
      ) : null}

      {phase === "race" ? (
        <p className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 hidden -translate-x-1/2 text-xs text-muted md:block">
          {pad.active
            ? "LT/RT brake · L-stick steer · X slide · Y respawn · Menu pause"
            : "WASD steer and throttle · Space slide · R respawn · Esc pause"}
        </p>
      ) : null}
    </div>
  );
}

function PadChip({ xbox }: { xbox: boolean }) {
  return (
    <span className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-surface/90 px-3 text-xs font-medium uppercase tracking-widest text-muted">
      <Gamepad2 className="size-4 text-fg" />
      {xbox ? "Xbox" : "Pad"}
    </span>
  );
}

function Menu({
  ready,
  best,
  muted,
  auto,
  pad,
  onStart,
  onTracks,
  onBack,
  onRace,
  onMute,
  onAuto,
  select,
}: {
  ready: boolean;
  best: Partial<Record<TrackId, number>>;
  muted: boolean;
  auto: boolean;
  pad: { connected: boolean; xbox: boolean; active: boolean };
  onStart: () => void;
  onTracks: () => void;
  onBack: () => void;
  onRace: (id: TrackId) => void;
  onMute: () => void;
  onAuto: () => void;
  select: boolean;
}) {
  return (
    <div className="pointer-events-auto absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-bg via-bg/80 to-transparent md:justify-center">
      <div className="flex max-h-full w-full max-w-lg flex-col gap-6 overflow-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-16 md:ml-10 md:px-0">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted">Time trial</p>
          <h1 className="font-display text-6xl leading-none tracking-tight md:text-7xl">RUSHLINE</h1>
          <p className="mt-3 max-w-sm text-pretty text-muted">
            A precision 3D circuit racer. Hit every checkpoint, keep the car on the plastic, beat the medals.
          </p>
          <p className="mt-2 flex items-center gap-2 text-xs text-subtle">
            <Gamepad2 className="size-3.5" />
            {pad.connected
              ? `${pad.xbox ? "Xbox controller" : "Controller"} connected — A to start`
              : "Xbox controller supported — press any button"}
          </p>
        </div>

        {!select ? (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={!ready}
              onClick={onStart}
              className="h-12 rounded-lg bg-accent px-5 text-sm font-medium text-accent-fg transition-[transform,filter] duration-150 ease-out enabled:hover:brightness-95 enabled:active:scale-[0.98] disabled:opacity-50"
            >
              Start
            </button>
            <button
              type="button"
              onClick={onTracks}
              className="h-12 rounded-lg border border-border bg-surface px-5 text-sm font-medium text-fg"
            >
              Tracks
            </button>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={onMute}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-border bg-bg-elevated text-sm text-muted"
              >
                {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                {muted ? "Muted" : "Sound"}
              </button>
              <button
                type="button"
                onClick={onAuto}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-border bg-bg-elevated text-sm text-muted"
              >
                <Gauge className="size-4" />
                {auto ? "Auto accel" : "Manual accel"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {allTrackDefs().map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onRace(t.id)}
                className="flex overflow-hidden rounded-xl border border-border bg-surface text-left"
              >
                <img src={t.thumb} alt="" className="h-24 w-28 shrink-0 object-cover" crossOrigin="anonymous" />
                <span className="flex min-w-0 flex-1 flex-col justify-center px-4 py-3">
                  <span className="font-display text-2xl leading-none tracking-tight">{t.name}</span>
                  <span className="mt-1 text-xs text-muted">{t.blurb}</span>
                  <span className="mt-2 text-xs tabular-nums text-subtle">Best {formatTime(best[t.id] ?? -1)}</span>
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={onBack}
              className="h-11 rounded-md border border-border bg-bg-elevated text-sm text-muted"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Hud({
  time,
  speed,
  cp,
  cpTotal,
  lap,
  laps,
  medal,
  wrongWay,
  countdown,
  boost,
  driftCharge,
}: {
  time: number;
  speed: number;
  cp: number;
  cpTotal: number;
  lap: number;
  laps: number;
  medal: Medal | null;
  wrongWay: boolean;
  countdown: number | null;
  boost: number;
  driftCharge: number;
}) {
  return (
    <>
      <div className="absolute top-[max(3.75rem,calc(env(safe-area-inset-top)+3rem))] left-1/2 flex -translate-x-1/2 flex-col items-center">
        <p className="font-display text-5xl tabular-nums leading-none tracking-tight md:text-6xl">{formatTime(time)}</p>
        <div className="mt-2 flex items-center gap-3 text-xs font-medium uppercase tracking-widest text-muted">
          <span className="flex items-center gap-1">
            <Flag className="size-3" />
            {lap}/{laps}
          </span>
          <span>
            CP {cp}/{cpTotal}
          </span>
          <MedalRow medal={medal} compact />
        </div>
      </div>
      <div className="absolute top-[max(3.75rem,calc(env(safe-area-inset-top)+3rem))] right-4 text-right">
        <p className="font-display text-4xl tabular-nums leading-none">{formatSpeed(speed)}</p>
        <p className="text-[10px] uppercase tracking-widest text-muted">km/h</p>
        <Meter label="Boost" value={Math.min(1, boost / 1.25)} tone="ok" show={boost > 0.05} />
        <Meter label="Turbo" value={driftCharge} tone="gold" show={driftCharge > 0.05} />
      </div>
      {wrongWay ? (
        <p className="absolute left-1/2 top-1/3 -translate-x-1/2 font-display text-3xl tracking-wide text-danger">
          Wrong way
        </p>
      ) : null}
      {countdown != null && countdown > 0 ? (
        <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-8xl leading-none">
          {countdown}
        </p>
      ) : countdown === 0 ? (
        <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-7xl leading-none">
          GO
        </p>
      ) : null}
    </>
  );
}

function Meter({
  label,
  value,
  tone,
  show,
}: {
  label: string;
  value: number;
  tone: "ok" | "gold";
  show: boolean;
}) {
  if (!show) return null;
  return (
    <div className="mt-2 w-20 ml-auto">
      <p className={cn("text-[10px] uppercase tracking-widest", tone === "ok" ? "text-ok" : "text-medal-gold")}>
        {label}
      </p>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-border">
        <div
          className={cn("h-full", tone === "ok" ? "bg-ok" : "bg-medal-gold")}
          style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }}
        />
      </div>
    </div>
  );
}

function MedalRow({ medal, compact }: { medal: Medal | null; compact?: boolean }) {
  const items: { id: Medal; cls: string; label: string }[] = [
    { id: "bronze", cls: "bg-medal-bronze", label: "B" },
    { id: "silver", cls: "bg-medal-silver", label: "S" },
    { id: "gold", cls: "bg-medal-gold", label: "G" },
    { id: "author", cls: "bg-fg", label: "A" },
  ];
  const order: Medal[] = ["bronze", "silver", "gold", "author"];
  const reached = medal ? order.indexOf(medal) : -1;
  return (
    <span className={cn("flex items-center gap-1", compact ? "" : "justify-center")}>
      {items.map((m, i) => (
        <span
          key={m.id}
          className={cn(
            "inline-flex size-2 rounded-full",
            i <= reached ? m.cls : "bg-border",
            !compact && "size-2.5",
          )}
          title={m.label}
        />
      ))}
    </span>
  );
}

function Modal({
  title,
  subtitle,
  extra,
  actions,
}: {
  title: string;
  subtitle?: string;
  extra?: ReactNode;
  actions: { label: string; onClick: () => void; primary?: boolean }[];
}) {
  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-bg/70 px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        {subtitle ? <p className="text-xs uppercase tracking-[0.18em] text-muted">{subtitle}</p> : null}
        <h2 className="font-display text-4xl leading-none tracking-tight">{title}</h2>
        {extra}
        <div className="mt-6 flex flex-col gap-2">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              className={cn(
                "h-11 rounded-md text-sm font-medium",
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

function GhostChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-11 rounded-md border border-border bg-surface/90 px-3 text-xs font-medium uppercase tracking-widest text-muted"
    >
      {label}
    </button>
  );
}
