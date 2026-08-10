import { DUE_SOON_DAYS } from "./aggregate";
import { isDueWithin } from "./overdue";
import type { DerivedActionItem, OverdueFlag, Status } from "./types";

export const ANY = "Semua";

export interface FilterCriteria {
  search: string;
  iapId: string | typeof ANY;
  status: Status | typeof ANY;
  overdueOnly: boolean;
  dueSoonOnly: boolean;
}

export const EMPTY_FILTERS: FilterCriteria = {
  search: "",
  iapId: ANY,
  status: ANY,
  overdueOnly: false,
  dueSoonOnly: false,
};

export function hasActiveFilters(criteria: FilterCriteria): boolean {
  return (
    criteria.search.trim() !== "" ||
    criteria.iapId !== ANY ||
    criteria.status !== ANY ||
    criteria.overdueOnly ||
    criteria.dueSoonOnly
  );
}

/** The fields free-text search looks at: case, PIC, step text and evidence. */
function haystack(item: DerivedActionItem): string {
  return [
    item.iapId,
    item.title,
    item.station,
    item.step,
    item.action,
    item.pic,
    item.timeline,
    item.targetDate,
    item.status,
    item.evidence,
  ]
    // Newline cannot come from a single-line search box, so fields never blur
    // together into a false match across a boundary.
    .join("\n")
    .toLowerCase();
}

export function filterItems(
  items: readonly DerivedActionItem[],
  criteria: FilterCriteria,
): DerivedActionItem[] {
  const query = criteria.search.trim().toLowerCase();
  return items.filter((item) => {
    if (criteria.iapId !== ANY && item.iapId !== criteria.iapId) return false;
    if (criteria.status !== ANY && item.status !== criteria.status) return false;
    if (criteria.overdueOnly && item.overdue !== "TERLAMBAT") return false;
    if (criteria.dueSoonOnly && !isDueWithin(item, DUE_SOON_DAYS)) return false;
    if (query && !haystack(item).includes(query)) return false;
    return true;
  });
}

export const SORT_KEYS = [
  "no",
  "iapId",
  "step",
  "pic",
  "timeline",
  "targetDate",
  "status",
  "progress",
  "overdue",
  "evidence",
] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDirection = "asc" | "desc";

/** Workflow order, so sorting by status walks the pipeline rather than the alphabet. */
const STATUS_RANK: Record<Status, number> = {
  "Belum Dimulai": 0,
  "Sedang Berjalan": 1,
  Selesai: 2,
};

/** Most urgent first when ascending. */
const OVERDUE_RANK: Record<OverdueFlag, number> = {
  TERLAMBAT: 0,
  "Sesuai Rencana": 1,
  "-": 2,
};

const collator = new Intl.Collator("id", { numeric: true, sensitivity: "base" });

/**
 * Comparable value per column. `targetDate` deliberately sorts on the parsed ISO
 * date, not the displayed text — otherwise "30 Jul" would order before "9 Agu".
 * Rows without a usable target date sort last in both directions.
 */
function compare(
  a: DerivedActionItem,
  b: DerivedActionItem,
  key: SortKey,
): number {
  switch (key) {
    case "no":
      return a.no - b.no;
    case "iapId":
      return (
        collator.compare(a.iapId, b.iapId) ||
        a.stepNo - b.stepNo
      );
    case "step":
      return (
        collator.compare(a.step, b.step) || collator.compare(a.action, b.action)
      );
    case "pic":
      return collator.compare(a.pic, b.pic);
    case "timeline":
      return collator.compare(a.timeline, b.timeline);
    case "targetDate": {
      if (a.targetIso === b.targetIso) return 0;
      if (a.targetIso === null) return 1;
      if (b.targetIso === null) return -1;
      return a.targetIso < b.targetIso ? -1 : 1;
    }
    case "status":
      return STATUS_RANK[a.status] - STATUS_RANK[b.status];
    case "progress":
      return a.progress - b.progress;
    case "overdue":
      return OVERDUE_RANK[a.overdue] - OVERDUE_RANK[b.overdue];
    case "evidence":
      return collator.compare(a.evidence, b.evidence);
  }
}

export function sortItems(
  items: readonly DerivedActionItem[],
  key: SortKey,
  direction: SortDirection,
): DerivedActionItem[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    // Rows with no target date stay at the bottom whichever way the column is sorted.
    if (key === "targetDate" && (a.targetIso === null) !== (b.targetIso === null)) {
      return a.targetIso === null ? 1 : -1;
    }
    return compare(a, b, key) * sign || a.no - b.no;
  });
}
