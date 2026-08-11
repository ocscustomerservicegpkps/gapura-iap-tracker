import "server-only";

import { unstable_cache } from "next/cache";
import { todayInJakarta } from "@/domain/dates";
import { withHealedOverdue } from "@/domain/overdue";
import { itemToRow, rowToItem, type CellValue } from "@/domain/rows";
import type { ActionItem, ItemKey } from "@/domain/types";
import type { CaseInput, FieldErrors, StepInput } from "@/domain/validate";
import { getTransport } from "@/sheets";
import { TRACKER_TAB } from "@/sheets/config";
import type { RangeUpdate } from "@/sheets/transport";

export const TRACKER_TAG = "tracker";

/** Row 1 is the header and is never touched. */
const FIRST_DATA_ROW = 2;
const DATA_RANGE = `${TRACKER_TAB}!A${FIRST_DATA_ROW}:Q`;

/** Cache window. One Sheets read serves every visitor inside it. */
const REVALIDATE_SECONDS = 60;

export type MutationResult = { ok: true } | { ok: false; errors: FieldErrors };

const failure = (field: string, message: string): MutationResult => ({
  ok: false,
  errors: { [field]: message },
});

interface PositionedItem {
  item: ActionItem;
  /** 1-based sheet row. The only place row numbers exist; never cached. */
  rowNumber: number;
}

/**
 * Every write re-reads the sheet and locates its target by the composite key
 * `(ID IAP, No Langkah)`. Row positions are derived fresh each time and never
 * carried across a request, which is what makes a save land on the right row even
 * when someone else has inserted or removed rows in between.
 */
async function loadPositioned(): Promise<PositionedItem[]> {
  const rows = await getTransport().readRange(DATA_RANGE);
  return rows
    .map((cells, index) => ({
      item: rowToItem(cells),
      rowNumber: index + FIRST_DATA_ROW,
    }))
    .filter((row) => row.item.iapId !== "");
}

async function readItemsUncached(): Promise<ActionItem[]> {
  return (await loadPositioned()).map((row) => row.item);
}

/**
 * All action items, cached for {@link REVALIDATE_SECONDS}. Mutations bust the tag,
 * so an author sees their own edit at once while a change made directly in the
 * spreadsheet shows up within about a minute.
 */
export const readItems = unstable_cache(readItemsUncached, ["tracker-items"], {
  revalidate: REVALIDATE_SECONDS,
  tags: [TRACKER_TAG],
});

function rowRange(rowNumber: number, from = "A", to = "Q"): string {
  return `${TRACKER_TAB}!${from}${rowNumber}:${to}${rowNumber}`;
}

function find(rows: PositionedItem[], key: ItemKey): PositionedItem | undefined {
  return rows.find(
    (row) => row.item.iapId === key.iapId && row.item.stepNo === key.stepNo,
  );
}

function rowsOfCase(rows: PositionedItem[], iapId: string): PositionedItem[] {
  return rows.filter((row) => row.item.iapId === iapId);
}

/**
 * Column A is a global 1..N sequence, rewritten after a create or delete so it stays
 * contiguous.
 *
 * Each drifted row is addressed individually rather than as one block: `rowNumber`s
 * come from a list that has had blank rows filtered out, so they are not guaranteed
 * to be consecutive, and a single block write would land a row short from the first
 * gap onwards. Column N is healed in the same batch, since these rows are being
 * written anyway.
 */
async function renumber(rows: PositionedItem[]): Promise<void> {
  const today = todayInJakarta();
  const updates: RangeUpdate[] = [];

  rows.forEach(({ item, rowNumber }, index) => {
    const no = index + 1;
    if (item.no !== no) {
      updates.push({
        range: rowRange(rowNumber, "A", "A"),
        values: [[no] satisfies CellValue[]],
      });
    }
    const healed = withHealedOverdue(item, today);
    if (healed.storedOverdue !== item.storedOverdue) {
      updates.push({
        range: rowRange(rowNumber, "N", "N"),
        values: [[healed.storedOverdue]],
      });
    }
  });

  await getTransport().writeRanges(updates);
}

function applyStep(
  item: ActionItem,
  input: StepInput,
  today: string,
): ActionItem {
  return withHealedOverdue(
    {
      ...item,
      step: input.step,
      action: input.action,
      pic: input.pic,
      timeline: input.timeline,
      targetDate: input.targetDate,
      status: input.status,
      progress: input.progress,
      actualDate: input.actualDate,
      evidence: input.evidence,
      evidenceLink: input.evidenceLink,
    },
    today,
  );
}

/** Save one action item. Writes exactly one row. */
export async function updateStep(
  key: ItemKey,
  input: StepInput,
): Promise<MutationResult> {
  const rows = await loadPositioned();
  const target = find(rows, key);
  if (!target) {
    return failure("form", `Item ${key.iapId} langkah ${key.stepNo} tidak ditemukan.`);
  }

  const updated = applyStep(target.item, input, todayInJakarta());
  await getTransport().writeRanges([
    { range: rowRange(target.rowNumber), values: [itemToRow(updated)] },
  ]);
  return { ok: true };
}

/** Add a step to an existing case. The step number is assigned as max+1. */
export async function createStep(
  iapId: string,
  input: StepInput,
): Promise<MutationResult> {
  const rows = await loadPositioned();
  const existing = rowsOfCase(rows, iapId);
  if (existing.length === 0) {
    return failure("iapId", `Kasus ${iapId} tidak ditemukan.`);
  }

  const template = existing[0]!.item;
  const nextStepNo = Math.max(...existing.map((row) => row.item.stepNo)) + 1;
  const item = applyStep(
    {
      ...template,
      no: rows.length + 1,
      stepNo: nextStepNo,
      storedOverdue: "",
    },
    input,
    todayInJakarta(),
  );

  const transport = getTransport();
  await transport.appendRows(TRACKER_TAB, [itemToRow(item)]);
  await renumber(await loadPositioned());
  return { ok: true };
}

export async function deleteStep(key: ItemKey): Promise<MutationResult> {
  const rows = await loadPositioned();
  const target = find(rows, key);
  if (!target) {
    return failure("form", `Item ${key.iapId} langkah ${key.stepNo} tidak ditemukan.`);
  }

  const transport = getTransport();
  await transport.deleteRows(TRACKER_TAB, [target.rowNumber]);
  await renumber(await loadPositioned());
  return { ok: true };
}

/** Register a new case and all of its steps in one batch. */
export async function createCase(input: CaseInput): Promise<MutationResult> {
  const rows = await loadPositioned();
  if (rowsOfCase(rows, input.iapId).length > 0) {
    return failure(
      "iapId",
      `ID IAP "${input.iapId}" sudah digunakan oleh kasus lain.`,
    );
  }

  const today = todayInJakarta();
  const blank: ActionItem = {
    no: 0,
    iapId: input.iapId,
    title: input.title,
    station: input.station,
    stepNo: 0,
    step: "",
    action: "",
    pic: "",
    timeline: "",
    targetDate: "",
    status: "Belum Dimulai",
    progress: 0,
    actualDate: "",
    storedOverdue: "",
    evidence: "",
    contextNote: "",
    evidenceLink: "",
  };

  const newRows = input.steps.map((step, index) =>
    itemToRow(
      applyStep(
        { ...blank, no: rows.length + index + 1, stepNo: index + 1 },
        step,
        today,
      ),
    ),
  );

  const transport = getTransport();
  await transport.appendRows(TRACKER_TAB, newRows);
  await renumber(await loadPositioned());
  return { ok: true };
}

/**
 * Retitle or restation a case. Case metadata is denormalised across the case's
 * rows, so every one of them is rewritten in a single batch and they cannot drift.
 * Column N is healed at the same time.
 */
export async function updateCaseMeta(
  iapId: string,
  title: string,
  station: string,
): Promise<MutationResult> {
  const rows = await loadPositioned();
  const affected = rowsOfCase(rows, iapId);
  if (affected.length === 0) {
    return failure("iapId", `Kasus ${iapId} tidak ditemukan.`);
  }

  const today = todayInJakarta();
  const updates: RangeUpdate[] = [];
  for (const { item, rowNumber } of affected) {
    updates.push({
      range: rowRange(rowNumber, "C", "D"),
      values: [[title, station]],
    });
    const healed = withHealedOverdue(item, today);
    if (healed.storedOverdue !== item.storedOverdue) {
      updates.push({
        range: rowRange(rowNumber, "N", "N"),
        values: [[healed.storedOverdue]],
      });
    }
  }

  await getTransport().writeRanges(updates);
  return { ok: true };
}

export async function deleteCase(iapId: string): Promise<MutationResult> {
  const rows = await loadPositioned();
  const affected = rowsOfCase(rows, iapId);
  if (affected.length === 0) {
    return failure("iapId", `Kasus ${iapId} tidak ditemukan.`);
  }

  const transport = getTransport();
  await transport.deleteRows(
    TRACKER_TAB,
    affected.map((row) => row.rowNumber),
  );
  await renumber(await loadPositioned());
  return { ok: true };
}
