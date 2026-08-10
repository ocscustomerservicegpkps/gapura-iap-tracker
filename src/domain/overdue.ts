import { daysBetween, parseTrackerDate } from "./dates";
import type { ActionItem, DerivedActionItem, OverdueFlag } from "./types";

/**
 * Column N is derived, never read.
 *
 * - `Selesai` → `-`, so closed work is never counted as late.
 * - target date already passed → `TERLAMBAT`.
 * - otherwise → `Sesuai Rencana`, including rows with no usable target date;
 *   nothing has been missed if no date was committed to.
 */
export function deriveOverdue(
  item: Pick<ActionItem, "status" | "targetDate">,
  today: string,
): OverdueFlag {
  if (item.status === "Selesai") return "-";
  const target = parseTrackerDate(item.targetDate);
  if (!target) return "Sesuai Rencana";
  return target < today ? "TERLAMBAT" : "Sesuai Rencana";
}

export function deriveItem(item: ActionItem, today: string): DerivedActionItem {
  const targetIso = parseTrackerDate(item.targetDate);
  return {
    ...item,
    overdue: deriveOverdue(item, today),
    targetIso,
    actualIso: parseTrackerDate(item.actualDate),
    daysToTarget: targetIso ? daysBetween(today, targetIso) : null,
  };
}

export function deriveItems(
  items: readonly ActionItem[],
  today: string,
): DerivedActionItem[] {
  return items.map((item) => deriveItem(item, today));
}

/** An open item falling due within `days` — the window the "jatuh tempo" filter uses. */
export function isDueWithin(item: DerivedActionItem, days: number): boolean {
  if (item.status === "Selesai") return false;
  if (item.daysToTarget === null) return false;
  return item.daysToTarget >= 0 && item.daysToTarget <= days;
}

/** The row as it should be stored, with column N healed. */
export function withHealedOverdue<T extends ActionItem>(
  item: T,
  today: string,
): T {
  return { ...item, storedOverdue: deriveOverdue(item, today) };
}
