import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Flag, Plus, RotateCcw, Trash2, Upload } from "lucide-react";
import {
  cloneSave,
  defaultCustomSave,
  downloadCustomJson,
  EDITOR_SURFACES,
  EDITOR_THEMES,
  insertPoint,
  MAX_EDITOR_POINTS,
  MIN_EDITOR_POINTS,
  movePoint,
  nearestSegment,
  parseCustomSave,
  readCustomSave,
  removePoint,
  sampleLoop,
  setCustomDraft,
  validateCustom,
  type CustomTrackSave,
  type EditorPoint,
} from "@/game/editor";
import { validateCustomBuild } from "@/game/track";
import { cn } from "@/lib/utils";
import { keepPlayFocus } from "./chrome";

type Props = {
  ready: boolean;
  onBack: () => void;
  onPreview: (save: CustomTrackSave) => void;
  onSave: (save: CustomTrackSave) => boolean;
  onDrive: (save: CustomTrackSave) => boolean;
};

export function EditorScreen({ ready, onBack, onPreview, onSave, onDrive }: Props) {
  const [draft, setDraft] = useState<CustomTrackSave>(() => readCustomSave());
  const [selected, setSelected] = useState(0);
  const [note, setNote] = useState("Drag points. Click the ribbon to add one.");
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef(onPreview);
  previewRef.current = onPreview;

  const issue = useMemo(() => validateCustom(draft), [draft]);
  const mesh = useMemo(() => (issue.ok ? validateCustomBuild() : null), [draft, issue.ok]);
  const readyToDrive = issue.ok && (mesh?.ok ?? false);
  const point = draft.points[selected] ?? draft.points[0];

  useEffect(() => {
    setCustomDraft(draft);
    const handle = window.setTimeout(() => previewRef.current(draft), 90);
    return () => window.clearTimeout(handle);
  }, [draft]);

  const patch = (next: CustomTrackSave, message?: string) => {
    setDraft(next);
    setCustomDraft(next);
    if (message) setNote(message);
  };

  const updatePoints = (points: EditorPoint[], message?: string, select?: number) => {
    const next = { ...draft, points };
    if (select != null) setSelected(Math.max(0, Math.min(points.length - 1, select)));
    else if (selected >= points.length) setSelected(Math.max(0, points.length - 1));
    patch(next, message);
  };

  return (
    <div
      data-overlay="editor"
      className="pointer-events-auto absolute inset-0 flex flex-col justify-start bg-gradient-to-b from-bg via-bg/88 to-bg/55"
    >
      <div
        data-allow-scroll
        className="overlay-enter flex max-h-full w-full max-w-xl flex-col gap-4 overflow-auto overscroll-contain px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(4rem,calc(env(safe-area-inset-top)+2.5rem))] md:ml-10 md:max-w-lg md:px-0"
      >
        <header>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted">Track editor lite</p>
          <h1 className="font-display text-5xl leading-none tracking-tight">Custom ribbon</h1>
          <p className="mt-2 max-w-sm text-pretty text-sm text-muted">
            Closed Catmull-Rom loop. Place a few points, check the mesh, then drive it. Time trial only — Cup stays on the stock seven.
          </p>
        </header>

        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">Plan · drag points · click ribbon to add</p>
        <EditorMap
          points={draft.points}
          selected={selected}
          onSelect={setSelected}
          onMove={(i, x, z) => updatePoints(movePoint(draft.points, i, { x, z }))}
          onInsert={(after, x, z) => {
            if (draft.points.length >= MAX_EDITOR_POINTS) {
              setNote(`Cap is ${MAX_EDITOR_POINTS} points.`);
              return;
            }
            const next = insertPoint(draft.points, after, { x, z });
            updatePoints(next, "Point added.", after + 1);
          }}
        />

        <p className={cn("text-xs", readyToDrive ? "text-ok" : "text-danger")} data-editor-status>
          {readyToDrive
            ? `Ready · ${Math.round(mesh?.length ?? issue.length)} m · ${mesh?.checkpoints ?? issue.checkpoints} CP · mesh ok`
            : (mesh?.errors[0] ?? issue.errors[0] ?? note)}
        </p>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-subtle">
            Name
            <input
              value={draft.name}
              maxLength={24}
              onChange={(e) => patch({ ...draft, name: e.target.value })}
              className="h-10 rounded-md border border-border bg-bg-elevated px-3 text-sm normal-case tracking-normal text-fg"
            />
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-subtle">
            Laps
            <select
              value={draft.laps}
              onChange={(e) => patch({ ...draft, laps: e.target.value === "2" ? 2 : 1 })}
              className="h-10 rounded-md border border-border bg-bg-elevated px-3 text-sm normal-case tracking-normal text-fg"
            >
              <option value={1}>1 lap</option>
              <option value={2}>2 laps</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-subtle">
            Theme
            <select
              value={draft.env}
              onChange={(e) => patch({ ...draft, env: e.target.value as CustomTrackSave["env"] })}
              className="h-10 rounded-md border border-border bg-bg-elevated px-3 text-sm normal-case tracking-normal text-fg"
            >
              {EDITOR_THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-subtle">
            Surface
            <select
              value={draft.surface}
              onChange={(e) => patch({ ...draft, surface: e.target.value as CustomTrackSave["surface"] })}
              className="h-10 rounded-md border border-border bg-bg-elevated px-3 text-sm normal-case tracking-normal text-fg"
            >
              {EDITOR_SURFACES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {point ? (
          <div className="rounded-xl border border-border bg-surface/90 p-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
              Point {selected + 1} / {draft.points.length}
              {selected === 0 ? " · start" : ""}
            </p>
            <label className="mt-3 flex flex-col gap-1 text-[10px] uppercase tracking-widest text-subtle">
              Height {point.y.toFixed(1)} m
              <input
                type="range"
                min={0.02}
                max={24}
                step={0.1}
                value={point.y}
                onChange={(e) => updatePoints(movePoint(draft.points, selected, { y: Number(e.target.value) }))}
              />
            </label>
            <label className="mt-2 flex flex-col gap-1 text-[10px] uppercase tracking-widest text-subtle">
              Width {point.width.toFixed(1)} m
              <input
                type="range"
                min={8.5}
                max={16}
                step={0.1}
                value={point.width}
                onChange={(e) => updatePoints(movePoint(draft.points, selected, { width: Number(e.target.value) }))}
              />
            </label>
            <label className="mt-2 flex flex-col gap-1 text-[10px] uppercase tracking-widest text-subtle">
              Bank {point.bank.toFixed(2)}
              <input
                type="range"
                min={-0.55}
                max={0.55}
                step={0.01}
                value={point.bank}
                onChange={(e) => updatePoints(movePoint(draft.points, selected, { bank: Number(e.target.value) }))}
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <Toggle
                label="Checkpoint"
                on={Boolean(point.checkpoint)}
                onClick={() => updatePoints(movePoint(draft.points, selected, { checkpoint: !point.checkpoint }))}
              />
              <Toggle
                label="Boost"
                on={Boolean(point.boost)}
                onClick={() => updatePoints(movePoint(draft.points, selected, { boost: !point.boost }))}
              />
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onMouseDown={keepPlayFocus}
            onClick={() => {
              const next = insertPoint(draft.points, selected);
              updatePoints(next, "Point added.", selected + 1);
            }}
            disabled={draft.points.length >= MAX_EDITOR_POINTS}
            className="flex h-11 items-center justify-center gap-1.5 rounded-md border border-border bg-bg-elevated text-xs text-fg disabled:opacity-40"
          >
            <Plus className="size-3.5" />
            Add
          </button>
          <button
            type="button"
            onMouseDown={keepPlayFocus}
            onClick={() => updatePoints(removePoint(draft.points, selected), "Point removed.")}
            disabled={draft.points.length <= MIN_EDITOR_POINTS}
            className="flex h-11 items-center justify-center gap-1.5 rounded-md border border-border bg-bg-elevated text-xs text-fg disabled:opacity-40"
          >
            <Trash2 className="size-3.5" />
            Delete
          </button>
          <button
            type="button"
            onMouseDown={keepPlayFocus}
            onClick={() => {
              const next = defaultCustomSave();
              setSelected(0);
              patch(next, "Default oval restored.");
            }}
            className="flex h-11 items-center justify-center gap-1.5 rounded-md border border-border bg-bg-elevated text-xs text-fg"
          >
            <RotateCcw className="size-3.5" />
            Reset
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={!ready || !readyToDrive}
            onMouseDown={keepPlayFocus}
            onClick={() => {
              if (onDrive(draft)) setNote("Driving Custom.");
              else setNote("Mesh failed. Move a point and try again.");
            }}
            className="flex h-12 items-center justify-center gap-2 rounded-lg bg-accent text-sm font-semibold text-accent-fg disabled:opacity-50"
          >
            <Flag className="size-4" />
            Drive Custom
          </button>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                if (onSave(draft)) setNote("Saved on this device.");
                else setNote(issue.errors[0] ?? "Could not save.");
              }}
              className="h-11 rounded-md border border-border bg-surface text-xs font-medium text-fg"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                downloadCustomJson(draft);
                setNote("JSON downloaded.");
              }}
              className="flex h-11 items-center justify-center gap-1.5 rounded-md border border-border bg-surface text-xs font-medium text-fg"
            >
              <Download className="size-3.5" />
              Export
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-11 items-center justify-center gap-1.5 rounded-md border border-border bg-surface text-xs font-medium text-fg"
            >
              <Upload className="size-3.5" />
              Import
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              void file.text().then((text) => {
                const next = parseCustomSave(text);
                setSelected(0);
                patch(cloneSave(next), `Loaded ${next.name}.`);
              });
            }}
          />
          <button
            type="button"
            onClick={onBack}
            className="h-11 rounded-md border border-border bg-bg-elevated text-sm text-muted"
          >
            Back
          </button>
          <p className="text-[11px] text-subtle">{note}</p>
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onMouseDown={keepPlayFocus}
      onClick={onClick}
      className={cn(
        "h-8 rounded-md border px-2.5 text-[11px] font-medium uppercase tracking-widest",
        on ? "border-fg/45 bg-bg-elevated text-fg" : "border-border bg-bg text-muted",
      )}
    >
      {label}
    </button>
  );
}

function EditorMap({
  points,
  selected,
  onSelect,
  onMove,
  onInsert,
}: {
  points: EditorPoint[];
  selected: number;
  onSelect: (i: number) => void;
  onMove: (i: number, x: number, z: number) => void;
  onInsert: (after: number, x: number, z: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ i: number } | null>(null);
  const loop = useMemo(() => sampleLoop(points, 3.2), [points]);

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of [...points, ...loop]) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  const pad = 28;
  const x0 = (Number.isFinite(minX) ? minX : -40) - pad;
  const z0 = (Number.isFinite(minZ) ? minZ : -40) - pad;
  const w = Math.max(80, (Number.isFinite(maxX) ? maxX : 40) - x0 + pad);
  const h = Math.max(80, (Number.isFinite(maxZ) ? maxZ : 40) - z0 + pad);

  const worldFromEvent = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, z: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, z: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const loc = pt.matrixTransform(ctm.inverse());
    return { x: loc.x, z: loc.y };
  };

  return (
    <div className="overflow-hidden rounded-xl border border-fg/20 bg-[#0c0c10]">
      <svg
        ref={svgRef}
        data-editor-map
        viewBox={`${x0} ${z0} ${w} ${h}`}
        className="block h-52 w-full touch-none sm:h-60"
        onPointerMove={(e) => {
          if (!drag.current) return;
          e.preventDefault();
          const { x, z } = worldFromEvent(e);
          onMove(drag.current.i, x, z);
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerLeave={() => {
          drag.current = null;
        }}
        onPointerDown={(e) => {
          if ((e.target as Element).closest("[data-point]")) return;
          const { x, z } = worldFromEvent(e);
          const hit = nearestSegment(points, x, z);
          if (hit.dist < 14) onInsert(hit.index, x, z);
        }}
      >
        <rect x={x0} y={z0} width={w} height={h} fill="#14141a" />
        <path
          d={loop.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.z}`).join(" ") + " Z"}
          fill="none"
          stroke="#2c2c33"
          strokeWidth={Math.max(w, h) * 0.028}
          strokeLinejoin="round"
        />
        <path
          d={loop.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.z}`).join(" ") + " Z"}
          fill="none"
          stroke="#f4f4f2"
          strokeWidth={Math.max(w, h) * 0.01}
          strokeDasharray={`${Math.max(w, h) * 0.028} ${Math.max(w, h) * 0.02}`}
        />
        {points.map((p, i) => {
          const r = Math.max(w, h) * (i === selected ? 0.018 : 0.014);
          const fill = p.checkpoint ? "#8dccad" : p.boost ? "#c4a574" : i === 0 ? "#f4f4f2" : "#9a9aa3";
          return (
            <g key={i} data-point={i}>
              <circle
                cx={p.x}
                cy={p.z}
                r={r * (p.y > 1 ? 1.15 : 1)}
                fill={fill}
                stroke={i === selected ? "#f4f4f2" : "#18181c"}
                strokeWidth={r * 0.28}
                className="cursor-pointer"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  drag.current = { i };
                  onSelect(i);
                }}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
