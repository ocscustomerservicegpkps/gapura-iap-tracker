import "server-only";

import { cache } from "react";
import { todayInJakarta } from "@/domain/dates";
import { viewOnlyLink } from "@/domain/evidence";
import { withHealedOverdue } from "@/domain/overdue";
import {
  itemToRow,
  rowToItem,
  safeLink,
  safeLinks,
  type CellValue,
} from "@/domain/rows";
import type { ActionItem, ItemKey } from "@/domain/types";
import type { CaseInput, FieldErrors, StepInput } from "@/domain/validate";
import { getTransport } from "@/sheets";
import { TRACKER_TAB } from "@/sheets/config";
import type { RangeUpdate } from "@/sheets/transport";

/** Row 1 is the header and is never touched. */
const FIRST_DATA_ROW = 2;
const DATA_RANGE = `${TRACKER_TAB}!A${FIRST_DATA_ROW}:W`;

export type MutationResult = { ok: true } | { ok: false; errors: FieldErrors };

const failure = (field: string, message: string): MutationResult => ({
  ok: false,
  errors: { [field]: message },
});

interface PositionedItem {
  item: ActionItem;
  /** Structured case context in R–W, carried into newly-added action rows. */
  contextCells: string[];
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
      contextCells: cells.slice(17, 23).map((cell) => String(cell ?? "")),
      rowNumber: index + FIRST_DATA_ROW,
    }))
    .filter((row) => row.item.iapId !== "");
}

async function readItemsUncached(): Promise<ActionItem[]> {
  return (await loadPositioned()).map((row) => row.item);
}

/**
 * All action items, read fresh for each page render and memoised only for the
 * duration of that render, so a single render still costs a single Sheets read.
 *
 * A time-based cache used to sit here instead. Mutations made through the app
 * busted its tag, but an edit typed straight into the spreadsheet has no way to —
 * so clearing column Q by hand left the deleted links on screen for over a minute,
 * and adding one by hand did not show up either. The spreadsheet is the record;
 * the dashboard must not disagree with it.
 */
export const readItems = cache(readItemsUncached);

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
      evidenceLink: viewOnlyLinks(input.evidenceLink).join("\n"),
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
    {
      range: rowRange(target.rowNumber),
      values: [
        itemToRow({
          ...updated,
          evidenceLink: mergeEvidenceLinks(
            target.item.evidenceLink,
            updated.evidenceLink,
          ),
        }),
      ],
    },
  ]);
  return { ok: true };
}

/**
 * Saving a row rewrites A–Q in one go, which would let a stale form overwrite column
 * Q with whatever it happened to hold when the dialog opened — losing every evidence
 * link appended in the meantime, by an upload or by another author.
 *
 * `stored` is read fresh at the top of the write, so union-ing the two keeps the
 * append-only guarantee that column Q is documented to have while still letting the
 * user type a new link into the form. Removing a link is deliberately not possible
 * from the UI; that is done in the spreadsheet.
 */
function mergeEvidenceLinks(stored: string, submitted: string): string {
  const merged = viewOnlyLinks(stored);
  for (const link of viewOnlyLinks(submitted)) {
    if (!merged.includes(link)) merged.push(link);
  }
  return merged.join("\n");
}

/**
 * Every URL on its way into column Q, in the form that opens read-only. Rewriting
 * what is already stored as well as what is being added means a row that still
 * holds an old `/edit` link is repaired the next time it is saved, and that the
 * de-duplication above compares the two in the same form.
 */
function viewOnlyLinks(raw: string): string[] {
  return safeLinks(raw).map(viewOnlyLink);
}

/** Store an uploaded Drive file's share link without rewriting any other cell. */
export async function appendEvidenceLinks(
  keys: readonly ItemKey[],
  rawLink: string,
): Promise<MutationResult> {
  if (keys.length === 0) return failure("steps", "Pilih minimal satu langkah.");
  const cleanLink = safeLink(rawLink);
  if (!cleanLink || cleanLink.includes("\n")) {
    return failure("evidenceLink", "Link evidence baru harus satu URL http/https yang valid.");
  }
  const evidenceLink = viewOnlyLink(cleanLink);

  const rows = await loadPositioned();
  const updates: RangeUpdate[] = [];
  for (const key of keys) {
    const target = find(rows, key);
    if (!target) {
      return failure("form", `Item ${key.iapId} langkah ${key.stepNo} tidak ditemukan.`);
    }
    const existing = viewOnlyLinks(target.item.evidenceLink).join("\n");
    updates.push({
      range: rowRange(target.rowNumber, "Q", "Q"),
      values: [[existing ? `${existing}\n${evidenceLink}` : evidenceLink]],
    });
  }
  await getTransport().writeRanges(updates);
  return { ok: true };
}

export async function appendEvidenceLink(
  key: ItemKey,
  rawLink: string,
): Promise<MutationResult> {
  return appendEvidenceLinks([key], rawLink);
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

  const templateRow = existing.find((row) =>
    row.contextCells.some((cell) => cell !== ""),
  ) ?? existing[0]!;
  const template = templateRow.item;
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
  await transport.appendRows(TRACKER_TAB, [
    [...itemToRow(item), ...templateRow.contextCells],
  ]);
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
