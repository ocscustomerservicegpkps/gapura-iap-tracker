import type { CellValue } from "@/domain/rows";
import { parseRange } from "./a1";
import {
  contiguousRunsDescending,
  type RangeUpdate,
  type SheetsTransport,
} from "./transport";

/**
 * An in-memory stand-in for the spreadsheet.
 *
 * It reproduces the two behaviours of the real API that application code has to
 * cope with: rows are returned trimmed of trailing blank cells, and trailing blank
 * rows are dropped entirely. Anything that works here works against Sheets.
 */
export class MemorySheetsTransport implements SheetsTransport {
  private tabs = new Map<string, string[][]>();

  constructor(initial: Record<string, readonly (readonly CellValue[])[]> = {}) {
    this.reset(initial);
  }

  reset(initial: Record<string, readonly (readonly CellValue[])[]>): void {
    this.tabs = new Map(
      Object.entries(initial).map(([tab, rows]) => [
        tab,
        rows.map((row) => row.map(stringify)),
      ]),
    );
  }

  /** Full grid for a tab, for assertions that need to see raw storage. */
  snapshot(tab: string): string[][] {
    return (this.tabs.get(tab) ?? []).map((row) => [...row]);
  }

  async readRange(range: string): Promise<string[][]> {
    const { tab, startColumn, startRow, endColumn, endRow } = parseRange(range);
    const grid = this.tabs.get(tab);
    if (!grid) return [];

    const lastRow = endRow ?? grid.length - 1;
    const slice: string[][] = [];
    for (let r = startRow; r <= Math.min(lastRow, grid.length - 1); r += 1) {
      const row = grid[r] ?? [];
      const lastColumn = endColumn ?? Math.max(row.length - 1, startColumn);
      const cells: string[] = [];
      for (let c = startColumn; c <= lastColumn; c += 1) cells.push(row[c] ?? "");
      slice.push(trimTrailingBlanks(cells));
    }
    return dropTrailingBlankRows(slice);
  }

  async writeRanges(updates: readonly RangeUpdate[]): Promise<void> {
    for (const update of updates) {
      const { tab, startColumn, startRow } = parseRange(update.range);
      const grid = this.ensureTab(tab);
      update.values.forEach((row, rowOffset) => {
        const target = this.ensureRow(grid, startRow + rowOffset);
        row.forEach((value, columnOffset) => {
          setCell(target, startColumn + columnOffset, stringify(value));
        });
      });
    }
  }

  async appendRows(
    tab: string,
    values: readonly (readonly CellValue[])[],
  ): Promise<void> {
    const grid = this.ensureTab(tab);
    while (grid.length > 0 && isBlankRow(grid[grid.length - 1]!)) grid.pop();
    for (const row of values) grid.push(row.map(stringify));
  }

  async deleteRows(tab: string, rowNumbers: readonly number[]): Promise<void> {
    const grid = this.ensureTab(tab);
    for (const { start, end } of contiguousRunsDescending(rowNumbers)) {
      grid.splice(start - 1, end - start + 1);
    }
  }

  private ensureTab(tab: string): string[][] {
    let grid = this.tabs.get(tab);
    if (!grid) {
      grid = [];
      this.tabs.set(tab, grid);
    }
    return grid;
  }

  private ensureRow(grid: string[][], index: number): string[] {
    while (grid.length <= index) grid.push([]);
    return grid[index]!;
  }
}

function stringify(value: CellValue | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

function setCell(row: string[], index: number, value: string): void {
  while (row.length <= index) row.push("");
  row[index] = value;
}

function trimTrailingBlanks(cells: string[]): string[] {
  const copy = [...cells];
  while (copy.length > 0 && copy[copy.length - 1] === "") copy.pop();
  return copy;
}

function isBlankRow(row: readonly string[]): boolean {
  return row.every((cell) => cell === "");
}

function dropTrailingBlankRows(rows: string[][]): string[][] {
  const copy = [...rows];
  while (copy.length > 0 && isBlankRow(copy[copy.length - 1]!)) copy.pop();
  return copy;
}
