import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Download, Flag, Magnet, Minus, Plus, Redo2, RotateCcw, Trash2, Undo2, Upload, Video } from "lucide-react";
import {
  clonePoints,
  cloneSave,
  defaultCustomSave,
  downloadCustomJson,
  EDITOR_GRID,
  EDITOR_SURFACES,
  EDITOR_THEMES,
  emptyPointHistory,
  flattenRibbon,
  insertPoint,
  MAX_EDITOR_POINTS,
  MIN_EDITOR_POINTS,
  movePoint,
  parseCustomSave,
  placeOnRibbon,
  pointsEqual,
  readCustomSave,
  recordPointChange,
  redoPoints,
  removePoint,
  sampleLoop,
  setCustomDraft,
  snapPointsToGrid,
  snapXZ,
  undoPoints,
  validateCustom,
  type CustomTrackSave,
  type EditorPoint,
  type PlaceTool,
  type PointHistory,
} from "@/game/editor";
import { COPY } from "@/game/help";
import { validateCustomBuild } from "@/game/track";
import { cn } from "@/lib/utils";
import { keepPlayFocus } from "./chrome";

type Props = {
  ready: boolean;
  onBack: () => void;
  onPreview: (save: CustomTrackSave) => void;
  onSave: (save: CustomTrackSave) => boolean;
  onDrive: (save: CustomTrackSave) => boolean;
  onFlythrough: (on: boolean) => void;
};

export function EditorScreen({ ready, onBack, onPreview, onSave, onDrive, onFlythrough }: Props) {
  const [draft, setDraft] = useState<CustomTrackSave>(() => readCustomSave());
  const [selected, setSelected] = useState(0);
  const [tool, setTool] = useState<PlaceTool>("move");
  const [snap, setSnap] = useState(false);
  const [fly, setFly] = useState(false);
  const [history, setHistory] = useState<PointHistory>(() => emptyPointHistory());
  const [note, setNote] = useState("Drag points. Click the ribbon to add one.");
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef(onPreview);
  const flyRef = useRef(onFlythrough);
  const draftRef = useRef(draft);
  const historyRef = useRef(history);
  const selectedRef = useRef(selected);
  const strokeRef = useRef<EditorPoint[] | null>(null);
  previewRef.current = onPreview;
  flyRef.current = onFlythrough;
  draftRef.current = draft;
  historyRef.current = history;
  selectedRef.current = selected;

  const issue = useMemo(() => validateCustom(draft), [draft]);
  const mesh = useMemo(() => (issue.ok ? validateCustomBuild() : null), [draft, issue.ok]);
  const readyToDrive = issue.ok && (mesh?.ok ?? false);
  const point = draft.points[selected] ?? draft.points[0];
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  useEffect(() => {
    setCustomDraft(draft);
    const handle = window.setTimeout(() => previewRef.current(draft), 90);
    return () => window.clearTimeout(handle);
  }, [draft]);

  useEffect(() => {
    flyRef.current(fly);
    return () => flyRef.current(false);
  }, [fly]);

  const patch = (next: CustomTrackSave, message?: string) => {
    setDraft(next);
    setCustomDraft(next);
    if (message) setNote(message);
  };

  const applyPoints = (points: EditorPoint[], message?: string, select?: number, record = true) => {
    const cur = draftRef.current;
    if (record && !pointsEqual(points, cur.points)) {
      setHistory(recordPointChange(historyRef.current, cur.points));
    }
    if (select != null) setSelected(Math.max(0, Math.min(points.length - 1, select)));
    else if (selectedRef.current >= points.length) setSelected(Math.max(0, points.length - 1));
    patch({ ...cur, points }, message);
  };

  const beginStroke = () => {
    strokeRef.current = clonePoints(draftRef.current.points);
  };

  const endStroke = () => {
    const before = strokeRef.current;
    strokeRef.current = null;
    if (before && !pointsEqual(before, draftRef.current.points)) {
      setHistory(recordPointChange(historyRef.current, before));
    }
  };

  const undo = () => {
    const cur = draftRef.current;
    const result = undoPoints(historyRef.current, cur.points);
    if (!result) return;
    setHistory(result.history);
    setSelected(Math.max(0, Math.min(selectedRef.current, result.points.length - 1)));
    patch({ ...cur, points: result.points }, "Undid point edit.");
  };

  const redo = () => {
    const cur = draftRef.current;
    const result = redoPoints(historyRef.current, cur.points);
    if (!result) return;
    setHistory(result.history);
    setSelected(Math.max(0, Math.min(selectedRef.current, result.points.length - 1)));
    patch({ ...cur, points: result.points }, "Redid point edit.");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) {
        return;
      }
      const key = e.key.toLowerCase();
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (key === "z") {
        e.preventDefault();
        undo();
      } else if (key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toolHint =
    tool === "checkpoint"
      ? "Click the ribbon or a point to drop a checkpoint."
      : tool === "boost"
        ? "Click the ribbon or a point to drop a boost pad."
        : snap
          ? "Snap on · drag points · click the ribbon to add."
          : "Drag points. Click the ribbon to add one.";

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
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted">{COPY.editorEyebrow}</p>
          <h1 className="font-display text-5xl leading-none tracking-tight">Custom ribbon</h1>
          <p className="mt-2 max-w-sm text-pretty text-sm text-muted">
            Closed Catmull-Rom loop. Place checkpoints and boosts on the plan, undo a miss, then fly the ribbon. Time trial
            only — Cup stays on the stock nine.
          </p>
        </header>

        <div className="grid grid-cols-3 gap-2" data-editor-tools>
          <ToolButton
            label="Move"
            active={tool === "move"}
            onClick={() => {
              setTool("move");
              setNote("Drag points. Click the ribbon to add one.");
            }}
          />
          <ToolButton
            label="Checkpoint"
            active={tool === "checkpoint"}
            onClick={() => {
              setTool("checkpoint");
              setNote("Click the ribbon or a point to drop a checkpoint.");
            }}
          />
          <ToolButton
            label="Boost"
            active={tool === "boost"}
            onClick={() => {
              setTool("boost");
              setNote("Click the ribbon or a point to drop a boost pad.");
            }}
          />
        </div>

        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">{toolHint}</p>
        <EditorMap
          points={draft.points}
          selected={selected}
          tool={tool}
          snap={snap}
          onSelect={setSelected}
          onMove={(i, x, z) => {
            const at = snapXZ(x, z, snap);
            applyPoints(movePoint(draftRef.current.points, i, at), undefined, i, false);
          }}
          onPlace={(x, z) => {
            const result = placeOnRibbon(draftRef.current.points, x, z, tool, snap);
            if (!result.changed) {
              if (result.message) setNote(result.message);
              return;
            }
            applyPoints(result.points, result.message, result.selected);
          }}
          onStrokeStart={beginStroke}
          onStrokeEnd={endStroke}
        />

        <div className="grid grid-cols-5 gap-2">
          <IconBtn
            label="Undo"
            dataAttr="data-editor-undo"
            disabled={!canUndo}
            onClick={undo}
          >
            <Undo2 className="size-3.5" />
          </IconBtn>
          <IconBtn
            label="Redo"
            dataAttr="data-editor-redo"
            disabled={!canRedo}
            onClick={redo}
          >
            <Redo2 className="size-3.5" />
          </IconBtn>
          <IconBtn
            label={snap ? "Snap on" : "Snap"}
            dataAttr="data-editor-snap"
            active={snap}
            onClick={() => {
              const next = !snap;
              setSnap(next);
              setNote(next ? `Snap to ${EDITOR_GRID} m grid.` : "Free move.");
            }}
          >
            <Magnet className="size-3.5" />
          </IconBtn>
          <IconBtn
            label="Flatten"
            dataAttr="data-editor-flatten"
            onClick={() => applyPoints(flattenRibbon(draft.points), "Ribbon flattened.")}
          >
            <Minus className="size-3.5" />
          </IconBtn>
          <IconBtn
            label={fly ? "Flying" : "Fly"}
            dataAttr="data-editor-fly"
            active={fly}
            onClick={() => {
              const next = !fly;
              setFly(next);
              setNote(next ? "Flying the ribbon — watch the 3D preview." : "Flythrough off.");
            }}
          >
            <Video className="size-3.5" />
          </IconBtn>
        </div>
        <button
          type="button"
          onMouseDown={keepPlayFocus}
          onClick={() => applyPoints(snapPointsToGrid(draft.points), `Points snapped to ${EDITOR_GRID} m.`)}
          className="h-10 rounded-md border border-border bg-bg-elevated text-xs text-fg"
        >
          Snap all points
        </button>

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
                onPointerDown={beginStroke}
                onPointerUp={endStroke}
                onChange={(e) => applyPoints(movePoint(draft.points, selected, { y: Number(e.target.value) }), undefined, selected, false)}
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
                onPointerDown={beginStroke}
                onPointerUp={endStroke}
                onChange={(e) => applyPoints(movePoint(draft.points, selected, { width: Number(e.target.value) }), undefined, selected, false)}
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
                onPointerDown={beginStroke}
                onPointerUp={endStroke}
                onChange={(e) => applyPoints(movePoint(draft.points, selected, { bank: Number(e.target.value) }), undefined, selected, false)}
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <Toggle
                label="Checkpoint"
                on={Boolean(point.checkpoint)}
                onClick={() => applyPoints(movePoint(draft.points, selected, { checkpoint: !point.checkpoint }))}
              />
              <Toggle
                label="Boost"
                on={Boolean(point.boost)}
                onClick={() => applyPoints(movePoint(draft.points, selected, { boost: !point.boost }))}
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
              applyPoints(next, "Point added.", selected + 1);
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
            onClick={() => applyPoints(removePoint(draft.points, selected), "Point removed.")}
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
              setHistory(recordPointChange(historyRef.current, draftRef.current.points));
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
                setHistory(recordPointChange(historyRef.current, draftRef.current.points));
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

function ToolButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      data-editor-tool={label.toLowerCase()}
      aria-pressed={active}
      onMouseDown={keepPlayFocus}
      onClick={onClick}
      className={cn(
        "h-10 rounded-md border text-[11px] font-medium uppercase tracking-widest",
        active ? "border-fg/45 bg-bg-elevated text-fg" : "border-border bg-bg text-muted",
      )}
    >
      {label}
    </button>
  );
}

function IconBtn({
  label,
  children,
  onClick,
  disabled,
  active,
  dataAttr,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  dataAttr?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      aria-pressed={active}
      {...(dataAttr ? { [dataAttr]: "" } : {})}
      onMouseDown={keepPlayFocus}
      onClick={onClick}
      className={cn(
        "flex h-11 flex-col items-center justify-center gap-0.5 rounded-md border text-[9px] uppercase tracking-widest disabled:opacity-35",
        active ? "border-fg/45 bg-bg-elevated text-fg" : "border-border bg-bg-elevated text-muted",
      )}
    >
      {children}
      {label}
    </button>
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
  tool,
  snap,
  onSelect,
  onMove,
  onPlace,
  onStrokeStart,
  onStrokeEnd,
}: {
  points: EditorPoint[];
  selected: number;
  tool: PlaceTool;
  snap: boolean;
  onSelect: (i: number) => void;
  onMove: (i: number, x: number, z: number) => void;
  onPlace: (x: number, z: number) => void;
  onStrokeStart: () => void;
  onStrokeEnd: () => void;
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

  const gridLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  if (snap) {
    const xStart = Math.floor(x0 / EDITOR_GRID) * EDITOR_GRID;
    const zStart = Math.floor(z0 / EDITOR_GRID) * EDITOR_GRID;
    for (let x = xStart; x <= x0 + w; x += EDITOR_GRID) {
      gridLines.push({ x1: x, y1: z0, x2: x, y2: z0 + h });
    }
    for (let z = zStart; z <= z0 + h; z += EDITOR_GRID) {
      gridLines.push({ x1: x0, y1: z, x2: x0 + w, y2: z });
    }
  }

  return (
    <div className="h-52 shrink-0 overflow-hidden rounded-xl border border-fg/25 bg-[#14141a] sm:h-60">
      <svg
        ref={svgRef}
        data-editor-map
        data-editor-tool={tool}
        viewBox={`${x0} ${z0} ${w} ${h}`}
        className={cn("block h-full w-full touch-none", tool === "move" ? "cursor-default" : "cursor-crosshair")}
        onPointerMove={(e) => {
          if (!drag.current) return;
          e.preventDefault();
          const { x, z } = worldFromEvent(e);
          onMove(drag.current.i, x, z);
        }}
        onPointerUp={() => {
          if (drag.current) onStrokeEnd();
          drag.current = null;
        }}
        onPointerCancel={() => {
          if (drag.current) onStrokeEnd();
          drag.current = null;
        }}
        onPointerLeave={() => {
          if (drag.current) onStrokeEnd();
          drag.current = null;
        }}
        onPointerDown={(e) => {
          if ((e.target as Element).closest("[data-point]")) return;
          const { x, z } = worldFromEvent(e);
          onPlace(x, z);
        }}
      >
        <rect x={x0} y={z0} width={w} height={h} fill="#14141a" />
        {gridLines.length ? (
          <g stroke="#2a2a31" strokeWidth={Math.max(w, h) * 0.0014} opacity={0.85}>
            {gridLines.map((g, i) => (
              <line key={i} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} />
            ))}
          </g>
        ) : null}
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
          const mark = r * 1.7;
          return (
            <g key={i} data-point={i} data-point-kind={p.checkpoint ? "checkpoint" : p.boost ? "boost" : i === 0 ? "start" : "point"}>
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
                  onSelect(i);
                  if (tool !== "move") {
                    onPlace(p.x, p.z);
                    return;
                  }
                  e.currentTarget.setPointerCapture(e.pointerId);
                  onStrokeStart();
                  drag.current = { i };
                }}
              />
              {p.checkpoint ? (
                <polygon
                  points={`${p.x},${p.z - mark} ${p.x + mark * 0.42},${p.z - mark * 0.28} ${p.x - mark * 0.42},${p.z - mark * 0.28}`}
                  fill="#8dccad"
                  className="pointer-events-none"
                />
              ) : null}
              {p.boost && !p.checkpoint ? (
                <polygon
                  points={`${p.x},${p.z + mark * 0.15} ${p.x - mark * 0.38},${p.z + mark * 0.7} ${p.x + mark * 0.38},${p.z + mark * 0.7}`}
                  fill="#c4a574"
                  className="pointer-events-none"
                />
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
