import type { DerivedActionItem } from "./types";

/** Fixed row counts the tracker offers in its "rows per page" control. */
export const ROW_PAGE_SIZES = [10, 25, 50] as const;

/**
 * How much of the filtered set one page holds. A number is a fixed row count;
 * `"all"` is every matching row at once; `"case"` puts one whole IAP case on a page,
 * so a case is never split across a page boundary.
 */
export type PageSize = (typeof ROW_PAGE_SIZES)[number] | "all" | "case";

export const DEFAULT_PAGE_SIZE: PageSize = 10;

/** Reads a `<select>` value back as a `PageSize`; anything else is the default. */
export function toPageSize(value: string): PageSize {
  if (value === "all" || value === "case") return value;
  const size = Number(value);
  return (ROW_PAGE_SIZES as readonly number[]).includes(size)
    ? (size as PageSize)
    : DEFAULT_PAGE_SIZE;
}

/** One IAP case and the rows of it that survived the current filter, in order. */
export interface CaseGroup {
  iapId: string;
  rows: DerivedActionItem[];
}

/**
 * Rows bucketed by case in first-appearance order, so the active sort still decides
 * which case comes first and how the items inside it are ordered.
 */
export function groupByCase(rows: readonly DerivedActionItem[]): CaseGroup[] {
  const groups = new Map<string, CaseGroup>();
  for (const row of rows) {
    const group = groups.get(row.iapId);
    if (group) group.rows.push(row);
    else groups.set(row.iapId, { iapId: row.iapId, rows: [row] });
  }
  return [...groups.values()];
}

export interface PagedRows {
  /** The current page's rows, grouped by case and ready to render. */
  groups: CaseGroup[];
  /** 1-based, clamped into `1..pageCount`, so a deleted last row cannot strand the view. */
  page: number;
  pageCount: number;
  /** 1-based position of this page's first and last row in the filtered set; 0 when empty. */
  from: number;
  to: number;
  /** Rows matching the filter, across every page. */
  total: number;
}

function clamp(page: number, pageCount: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(Math.trunc(page), 1), pageCount);
}

/**
 * The slice of `rows` the requested page shows. `requested` is trusted for intent
 * only — it is clamped against the page count that the current filter actually
 * produces, so shrinking the result set lands on the last real page rather than on
 * an empty one.
 */
export function paginate(
  rows: readonly DerivedActionItem[],
  size: PageSize,
  requested: number,
): PagedRows {
  const total = rows.length;

  if (size === "case") {
    const cases = groupByCase(rows);
    const pageCount = Math.max(1, cases.length);
    const page = clamp(requested, pageCount);
    const group = cases[page - 1];
    // Where this case starts in the flat filtered order, so "from"/"to" stay
    // comparable with the fixed-count modes.
    const before = cases
      .slice(0, page - 1)
      .reduce((count, one) => count + one.rows.length, 0);
    const length = group?.rows.length ?? 0;

    return {
      groups: group ? [group] : [],
      page,
      pageCount,
      from: length ? before + 1 : 0,
      to: before + length,
      total,
    };
  }

  const perPage = size === "all" ? Math.max(total, 1) : size;
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const page = clamp(requested, pageCount);
  const start = (page - 1) * perPage;
  const slice = rows.slice(start, start + perPage);

  return {
    groups: groupByCase(slice),
    page,
    pageCount,
    from: slice.length ? start + 1 : 0,
    to: start + slice.length,
    total,
  };
}

/** A rendered page number, or the run of numbers a gap stands in for. */
export type PageToken = number | "gap";

/**
 * The page numbers worth rendering: always the first and the last, always the
 * current one and its neighbours, with one gap standing in for each omitted run.
 * Short pagers list every page, which covers this tracker's usual nine cases.
 */
export function pageTokens(
  page: number,
  pageCount: number,
  radius = 2,
): PageToken[] {
  if (pageCount <= 5 + radius * 2) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const wanted = new Set<number>([1, pageCount]);
  for (let near = page - radius; near <= page + radius; near++) {
    if (near >= 1 && near <= pageCount) wanted.add(near);
  }

  const tokens: PageToken[] = [];
  let previous = 0;
  for (const number of [...wanted].sort((a, b) => a - b)) {
    if (previous && number - previous > 1) tokens.push("gap");
    tokens.push(number);
    previous = number;
  }
  return tokens;
}
