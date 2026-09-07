import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return "—:—";
  const total = ms / 1000;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}

export function formatTimeParts(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return { main: "—:—", frac: "" };
  const total = Math.max(0, ms / 1000);
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  const frac = Math.floor((total - Math.floor(total)) * 1000);
  return { main: `${m}:${s.toString().padStart(2, "0")}`, frac: frac.toString().padStart(3, "0") };
}

export function formatSpeed(mps: number) {
  return Math.max(0, Math.round(Math.abs(mps) * 3.6)).toString();
}
