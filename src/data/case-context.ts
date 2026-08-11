import "server-only";

import { unstable_cache } from "next/cache";
import {
  CONTEXT_HEADER,
  contextToRow,
  hasContext,
  rowToContext,
  type CaseContext,
} from "@/domain/context";
import { getTransport } from "@/sheets";
import { CONTEXT_TAB } from "@/sheets/config";

export const CONTEXT_TAG = "case-context";

/** Row 1 is the header and is never touched. */
const FIRST_DATA_ROW = 2;
const DATA_RANGE = `${CONTEXT_TAB}!A${FIRST_DATA_ROW}:K`;

const REVALIDATE_SECONDS = 60;

/**
 * Nothing in this application creates spreadsheet tabs — growing the file's structure
 * is the operator's call, not the app's. The message says exactly what to add.
 */
const MISSING_TAB = `Tab "${CONTEXT_TAB}" belum ada di spreadsheet. Tambahkan satu tab bernama "${CONTEXT_TAB}", isi baris 1 dengan judul kolom: ${CONTEXT_HEADER.join(" | ")}. Setelah itu konteks dapat disimpan dari aplikasi.`;

interface PositionedContext {
  context: CaseContext;
  /** 1-based sheet row, derived fresh on every write — never cached. */
  rowNumber: number;
}

async function loadPositioned(): Promise<PositionedContext[]> {
  const rows = await getTransport().readRange(DATA_RANGE);
  return rows
    .map((cells, index) => ({
      context: rowToContext(cells),
      rowNumber: index + FIRST_DATA_ROW,
    }))
    .filter((row) => row.context.iapId !== "");
}

/**
 * Every case's context, keyed by `ID IAP`.
 *
 * A spreadsheet without the `Konteks` tab reads as "no context anywhere" rather than
 * as a broken page: the tracker is the thing people came for, and the tab can be
 * seeded afterwards.
 */
async function readAllUncached(): Promise<Record<string, CaseContext>> {
  let rows: PositionedContext[];
  try {
    rows = await loadPositioned();
  } catch (error) {
    console.warn(`Konteks tab unreadable, continuing without it:`, error);
    return {};
  }

  const byId: Record<string, CaseContext> = {};
  for (const { context } of rows) byId[context.iapId] = context;
  return byId;
}

export const readContexts = unstable_cache(readAllUncached, ["case-context"], {
  revalidate: REVALIDATE_SECONDS,
  tags: [CONTEXT_TAG],
});

function rowRange(rowNumber: number): string {
  return `${CONTEXT_TAB}!A${rowNumber}:K${rowNumber}`;
}

/**
 * Upsert one case's context, located by `ID IAP` rather than by a remembered row
 * index. A context with nothing in it is deleted instead of stored, so clearing the
 * form leaves no half-empty row behind.
 */
export async function saveContext(context: CaseContext): Promise<void> {
  if (!hasContext(context)) {
    await deleteContext(context.iapId);
    return;
  }

  const rows = await withTab(() => loadPositioned());
  const existing = rows.find((row) => row.context.iapId === context.iapId);
  const transport = getTransport();

  await withTab(async () => {
    if (existing) {
      await transport.writeRanges([
        { range: rowRange(existing.rowNumber), values: [contextToRow(context)] },
      ]);
    } else {
      await transport.appendRows(CONTEXT_TAB, [contextToRow(context)]);
    }
  });
}

/**
 * Deliberately quiet about a missing tab: a spreadsheet with no `Konteks` has no
 * context row to remove, and deleting a case whose tracker rows are already gone
 * must not report failure over it.
 */
export async function deleteContext(iapId: string): Promise<void> {
  let rows: PositionedContext[];
  try {
    rows = await loadPositioned();
  } catch {
    return;
  }
  const target = rows.find((row) => row.context.iapId === iapId);
  if (!target) return;
  await getTransport().deleteRows(CONTEXT_TAB, [target.rowNumber]);
}

/**
 * Turns "no such tab" into an instruction the operator can act on.
 *
 * Matching on the tab name in the message is a heuristic — Sheets reports a missing
 * tab as `Unable to parse range: Konteks!A2:K`, and any other error naming the same
 * range would be relabelled too. Both cases are spreadsheet-side and both are fixed
 * by looking at the tab, so the wrong-but-adjacent message is not worth a
 * status-code taxonomy.
 */
async function withTab<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes(CONTEXT_TAB)) throw new Error(MISSING_TAB);
    throw error;
  }
}
