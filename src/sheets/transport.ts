import type { CellValue } from "@/domain/rows";

export interface RangeUpdate {
  /** A1 notation including the tab, e.g. `Tracker!A7:O7`. */
  range: string;
  values: CellValue[][];
}

/**
 * Everything the application is allowed to do to the spreadsheet.
 *
 * Keeping this surface to four operations is what lets the same application code
 * run against the production sheet, a throwaway test sheet, or an in-memory fake —
 * the implementation is chosen by environment variable and nothing above this line
 * knows which one it got.
 */
export interface SheetsTransport {
  /** Cells as a user would see them. Rows come back trimmed of trailing blanks. */
  readRange(range: string): Promise<string[][]>;
  /** Write several disjoint ranges in one call, leaving every other cell untouched. */
  writeRanges(updates: readonly RangeUpdate[]): Promise<void>;
  /** Add rows after the last populated row of `tab`. */
  appendRows(tab: string, values: readonly CellValue[][]): Promise<void>;
  /** Remove whole rows by 1-based sheet row number. */
  deleteRows(tab: string, rowNumbers: readonly number[]): Promise<void>;
}

/** Descending contiguous runs, so deleting later rows cannot shift earlier ones. */
export function contiguousRunsDescending(
  rowNumbers: readonly number[],
): Array<{ start: number; end: number }> {
  const sorted = [...new Set(rowNumbers)].sort((a, b) => b - a);
  const runs: Array<{ start: number; end: number }> = [];
  for (const row of sorted) {
    const current = runs[runs.length - 1];
    if (current && current.start === row + 1) current.start = row;
    else runs.push({ start: row, end: row });
  }
  return runs;
}
