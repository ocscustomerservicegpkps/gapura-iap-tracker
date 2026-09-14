import "server-only";

import { cache } from "react";
import {
  contextToRow,
  hasContext,
  rowToContext,
  type CaseContext,
} from "@/domain/context";
import { getTransport } from "@/sheets";
import { TRACKER_TAB } from "@/sheets/config";

const FIRST_DATA_ROW = 2;
/** B is the case ID; context is stored after Q in R:W. */
const DATA_RANGE = `${TRACKER_TAB}!B${FIRST_DATA_ROW}:W`;
/** R relative to a range beginning at B. */
const CONTEXT_OFFSET = 16;

interface PositionedContext {
  context: CaseContext;
  rowNumber: number;
}

function contextFromTrackerRow(cells: readonly unknown[]): CaseContext {
  return rowToContext([
    cells[0],
    ...cells.slice(CONTEXT_OFFSET, CONTEXT_OFFSET + 6),
  ]);
}

async function loadPositioned(): Promise<PositionedContext[]> {
  const rows = await getTransport().readRange(DATA_RANGE);
  return rows
    .map((cells, index) => ({
      context: contextFromTrackerRow(cells),
      rowNumber: index + FIRST_DATA_ROW,
    }))
    .filter((row) => row.context.iapId !== "");
}

/** Context is duplicated on every Tracker row of a case; one populated copy is enough. */
async function readAllUncached(): Promise<Record<string, CaseContext>> {
  const byId: Record<string, CaseContext> = {};
  for (const { context } of await loadPositioned()) {
    if (hasContext(context)) byId[context.iapId] = context;
  }
  return byId;
}

/** Read fresh per render, for the same reason {@link readItems} is. */
export const readContexts = cache(readAllUncached);

function rowRange(rowNumber: number): string {
  return `${TRACKER_TAB}!R${rowNumber}:W${rowNumber}`;
}

/** Write the six context fields to every action row belonging to the case. */
export async function saveContext(context: CaseContext): Promise<void> {
  const targets = (await loadPositioned()).filter(
    (row) => row.context.iapId === context.iapId,
  );
  if (targets.length === 0) {
    throw new Error(`Kasus ${context.iapId} tidak ditemukan di tab ${TRACKER_TAB}.`);
  }

  const values = hasContext(context)
    ? contextToRow(context).slice(1)
    : ["", "", "", "", "", ""];
  await getTransport().writeRanges(
    targets.map(({ rowNumber }) => ({
      range: rowRange(rowNumber),
      values: [values],
    })),
  );
}

/** Clearing a context leaves the Tracker rows intact and blanks only R:W. */
export async function deleteContext(iapId: string): Promise<void> {
  const targets = (await loadPositioned()).filter(
    (row) => row.context.iapId === iapId,
  );
  if (targets.length === 0) return;
  await getTransport().writeRanges(
    targets.map(({ rowNumber }) => ({
      range: rowRange(rowNumber),
      values: [["", "", "", "", "", ""]],
    })),
  );
}
