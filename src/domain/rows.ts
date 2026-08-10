import { STATUSES, type ActionItem, type Status } from "./types";

/** Columns A–O. The `Tracker` schema is fixed; nothing here may reorder or extend it. */
export const TRACKER_COLUMN_COUNT = 15;

/** A cell as written back to the sheet. Columns A, E and L are numeric there. */
export type CellValue = string | number;

/**
 * The Sheets API returns rows truncated at the last non-empty cell — 58 of the 66
 * live rows come back 14 wide because `Bukti / Catatan` is blank.
 */
export function padRow(cells: readonly unknown[]): string[] {
  const padded: string[] = [];
  for (let i = 0; i < TRACKER_COLUMN_COUNT; i += 1) {
    const cell = cells[i];
    padded.push(cell === null || cell === undefined ? "" : String(cell));
  }
  return padded;
}

function toInt(raw: string, fallback = 0): number {
  const parsed = Number.parseInt(String(raw).replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Coerce column K. Every live row holds one of the three canonical values; an
 * unrecognised one falls back to `Belum Dimulai` so a single bad cell cannot break
 * the page. Nothing is written back unless the user saves that row.
 */
export function parseStatus(raw: string): Status {
  const text = raw.trim().toLowerCase();
  return STATUSES.find((s) => s.toLowerCase() === text) ?? "Belum Dimulai";
}

export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function rowToItem(cells: readonly unknown[]): ActionItem {
  const c = padRow(cells);
  return {
    no: toInt(c[0]!),
    iapId: c[1]!.trim(),
    title: c[2]!,
    station: c[3]!,
    stepNo: toInt(c[4]!),
    step: c[5]!,
    action: c[6]!,
    pic: c[7]!,
    timeline: c[8]!,
    targetDate: c[9]!,
    status: parseStatus(c[10]!),
    progress: clampProgress(toInt(c[11]!)),
    actualDate: c[12]!,
    storedOverdue: c[13]!,
    evidence: c[14]!,
  };
}

/** Columns A, E and L stay numeric so the sheet's own cell types are preserved. */
export function itemToRow(item: ActionItem): CellValue[] {
  return [
    item.no,
    item.iapId,
    item.title,
    item.station,
    item.stepNo,
    item.step,
    item.action,
    item.pic,
    item.timeline,
    item.targetDate,
    item.status,
    item.progress,
    item.actualDate,
    item.storedOverdue,
    item.evidence,
  ];
}
