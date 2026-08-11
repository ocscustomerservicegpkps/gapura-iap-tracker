import type { OverdueFlag, Status } from "@/domain/types";

/** English UI labels; stored sheet values remain in Indonesian. */
export const STATUS_LABEL: Record<Status, string> = {
  Selesai: "Completed",
  "Sedang Berjalan": "Ongoing",
  "Belum Dimulai": "Not Started",
};

export const OVERDUE_LABEL: Record<OverdueFlag, string> = {
  TERLAMBAT: "Overdue",
  "Sesuai Rencana": "On Track",
  "-": "-",
};

/** Pill classes, mirroring the original dashboard's colour coding. */
export const STATUS_PILL: Record<Status, string> = {
  Selesai: "bg-done-soft text-done-ink",
  "Sedang Berjalan": "bg-running-soft text-running-ink",
  "Belum Dimulai": "bg-idle-soft text-idle-ink",
};

export const OVERDUE_PILL: Record<OverdueFlag, string> = {
  TERLAMBAT: "bg-late-soft text-late-ink",
  "Sesuai Rencana": "bg-plan-soft text-plan-ink",
  "-": "text-faint",
};

/**
 * Chart and progress-bar fills, as raw colours for SVG and inline styles. Every one
 * of them carries white numerals inside a bar segment, so each clears 4.5:1 against
 * white — the neutral included.
 */
export const STATUS_COLOR: Record<Status, string> = {
  Selesai: "oklch(42% 0.13 145)",
  "Sedang Berjalan": "oklch(48% 0.14 70)",
  "Belum Dimulai": "oklch(55% 0.02 250)",
};

/** Unfilled remainder of any progress track. Mirrors `--color-track`. */
export const TRACK_COLOR = "oklch(93% 0.004 250)";

export const LATE_COLOR = "oklch(50% 0.17 25)";
export const PLAN_COLOR = "oklch(45% 0.1 160)";

export function progressColor(percent: number): string {
  if (percent >= 100) return "oklch(55% 0.14 145)";
  if (percent >= 50) return "oklch(60% 0.13 160)";
  if (percent > 0) return "oklch(62% 0.14 70)";
  return "oklch(85% 0.01 250)";
}
