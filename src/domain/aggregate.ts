import { isDueWithin } from "./overdue";
import type {
  CaseSummary,
  DerivedActionItem,
  Status,
  StatusCounts,
  Totals,
} from "./types";

/** The window the "jatuh tempo" filter and KPI card use. */
export const DUE_SOON_DAYS = 7;

function emptyCounts(): StatusCounts {
  return { total: 0, closed: 0, inProgress: 0, open: 0, overdue: 0 };
}

function tally(counts: StatusCounts, item: DerivedActionItem): void {
  counts.total += 1;
  if (item.status === "Selesai") counts.closed += 1;
  if (item.status === "Sedang Berjalan") counts.inProgress += 1;
  if (item.status === "Belum Dimulai") counts.open += 1;
  if (item.overdue === "TERLAMBAT") counts.overdue += 1;
}

export function percentClosed(closed: number, total: number): number {
  return total ? Math.round((closed / total) * 100) : 0;
}

/** Counts keyed by status, so callers can iterate `STATUSES` instead of branching. */
export function countsByStatus(counts: StatusCounts): Record<Status, number> {
  return {
    Selesai: counts.closed,
    "Sedang Berjalan": counts.inProgress,
    "Belum Dimulai": counts.open,
  };
}

export function summariseTotals(items: readonly DerivedActionItem[]): Totals {
  const counts = emptyCounts();
  let dueSoon = 0;
  for (const item of items) {
    tally(counts, item);
    if (isDueWithin(item, DUE_SOON_DAYS)) dueSoon += 1;
  }
  return {
    ...counts,
    pctClosed: percentClosed(counts.closed, counts.total),
    dueSoon,
  };
}

/** One row per IAP case, in first-appearance order so the sheet's ordering is kept. */
export function summariseByCase(
  items: readonly DerivedActionItem[],
): CaseSummary[] {
  const byCase = new Map<string, CaseSummary>();
  for (const item of items) {
    let summary = byCase.get(item.iapId);
    if (!summary) {
      summary = {
        iapId: item.iapId,
        title: item.title,
        station: item.station,
        pctClosed: 0,
        ...emptyCounts(),
      };
      byCase.set(item.iapId, summary);
    }
    tally(summary, item);
  }
  for (const summary of byCase.values()) {
    summary.pctClosed = percentClosed(summary.closed, summary.total);
  }
  return [...byCase.values()];
}

export function caseIds(items: readonly DerivedActionItem[]): string[] {
  return [...new Set(items.map((item) => item.iapId))];
}

export interface DueBucket {
  label: string;
  count: number;
  /** Overdue reads differently from the forward-looking buckets. */
  late: boolean;
}

/**
 * Each bucket owns the test for what falls into it, so the display order below is
 * the only thing the order of this list decides. First match wins.
 */
const DUE_BUCKETS: ReadonlyArray<{
  label: string;
  late: boolean;
  holds: (daysToTarget: number | null) => boolean;
}> = [
  { label: "Overdue", late: true, holds: (d) => d !== null && d < 0 },
  { label: "≤ 7 hari", late: false, holds: (d) => d !== null && d <= 7 },
  { label: "8–14 hari", late: false, holds: (d) => d !== null && d <= 14 },
  { label: "15–30 hari", late: false, holds: (d) => d !== null && d <= 30 },
  { label: "31–60 hari", late: false, holds: (d) => d !== null && d <= 60 },
  { label: "> 60 hari", late: false, holds: (d) => d !== null },
  { label: "Tanpa target", late: false, holds: (d) => d === null },
];

/**
 * Workload outlook across open items only — closed work has nothing left to plan for.
 */
export function dueOutlook(items: readonly DerivedActionItem[]): DueBucket[] {
  const buckets: DueBucket[] = DUE_BUCKETS.map(({ label, late }) => ({
    label,
    late,
    count: 0,
  }));

  for (const item of items) {
    if (item.status === "Selesai") continue;
    const index = DUE_BUCKETS.findIndex((bucket) =>
      bucket.holds(item.daysToTarget),
    );
    if (index !== -1) buckets[index]!.count += 1;
  }

  return buckets;
}
