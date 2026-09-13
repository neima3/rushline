import { useEffect, type ReactNode, type RefObject } from "react";
import { Flag, Gamepad2, Gauge, Pause, Settings, Volume2, VolumeX } from "lucide-react";
import type { Game } from "@/game/Game";
import { padRaceHint } from "@/game/gamepad";
import { formatPaceRemain, medalPaceLabel } from "@/game/feel";
import { allTrackDefs, getTrack, medalFor, medalPace, sampleAt, TRACK_DEFS } from "@/game/track";
import { useGame } from "@/game/store";
import type { Medal, ResultsState, TrackId } from "@/game/types";
import { cn, formatDelta, formatSpeed, formatTime, formatTimeParts } from "@/lib/utils";
import { SettingsPanel } from "./SettingsPanel";
import { Minimap } from "./Minimap";

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
  const lastTimes = useGame((s) => s.lastTimes);
  const recents = useGame((s) => s.recents);
  const padBanner = useGame((s) => s.padBanner);
  const ready = useGame((s) => s.ready);
  const auto = useGame((s) => s.autoThrottle);
  const pad = useGame((s) => s.pad);
  const settingsOpen = useGame((s) => s.settingsOpen);
  const setSettingsOpen = useGame((s) => s.setSettingsOpen);
  const settings = useGame((s) => s.settings);
  const fps = useGame((s) => s.fps);
  const touch = useGame((s) => s.touch);
  const trackId = useGame((s) => s.trackId);
  const g = () => gameRef.current;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 text-fg">
      {phase === "menu" || phase === "select" ? (
        <button
          type="button"
          className="pointer-events-auto play-control absolute top-[max(0.75rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))] z-20 flex size-11 items-center justify-center rounded-md border border-border bg-surface/90 text-fg"
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
        >
          <Settings className="size-4" strokeWidth={1.75} />
        </button>
      ) : null}

      {phase === "menu" || phase === "select" ? (
        <Menu
          ready={ready}
          best={best}
          muted={muted}
          auto={auto}
          pad={pad}
          lastTimes={lastTimes}
          recents={recents}
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
          medalRemain={hud.medalRemain}
          ghostDelta={hud.ghostDelta}
          ghostLead={hud.ghostLead}
          ghostS={hud.ghostS}
          ghostN={hud.ghostN}
          cpFlash={hud.cpFlash}
          wrongWay={hud.wrongWay}
          countdown={phase === "countdown" ? hud.countdown : null}
          boost={hud.boost}
          driftCharge={hud.driftCharge}
          trackId={trackId}
          s={hud.s}
          n={hud.n}
          showSpeed={settings.showSpeed}
          showMinimap={settings.showMinimap}
        />
      ) : null}

      {phase === "race" || phase === "countdown" ? (
        <div className="pointer-events-auto absolute top-[max(0.75rem,env(safe-area-inset-top))] left-[max(0.75rem,env(safe-area-inset-left))] right-[max(0.75rem,env(safe-area-inset-right))] flex items-start justify-between">
          <button
            type="button"
            className="play-control hud-chip flex size-11 items-center justify-center rounded-md text-fg"
            onMouseDown={keepPlayFocus}
            onClick={() => g()?.pause()}
            aria-label="Pause"
          >
            <Pause className="size-4" strokeWidth={1.75} />
          </button>
          <div className="flex items-center gap-2">
            {pad.connected ? <PadChip xbox={pad.xbox} /> : null}
            <GhostChip
              label={camera === "hood" ? "Hood" : "Chase"}
              camera={camera}
              onClick={() => g()?.setCamera(camera === "chase" ? "hood" : "chase")}
              className="hud-chip"
            />
            <button
              type="button"
              className="play-control hud-chip flex size-11 items-center justify-center rounded-md"
              onMouseDown={keepPlayFocus}
              onClick={() => g()?.setMuted(!muted)}
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
          </div>
        </div>
      ) : null}

      {phase === "paused" && !settingsOpen ? (
        <Modal
          title="Paused"
          chrome
          actions={[
            { label: "Resume", primary: true, onClick: () => g()?.resume() },
            { label: "Options", onClick: () => setSettingsOpen(true) },
            { label: "Restart", onClick: () => g()?.startRace() },
            { label: "Quit", onClick: () => g()?.menu() },
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
              <MedalBoard trackId={results.trackId} time={results.time} earned={results.medal} />
              <TimesBoard results={results} />
            </div>
          }
          actions={[
            { label: "Retry", primary: true, onClick: () => g()?.startRace(results.trackId) },
            ...(results.isPb
              ? []
              : [{ label: "Retry vs last run", onClick: () => g()?.startRace(results.trackId, "last") }]),
            { label: "Tracks", onClick: () => g()?.setPhase("select") },
            { label: "Menu", onClick: () => g()?.menu() },
          ]}
        />
      ) : null}

      {settings.showFps && (phase === "race" || phase === "countdown" || phase === "paused") ? (
        <p className="absolute top-[max(0.95rem,env(safe-area-inset-top))] left-[max(3.6rem,calc(env(safe-area-inset-left)+2.85rem))] text-xs tabular-nums text-muted">
          {fps} fps
        </p>
      ) : null}

      {settings.showMinimap && (phase === "race" || phase === "countdown" || phase === "paused") ? (
        <div className="absolute bottom-[max(2.6rem,env(safe-area-inset-bottom))] left-[max(0.85rem,env(safe-area-inset-left))] hidden md:block">
          <Minimap
            trackId={trackId}
            s={hud.s}
            n={hud.n}
            heading={hud.heading}
            ghostS={hud.ghostS}
            ghostN={hud.ghostN}
          />
        </div>
      ) : null}

      {settingsOpen ? <SettingsPanel touch={touch} onClose={() => setSettingsOpen(false)} /> : null}

      {phase === "race" ? (
        <p className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 hidden -translate-x-1/2 text-xs text-muted md:block">
          {pad.connected
            ? padRaceHint(pad.xbox)
            : "WASD steer and throttle · Space slide · R respawn · C camera · Esc pause"}
        </p>
      ) : null}

      {padBanner ? <PadBanner text={padBanner} /> : null}
    </div>
  );
}

function PadChip({ xbox }: { xbox: boolean }) {
  return (
    <span className="hud-chip inline-flex h-11 items-center gap-2 rounded-md px-3 text-xs font-medium uppercase tracking-widest text-muted">
      <Gamepad2 className="size-4 text-fg" />
      {xbox ? "Xbox" : "Pad"}
    </span>
  );
}

function PadBanner({ text }: { text: string }) {
  useEffect(() => {
    const id = window.setTimeout(() => useGame.getState().setPadBanner(null), 4200);
    return () => window.clearTimeout(id);
  }, [text]);
  return (
    <div className="pointer-events-none absolute bottom-[max(3.4rem,calc(env(safe-area-inset-bottom)+2.4rem))] left-1/2 z-30 w-[min(36rem,calc(100%-1.5rem))] -translate-x-1/2">
      <p role="status" data-pad-banner className="pad-banner hud-chip px-3.5 py-2 text-center text-[11px] leading-snug text-fg">
        <Gamepad2 className="mr-1.5 inline-block size-3.5 align-[-0.15em]" />
        {text}
      </p>
    </div>
  );
}

function Menu({
  ready,
  best,
  lastTimes,
  recents,
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
  lastTimes: Partial<Record<TrackId, number>>;
  recents: Partial<Record<TrackId, number[]>>;
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
      <div
        data-allow-scroll
        className="flex max-h-full w-full max-w-lg flex-col gap-6 overflow-auto overscroll-contain px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(4rem,calc(env(safe-area-inset-top)+2.5rem))] md:ml-10 md:px-0"
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted">Time trial</p>
          <h1 className="font-display text-6xl leading-none tracking-tight md:text-7xl">RUSHLINE</h1>
          <p className="mt-3 max-w-sm text-pretty text-muted">
            A precision 3D circuit racer. Hit every checkpoint, keep the car on the plastic, beat the medals.
          </p>
          <p className="mt-2 flex items-center gap-2 text-xs text-subtle">
            <Gamepad2 className="size-3.5" />
            {pad.connected
              ? `${pad.xbox ? "Xbox controller" : "Controller"} connected — A to start · ${padRaceHint(pad.xbox)}`
              : "Plug in a pad — RT accel, LT brake, Y respawn, RB camera"}
          </p>
        </div>

        {!select ? (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={!ready}
              onMouseDown={keepPlayFocus}
              onClick={onStart}
              className="h-12 rounded-lg bg-accent px-5 text-sm font-medium text-accent-fg transition-[transform,filter] duration-150 ease-out enabled:hover:brightness-95 enabled:active:scale-[0.98] disabled:opacity-50"
            >
              {ready ? "Start" : "Loading…"}
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
            {allTrackDefs().map((t) => {
              const last = lastTimes[t.id];
              return (
              <button
                key={t.id}
                type="button"
                onMouseDown={keepPlayFocus}
                onClick={() => onRace(t.id)}
                data-track={t.id}
                className="track-card flex overflow-hidden rounded-xl border border-border bg-surface text-left"
              >
                <span className="track-card-thumb relative h-24 w-28 shrink-0 overflow-hidden">
                  <img src={t.thumb} alt="" className="size-full object-cover" crossOrigin="anonymous" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col justify-center px-4 py-3">
                  <span className="font-display text-2xl leading-none tracking-tight">{t.name}</span>
                  <span className="mt-1 text-xs text-muted">{t.blurb}</span>
                  <span className="mt-2 flex flex-col gap-1 text-xs tabular-nums text-subtle">
                    <span className="flex items-center gap-2">
                      <MedalRow medal={medalFor(t.id, best[t.id] ?? Number.POSITIVE_INFINITY)} />
                      Best {formatTime(best[t.id] ?? -1)}
                      {last != null && last !== best[t.id] ? ` · Last ${formatTime(last)}` : ""}
                    </span>
                    <TrackMedalTimes trackId={t.id} recents={recents[t.id]} />
                  </span>
                </span>
              </button>
              );
            })}
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
  medalRemain,
  ghostDelta,
  ghostLead,
  ghostS,
  ghostN,
  cpFlash,
  wrongWay,
  countdown,
  boost,
  driftCharge,
  trackId,
  s,
  n,
  showSpeed,
  showMinimap,
}: {
  time: number;
  speed: number;
  cp: number;
  cpTotal: number;
  lap: number;
  laps: number;
  medal: Medal | null;
  medalRemain: number | null;
  ghostDelta: number | null;
  ghostLead: "ahead" | "behind" | "even" | null;
  ghostS: number | null;
  ghostN: number | null;
  cpFlash: { kind: "cp" | "lap" | "finish"; delta: number | null; label: string } | null;
  wrongWay: boolean;
  countdown: number | null;
  boost: number;
  driftCharge: number;
  trackId: TrackId;
  s: number;
  n: number;
  showSpeed: boolean;
  showMinimap: boolean;
}) {
  const clock = formatTimeParts(time);
  return (
    <>
      {showMinimap ? <MiniMap trackId={trackId} s={s} n={n} ghostS={ghostS} ghostN={ghostN} /> : null}
      <div className="absolute top-[max(3.25rem,calc(env(safe-area-inset-top)+2.55rem))] left-1/2 flex -translate-x-1/2 flex-col items-center px-16">
        <div className="hud-chrome hud-timer-plate flex flex-col items-center">
          <p className="hud-timer text-[2rem] leading-none sm:text-5xl md:text-6xl">{clock.main}</p>
          <p className="hud-timer-frac">{clock.frac}</p>
          {ghostDelta != null ? (
            <p
              className={cn(
                "hud-ghost-delta mt-1 font-semibold tabular-nums tracking-wide",
                ghostDelta > 20 ? "text-danger" : ghostDelta < -20 ? "text-ok" : "text-muted",
              )}
            >
              <span className="hud-ghost-tag">GHOST</span>
              {formatDelta(ghostDelta)}
            </p>
          ) : null}
          {ghostLead ? (
            <p
              className={cn(
                "hud-ghost-lead",
                ghostLead === "ahead" ? "text-ok" : ghostLead === "behind" ? "text-danger" : "text-muted",
              )}
            >
              {ghostLead === "ahead" ? "▲ AHEAD" : ghostLead === "behind" ? "▼ BEHIND" : "● EVEN"}
            </p>
          ) : null}
        </div>
        {cpFlash ? (
          <p
            key={`${cpFlash.kind}-${cpFlash.label}-${cpFlash.delta ?? "x"}`}
            className={cn(
              "hud-cp-toast",
              cpFlash.delta == null ? "text-fg" : cpFlash.delta > 12 ? "text-danger" : cpFlash.delta < -12 ? "text-ok" : "text-fg",
            )}
          >
            <span>{cpFlash.label}</span>
            {cpFlash.delta != null ? <span className="hud-cp-toast-delta">{formatDelta(cpFlash.delta)}</span> : null}
          </p>
        ) : null}
        {showSpeed ? (
          <div className="hud-chrome hud-speed-pill mt-2 inline-flex md:hidden">
            <span className="hud-speed text-[1.65rem] leading-none">{formatSpeed(speed)}</span>
            <span className="hud-speed-unit">KM/H</span>
          </div>
        ) : null}
        <div className="hud-pace mt-1.5 flex flex-col items-center gap-1">
          <span
            className={cn(
              "hud-pace-chip tabular-nums tracking-wide",
              medal ? "text-fg" : "text-subtle",
            )}
          >
            {medalPaceLabel(medal)}
            {medal && medalRemain != null ? ` ${formatPaceRemain(medalRemain)}` : ""}
          </span>
          <div className="hud-meta flex items-center gap-3 text-[11px] font-medium uppercase tracking-widest">
            <span className="flex items-center gap-1">
              <Flag className="size-3" />
              {lap}/{laps}
            </span>
            <span>
              CP {cp}/{cpTotal}
            </span>
            <span className="hidden sm:flex">
              <MedalRow medal={medal} compact pace />
            </span>
          </div>
        </div>
        <div className="mt-1 flex gap-3 md:hidden">
          <Meter label="Boost" value={Math.min(1, boost / 1.25)} tone="ok" show={boost > 0.05} />
          <Meter label="Turbo" value={driftCharge} tone="gold" show={driftCharge > 0.05} />
        </div>
      </div>
      <div className="absolute top-[max(3.75rem,calc(env(safe-area-inset-top)+3rem))] right-[max(1rem,env(safe-area-inset-right))] hidden text-right md:block">
        {showSpeed ? (
          <div className="hud-chrome hud-speed-pill ml-auto inline-flex">
            <span className="hud-speed text-4xl leading-none">{formatSpeed(speed)}</span>
            <span className="hud-speed-unit">KM/H</span>
          </div>
        ) : null}
        <Meter label="Boost" value={Math.min(1, boost / 1.0)} tone="ok" show={boost > 0.05} />
        <Meter label="Turbo" value={driftCharge} tone="gold" show={driftCharge > 0.05} ticks />
      </div>
      {wrongWay ? (
        <p className="hud-wrong-way absolute left-1/2 top-1/3 -translate-x-1/2 font-display text-3xl tracking-wide text-danger">
          Wrong way
        </p>
      ) : null}
      {countdown != null && countdown > 0 ? (
        <p className="hud-countdown absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-8xl leading-none">
          {countdown}
        </p>
      ) : countdown === 0 ? (
        <p className="hud-countdown hud-countdown-go absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-7xl leading-none">
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
  ticks,
}: {
  label: string;
  value: number;
  tone: "ok" | "gold";
  show: boolean;
  ticks?: boolean;
}) {
  if (!show) return null;
  const filled = Math.max(0, Math.min(1, value));
  return (
    <div className="hud-meter mt-2 w-20 md:ml-auto">
      <p className={cn("hud-meter-label text-[10px] uppercase tracking-widest", tone === "ok" ? "text-ok" : "text-medal-gold")}>
        {label}
      </p>
      <div className="hud-meter-track relative mt-1 h-1.5 overflow-hidden rounded-full">
        <div
          className={cn("hud-meter-fill h-full", tone === "ok" ? "hud-meter-fill-ok" : "hud-meter-fill-gold")}
          style={{ width: `${Math.round(filled * 100)}%` }}
        />
        {ticks
          ? [32, 58, 92].map((p) => (
              <span key={p} className="absolute top-0 h-full w-px bg-bg/70" style={{ left: `${p}%` }} />
            ))
          : null}
      </div>
    </div>
  );
}

function MedalRow({ medal, compact, pace }: { medal: Medal | null; compact?: boolean; pace?: boolean }) {
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

function TrackMedalTimes({ trackId, recents }: { trackId: TrackId; recents?: number[] }) {
  const medals = TRACK_DEFS[trackId].medals;
  return (
    <span className="flex flex-wrap gap-x-2 text-[10px] uppercase tracking-widest text-subtle">
      <span>A {formatTime(medals.author)}</span>
      <span>G {formatTime(medals.gold)}</span>
      <span>S {formatTime(medals.silver)}</span>
      <span>B {formatTime(medals.bronze)}</span>
      {recents && recents.length > 1 ? <span className="normal-case tracking-normal">· {recents.length} local times</span> : null}
    </span>
  );
}

function TimesBoard({ results }: { results: ResultsState }) {
  const ghostNote = results.isPb
    ? results.ghostSaved
      ? "PB ghost saved — it will race you next run"
      : "PB time saved — ghost did not persist"
    : results.ghostSource === "last"
      ? "Last run is your ghost (PB ghost missing or thin)"
      : results.ghostSource === "pb"
        ? "Racing your PB ghost · Retry vs last run to chase this lap"
        : "No ghost yet — this run is saved locally";
  return (
    <div className="space-y-2 text-sm">
      <p className="text-muted">
        Best {formatTime(results.best ?? results.time)}
        {results.lastTime != null && results.lastTime !== results.best ? ` · Last ${formatTime(results.lastTime)}` : ""}
      </p>
      <p className="text-xs leading-snug text-subtle">{ghostNote}</p>
      {results.recents.length > 0 ? (
        <ol className="space-y-0.5 text-xs tabular-nums text-subtle">
          {results.recents.map((t, i) => (
            <li key={`${t}-${i}`} className={t === results.time ? "text-fg" : undefined}>
              {i + 1}. {formatTime(t)}
              {t === results.best ? " · PB" : ""}
              {t === results.time ? " · now" : ""}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function MedalBoard({ trackId, time, earned }: { trackId: TrackId; time: number; earned: Medal | null }) {
  const medals = TRACK_DEFS[trackId].medals;
  const pace = medalPace(trackId, time);
  const rows: { id: Medal; label: string; at: number }[] = [
    { id: "author", label: "Author", at: medals.author },
    { id: "gold", label: "Gold", at: medals.gold },
    { id: "silver", label: "Silver", at: medals.silver },
    { id: "bronze", label: "Bronze", at: medals.bronze },
  ];
  return (
    <div className="space-y-2">
      <MedalRow medal={earned} />
      <ul className="space-y-1 text-sm">
        {rows.map((row) => {
          const got = !pace.lost.includes(row.id);
          return (
            <li
              key={row.id}
              className={cn(
                "flex items-center justify-between gap-3 tabular-nums",
                earned === row.id ? "text-fg" : got ? "text-muted" : "text-subtle/70",
              )}
            >
              <span className="uppercase tracking-widest">{row.label}</span>
              <span>
                {got ? "✓" : "·"} {formatTime(row.at)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Modal({
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
          "w-full max-w-sm p-6",
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

function keepPlayFocus(e: { preventDefault: () => void }) {
  e.preventDefault();
}

function MiniMap({
  trackId,
  s,
  n,
  ghostS,
  ghostN,
}: {
  trackId: TrackId;
  s: number;
  n: number;
  ghostS: number | null;
  ghostN: number | null;
}) {
  const track = getTrack(trackId);
  const step = Math.max(1, Math.floor(track.samples.length / 72));
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  const pts: { x: number; z: number }[] = [];
  for (let i = 0; i < track.samples.length; i += step) {
    const sm = track.samples[i]!;
    pts.push({ x: sm.x, z: sm.z });
    if (sm.x < minX) minX = sm.x;
    if (sm.x > maxX) maxX = sm.x;
    if (sm.z < minZ) minZ = sm.z;
    if (sm.z > maxZ) maxZ = sm.z;
  }
  const pad = 8;
  const size = 72;
  const span = Math.max(maxX - minX, maxZ - minZ, 1);
  const to = (x: number, z: number) => {
    const u = (x - (minX + maxX) * 0.5) / span;
    const v = (z - (minZ + maxZ) * 0.5) / span;
    return { x: size / 2 + u * (size - pad * 2), y: size / 2 + v * (size - pad * 2) };
  };
  const d = pts
    .map((p, i) => {
      const q = to(p.x, p.z);
      return `${i === 0 ? "M" : "L"}${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
    })
    .join(" ");
  const sm = sampleAt(track, s);
  const car = to(sm.x + sm.rx * n, sm.z + sm.rz * n);
  const ghost =
    ghostS != null && ghostN != null
      ? (() => {
          const g = sampleAt(track, ghostS);
          return to(g.x + g.rx * ghostN, g.z + g.rz * ghostN);
        })()
      : null;
  return (
    <div
      data-minimap="1"
      className="pointer-events-none absolute top-[max(4.55rem,calc(env(safe-area-inset-top)+3.7rem))] left-[max(0.7rem,env(safe-area-inset-left))] md:hidden"
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="hud-minimap-mobile rounded-md">
        <path d={d} fill="none" stroke="rgba(8,10,16,0.75)" strokeWidth="3.4" strokeLinejoin="round" />
        <path d={d} fill="none" stroke="rgba(244,244,242,0.78)" strokeWidth="1.8" strokeLinejoin="round" />
        {ghost ? <circle cx={ghost.x} cy={ghost.y} r="2.3" fill="#5ee8ff" stroke="#081018" strokeWidth="0.7" /> : null}
        <circle cx={car.x} cy={car.y} r="2.8" fill="#f4f4f2" stroke="#09090b" strokeWidth="0.8" />
      </svg>
    </div>
  );
}

function GhostChip({
  label,
  camera,
  onClick,
  className,
}: {
  label: string;
  camera: "chase" | "hood";
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      data-camera={camera}
      onMouseDown={keepPlayFocus}
      onClick={onClick}
      className={cn(
        "play-control h-11 rounded-md px-3 text-xs font-medium uppercase tracking-widest text-muted",
        className ?? "border border-border bg-bg/80",
      )}
    >
      {label}
    </button>
  );
}
