export const STATUSES = ["Selesai", "Sedang Berjalan", "Belum Dimulai"] as const;
export type Status = (typeof STATUSES)[number];

export const OVERDUE_FLAGS = ["TERLAMBAT", "Sesuai Rencana", "-"] as const;
export type OverdueFlag = (typeof OVERDUE_FLAGS)[number];

/**
 * One row of the `Tracker` tab, columns A–O, as typed values.
 *
 * `storedOverdue` is column N as it currently sits in the sheet. It is kept only
 * so the app can tell whether the sheet needs healing; every display and count
 * uses the derived value instead (see `deriveOverdue`).
 */
export interface ActionItem {
  /** A — global 1..N sequence, renumbered on create/delete. */
  no: number;
  /** B — case identity. */
  iapId: string;
  /** C — case metadata, denormalised across the case's rows. */
  title: string;
  /** D — case metadata, denormalised across the case's rows. */
  station: string;
  /** E — step number within the case. `(iapId, stepNo)` is the row identity. */
  stepNo: number;
  /** F */
  step: string;
  /** G */
  action: string;
  /** H */
  pic: string;
  /** I */
  timeline: string;
  /** J — Indonesian `d Mmm yyyy` text, exactly as stored. */
  targetDate: string;
  /** K */
  status: Status;
  /** L — integer 0–100. */
  progress: number;
  /** M — Indonesian `d Mmm yyyy` text, exactly as stored. */
  actualDate: string;
  /** N — derived, never trusted. */
  storedOverdue: string;
  /** O */
  evidence: string;
  /**
   * P — the live sheet's `Konteks` column. The app does not read or show it: a case's
   * context is per-case and lives in the `Konteks` tab, not repeated on every row.
   * Carried through writes verbatim so a whole-row save cannot wipe it.
   */
  contextNote: string;
  /**
   * Q — URL of the evidence itself (Drive folder, photo, signed attendance list).
   * Blank, or an `http`/`https` URL; nothing else is ever stored, because this value
   * becomes an `href`.
   */
  evidenceLink: string;
}

/** An {@link ActionItem} with everything the UI needs computed against a fixed "today". */
export interface DerivedActionItem extends ActionItem {
  /** Derived from `targetDate` + `status`; overrides whatever column N says. */
  overdue: OverdueFlag;
  /** `targetDate` as `YYYY-MM-DD`, or null when blank/unparseable. */
  targetIso: string | null;
  /** `actualDate` as `YYYY-MM-DD`, or null when blank/unparseable. */
  actualIso: string | null;
  /** Days from today to target. Negative when past. Null when no target date. */
  daysToTarget: number | null;
}

/** Composite key identifying one row. Verified unique across the tracker. */
export interface ItemKey {
  iapId: string;
  stepNo: number;
}

export interface StatusCounts {
  total: number;
  closed: number;
  inProgress: number;
  open: number;
  overdue: number;
}

export interface CaseSummary extends StatusCounts {
  iapId: string;
  title: string;
  station: string;
  pctClosed: number;
}

export interface Totals extends StatusCounts {
  pctClosed: number;
  dueSoon: number;
}
