import { compactFrames, sanitizeFrames } from "./ghost";
import { downloadBlob } from "./photo";
import { LAST_KEY, SAVE_KEY, parseLast, parseSave, type PersistIo } from "./persist";
import { PLAYABLE_ORDER, type GhostFrame, type GhostSource, type TrackId } from "./types";

export const GHOST_KIND = "rushline-ghost";
export const GHOST_FILE_VERSION = 1;
export const SHARE_KEY = "rushline-ghost-share-v1";

export type GhostShareSource = "pb" | "last" | "import";

export type GhostTapeRow = [t: number, s: number, n: number, heading: number];

export type GhostFile = {
  kind: typeof GHOST_KIND;
  version: typeof GHOST_FILE_VERSION;
  trackId: TrackId;
  time: number;
  source: GhostShareSource;
  tape: GhostTapeRow[];
};

export type SharedGhost = {
  time: number;
  frames: GhostFrame[];
};

export type ShareSave = {
  imports: Partial<Record<TrackId, SharedGhost>>;
};

export type GhostDecodeError = "kind" | "version" | "track" | "time" | "frames" | "json";

export type GhostDecodeResult =
  | { ok: true; file: GhostFile; frames: GhostFrame[] }
  | { ok: false; error: GhostDecodeError };

export type GhostExportPick = {
  trackId: TrackId;
  time: number;
  source: GhostShareSource;
  frames: GhostFrame[];
};

function browserIo(): PersistIo | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function emptyShare(): ShareSave {
  return { imports: {} };
}

export function isTrackId(id: unknown): id is TrackId {
  return typeof id === "string" && (PLAYABLE_ORDER as readonly string[]).includes(id);
}

function quant(n: number, digits: number): number {
  const m = 10 ** digits;
  return Math.round(n * m) / m;
}

export function packTape(frames: GhostFrame[]): GhostTapeRow[] {
  return frames.map((f) => [quant(f.t, 1), quant(f.s, 3), quant(f.n, 3), quant(f.heading, 4)]);
}

function rowFromUnknown(row: unknown): GhostFrame | null {
  if (Array.isArray(row) && row.length >= 4) {
    const t = row[0];
    const s = row[1];
    const n = row[2];
    const heading = row[3];
    if (
      typeof t === "number" &&
      typeof s === "number" &&
      typeof n === "number" &&
      typeof heading === "number"
    ) {
      return { t, s, n, heading };
    }
    return null;
  }
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  const t = o.t;
  const s = o.s;
  const n = o.n;
  const heading = o.heading;
  if (
    typeof t === "number" &&
    typeof s === "number" &&
    typeof n === "number" &&
    typeof heading === "number"
  ) {
    return { t, s, n, heading };
  }
  return null;
}

function framesFromPacked(o: Record<string, unknown>): GhostFrame[] | null {
  const t = o.t;
  const s = o.s;
  const n = o.n;
  const h = o.h ?? o.heading;
  if (!Array.isArray(t) || !Array.isArray(s) || !Array.isArray(n) || !Array.isArray(h)) return null;
  const len = Math.min(t.length, s.length, n.length, h.length);
  const out: GhostFrame[] = [];
  for (let i = 0; i < len; i++) {
    const frame = rowFromUnknown([t[i], s[i], n[i], h[i]]);
    if (frame) out.push(frame);
  }
  return out.length >= 2 ? out : null;
}

function framesFromPayload(o: Record<string, unknown>): GhostFrame[] | null {
  const tape = o.tape ?? o.frames;
  if (Array.isArray(tape)) {
    const raw: GhostFrame[] = [];
    for (const row of tape) {
      const frame = rowFromUnknown(row);
      if (frame) raw.push(frame);
    }
    return sanitizeFrames(raw);
  }
  return sanitizeFrames(framesFromPacked(o));
}

export function encodeGhostFile(pick: GhostExportPick): GhostFile {
  const frames = compactFrames(pick.frames);
  return {
    kind: GHOST_KIND,
    version: GHOST_FILE_VERSION,
    trackId: pick.trackId,
    time: pick.time,
    source: pick.source,
    tape: packTape(frames),
  };
}

export function decodeGhostFile(raw: unknown): GhostDecodeResult {
  if (typeof raw === "string") return parseGhostText(raw);
  if (!raw || typeof raw !== "object") return { ok: false, error: "json" };
  const o = raw as Record<string, unknown>;
  if (o.kind !== GHOST_KIND) return { ok: false, error: "kind" };
  if (o.version !== GHOST_FILE_VERSION && o.v !== GHOST_FILE_VERSION) return { ok: false, error: "version" };
  if (!isTrackId(o.trackId ?? o.track)) return { ok: false, error: "track" };
  const time = o.time;
  if (typeof time !== "number" || !Number.isFinite(time) || time <= 0) return { ok: false, error: "time" };
  const frames = framesFromPayload(o);
  if (!frames) return { ok: false, error: "frames" };
  const source: GhostShareSource = o.source === "last" || o.source === "import" ? o.source : "pb";
  const trackId = (o.trackId ?? o.track) as TrackId;
  return {
    ok: true,
    frames,
    file: {
      kind: GHOST_KIND,
      version: GHOST_FILE_VERSION,
      trackId,
      time,
      source,
      tape: packTape(frames),
    },
  };
}

export function parseGhostText(text: string): GhostDecodeResult {
  try {
    return decodeGhostFile(JSON.parse(text) as unknown);
  } catch {
    return { ok: false, error: "json" };
  }
}

export function ghostFilename(pick: Pick<GhostExportPick, "trackId" | "source" | "time">): string {
  const ms = Math.max(0, Math.round(pick.time));
  return `rushline-${pick.trackId}-${pick.source}-${ms}.json`;
}

export function downloadGhostFile(pick: GhostExportPick): boolean {
  const file = encodeGhostFile(pick);
  if (file.tape.length < 2) return false;
  const blob = new Blob([`${JSON.stringify(file)}\n`], { type: "application/json" });
  return downloadBlob(blob, ghostFilename(file));
}

export function parseShare(raw: string | null | undefined): ShareSave {
  if (!raw) return emptyShare();
  try {
    const parsed = JSON.parse(raw) as ShareSave;
    const imports: ShareSave["imports"] = {};
    for (const [id, run] of Object.entries(parsed.imports ?? {})) {
      if (!isTrackId(id) || !run || typeof run.time !== "number" || !Number.isFinite(run.time) || run.time <= 0) {
        continue;
      }
      const frames = sanitizeFrames(run.frames);
      if (!frames) continue;
      imports[id] = { time: run.time, frames };
    }
    return { imports };
  } catch {
    return emptyShare();
  }
}

function writeJson(io: PersistIo, key: string, value: unknown): boolean {
  try {
    io.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function readShare(io: PersistIo | null = browserIo()): ShareSave {
  if (!io) return emptyShare();
  return parseShare(io.getItem(SHARE_KEY));
}

export function readImportedGhost(trackId: TrackId, io: PersistIo | null = browserIo()): SharedGhost | null {
  return readShare(io).imports[trackId] ?? null;
}

export function commitImportedGhost(
  trackId: TrackId,
  time: number,
  frames: GhostFrame[],
  io: PersistIo | null = browserIo(),
  prev?: ShareSave,
): SharedGhost | null {
  const compact = compactFrames(frames);
  if (compact.length < 2 || !Number.isFinite(time) || time <= 0) return null;
  const share = prev ?? (io ? parseShare(io.getItem(SHARE_KEY)) : emptyShare());
  const next: SharedGhost = { time, frames: compact };
  share.imports[trackId] = next;
  if (io && !writeJson(io, SHARE_KEY, share)) {
    const slim: ShareSave = { imports: { [trackId]: next } };
    if (!writeJson(io, SHARE_KEY, slim)) return null;
    share.imports = slim.imports;
  }
  return next;
}

export function clearImportedGhost(trackId: TrackId, io: PersistIo | null = browserIo(), prev?: ShareSave): boolean {
  const share = prev ?? (io ? parseShare(io.getItem(SHARE_KEY)) : emptyShare());
  if (!share.imports[trackId]) return true;
  delete share.imports[trackId];
  if (!io) return true;
  return writeJson(io, SHARE_KEY, share);
}

export function ghostDecodeMessage(error: GhostDecodeError): string {
  if (error === "kind" || error === "version") return "That file is not a Rushline ghost.";
  if (error === "track") return "That ghost is for an unknown circuit.";
  if (error === "time") return "That ghost is missing a finish time.";
  if (error === "frames") return "That ghost tape is empty or unreadable.";
  return "Could not read that file.";
}

export function ghostHudTag(source: GhostSource): string {
  if (source === "import") return "RIVAL";
  if (source === "author") return "AUTH";
  if (source === "last") return "LAST";
  if (source === "pb") return "GHOST";
  return "GHOST";
}

export function pickExportGhost(
  trackId: TrackId,
  source: GhostShareSource,
  io: PersistIo | null = browserIo(),
): GhostExportPick | null {
  if (source === "pb") {
    const save = io ? parseSave(io.getItem(SAVE_KEY)) : parseSave(null);
    const frames = save.ghosts[trackId];
    const time = save.best[trackId];
    if (!frames || frames.length < 2 || time == null) return null;
    return { trackId, time, source, frames };
  }
  if (source === "last") {
    const last = io ? parseLast(io.getItem(LAST_KEY)) : parseLast(null);
    const run = last.runs[trackId];
    if (!run || run.frames.length < 2) return null;
    return { trackId, time: run.time, source, frames: run.frames };
  }
  const rival = readImportedGhost(trackId, io);
  if (!rival) return null;
  return { trackId, time: rival.time, source: "import", frames: rival.frames };
}

export function exportStoredGhost(
  trackId: TrackId,
  source: GhostShareSource,
  io: PersistIo | null = browserIo(),
): boolean {
  const pick = pickExportGhost(trackId, source, io);
  return pick ? downloadGhostFile(pick) : false;
}

export function importGhostFromText(
  text: string,
  io: PersistIo | null = browserIo(),
): GhostDecodeResult {
  const decoded = parseGhostText(text);
  if (!decoded.ok) return decoded;
  const saved = commitImportedGhost(decoded.file.trackId, decoded.file.time, decoded.frames, io);
  if (!saved) return { ok: false, error: "frames" };
  return decoded;
}
