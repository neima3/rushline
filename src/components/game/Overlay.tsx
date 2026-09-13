import { useEffect, useState } from "react";
import type { RefObject } from "react";
import { Flag, Gamepad2, Pause, Settings, Volume2, VolumeX } from "lucide-react";
import type { Game } from "@/game/Game";
import { loadHints } from "@/game/flow";
import { padRaceHint } from "@/game/gamepad";
import { formatPaceRemain, medalPaceLabel } from "@/game/feel";
import { getTrack, sampleAt, TRACK_DEFS } from "@/game/track";
import { useGame } from "@/game/store";
import type { Medal, TrackId } from "@/game/types";
import { cn, formatDelta, formatSpeed, formatTimeParts } from "@/lib/utils";
import { SettingsPanel } from "./SettingsPanel";
import { Minimap } from "./Minimap";
import { FirstRunHint } from "./overlay/FirstRunHint";
import { MenuScreen } from "./overlay/MenuScreen";
import { ResultsScreen } from "./overlay/ResultsScreen";
import { keepPlayFocus, MedalRow, Modal } from "./overlay/chrome";

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
  const [hintGone, setHintGone] = useState(() => loadHints().controlsDismissed);
  const g = () => gameRef.current;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 text-fg">
      {phase === "menu" || phase === "select" ? (
        <button
          type="button"
          className="pointer-events-auto play-control absolute top-[max(0.75rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))] z-20 flex h-11 items-center gap-2 rounded-md border border-border bg-surface/90 px-3 text-fg"
          onClick={() => {
            g()?.uiClick();
            setSettingsOpen(true);
          }}
          aria-label="Settings"
        >
          <Settings className="size-4" strokeWidth={1.75} />
          <span className="text-xs font-medium uppercase tracking-widest text-muted">Settings</span>
        </button>
      ) : null}

      {phase === "menu" || phase === "select" ? (
        <MenuScreen
          ready={ready}
          best={best}
          muted={muted}
          auto={auto}
          pad={pad}
          lastTimes={lastTimes}
          recents={recents}
          onStart={() => {
            g()?.uiClick();
            g()?.startRace(trackId);
          }}
          onTracks={() => {
            g()?.uiClick();
            g()?.setPhase("select");
          }}
          onBack={() => {
            g()?.uiClick();
            g()?.menu();
          }}
          onRace={(id) => {
            g()?.uiClick();
            g()?.startRace(id);
          }}
          onMute={() => {
            const next = !muted;
            g()?.setMuted(next);
            if (!next) g()?.uiClick();
          }}
          onAuto={() => {
            g()?.uiClick();
            g()?.setAutoThrottle(!auto);
          }}
          onSettings={() => {
            g()?.uiClick();
            setSettingsOpen(true);
          }}
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
            className="play-control hud-chip flex h-11 items-center gap-2 rounded-md px-3 text-fg"
            onMouseDown={keepPlayFocus}
            onClick={() => {
              g()?.uiClick();
              g()?.pause();
            }}
            aria-label="Pause"
          >
            <Pause className="size-4" strokeWidth={1.75} />
            <span className="hidden text-xs font-medium uppercase tracking-widest text-muted sm:inline">Pause</span>
          </button>
          <div className="flex items-center gap-2">
            {pad.connected ? <PadChip xbox={pad.xbox} /> : null}
            <GhostChip
              label={camera === "hood" ? "Hood" : "Chase"}
              camera={camera}
              onClick={() => {
                g()?.uiClick();
                g()?.setCamera(camera === "chase" ? "hood" : "chase");
              }}
              className="hud-chip"
            />
            <button
              type="button"
              className="play-control hud-chip flex size-11 items-center justify-center rounded-md"
              onMouseDown={keepPlayFocus}
              onClick={() => {
                const next = !muted;
                g()?.setMuted(next);
                if (!next) g()?.uiClick();
              }}
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
          subtitle={TRACK_DEFS[trackId].name}
          chrome
          extra={
            <p className="mt-3 text-xs leading-relaxed text-muted">
              {touch
                ? "Options opens graphics, camera, and Track Assist. Resume keeps your run."
                : "Esc resumes. Options opens graphics, camera, and Track Assist."}
            </p>
          }
          actions={[
            {
              label: "Resume",
              primary: true,
              onClick: () => {
                g()?.uiClick();
                g()?.resume();
              },
            },
            {
              label: "Options",
              onClick: () => {
                g()?.uiClick();
                setSettingsOpen(true);
              },
            },
            {
              label: "Restart",
              onClick: () => {
                g()?.uiClick();
                g()?.startRace();
              },
            },
            {
              label: "Menu",
              onClick: () => {
                g()?.uiClick();
                g()?.menu();
              },
            },
          ]}
        />
      ) : null}

      {phase === "results" && results ? (
        <ResultsScreen
          results={results}
          nextName={TRACK_DEFS[results.nextTrackId].name}
          onRetry={() => {
            g()?.uiClick();
            g()?.startRace(results.trackId);
          }}
          onRetryLast={
            results.isPb
              ? undefined
              : () => {
                  g()?.uiClick();
                  g()?.startRace(results.trackId, "last");
                }
          }
          onNext={() => {
            g()?.uiClick();
            g()?.startRace(results.nextTrackId);
          }}
          onMenu={() => {
            g()?.uiClick();
            g()?.menu();
          }}
        />
      ) : null}

      {settings.showFps && (phase === "race" || phase === "countdown" || phase === "paused") ? (
        <p className="absolute top-[max(0.95rem,env(safe-area-inset-top))] left-[max(4.6rem,calc(env(safe-area-inset-left)+3.8rem))] text-xs tabular-nums text-muted sm:left-[max(7.1rem,calc(env(safe-area-inset-left)+6.2rem))]">
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

      {settingsOpen ? (
        <SettingsPanel
          touch={touch}
          onClose={() => setSettingsOpen(false)}
          onUiClick={() => g()?.uiClick()}
          onMute={(v) => g()?.setMuted(v)}
        />
      ) : null}

      {phase === "race" || phase === "countdown" ? (
        <FirstRunHint touch={touch} padActive={pad.active} onDismiss={() => setHintGone(true)} />
      ) : null}

      {phase === "race" && hintGone ? (
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

function PadChip({ xbox }: { xbox: boolean }) {
  return (
    <span className="hud-chip inline-flex h-11 items-center gap-2 rounded-md px-3 text-xs font-medium uppercase tracking-widest text-muted">
      <Gamepad2 className="size-4 text-fg" />
      {xbox ? "Xbox" : "Pad"}
    </span>
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
          <span className={cn("hud-pace-chip tabular-nums tracking-wide", medal ? "text-fg" : "text-subtle")}>
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
