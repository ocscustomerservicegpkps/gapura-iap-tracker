/** Minimal A1 notation support — enough for the ranges this application uses. */

export interface ParsedRange {
  tab: string;
  /** 0-based, inclusive. */
  startColumn: number;
  /** 0-based, inclusive. */
  startRow: number;
  /** 0-based, inclusive. Null means "to the last column". */
  endColumn: number | null;
  /** 0-based, inclusive. Null means "to the last row". */
  endRow: number | null;
}

export function columnToIndex(letters: string): number {
  let index = 0;
  for (const char of letters.toUpperCase()) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index - 1;
}

const CELL = /^([A-Za-z]+)?(\d+)?$/;

export function parseRange(range: string): ParsedRange {
  const bangAt = range.lastIndexOf("!");
  if (bangAt === -1) {
    throw new Error(`Range must name a tab: ${range}`);
  }
  const tab = range.slice(0, bangAt).replace(/^'|'$/g, "");
  const [from, to] = range.slice(bangAt + 1).split(":");

  const start = CELL.exec(from ?? "");
  if (!start) throw new Error(`Unsupported range: ${range}`);
  const end = to === undefined ? start : CELL.exec(to);
  if (!end) throw new Error(`Unsupported range: ${range}`);

  return {
    tab,
    startColumn: start[1] ? columnToIndex(start[1]) : 0,
    startRow: start[2] ? Number(start[2]) - 1 : 0,
    endColumn: end[1] ? columnToIndex(end[1]) : null,
    endRow: end[2] ? Number(end[2]) - 1 : null,
  };
}
