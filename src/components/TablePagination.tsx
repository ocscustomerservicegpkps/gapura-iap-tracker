"use client";

import { useId } from "react";
import {
  pageTokens,
  ROW_PAGE_SIZES,
  toPageSize,
  type PageSize,
} from "@/domain/pagination";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

interface TablePaginationProps {
  /** Rows matching the current filter. */
  matched: number;
  /** Rows in the tracker before any filter, for the "x of y" line. */
  total: number;
  page: number;
  pageCount: number;
  pageSize: PageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
}

/**
 * The tracker table's footer: what is on screen, how much of it fits on a page, and
 * the way to the next one. Replaces the infinite-scroll sentinel, so the number of
 * rows in the DOM is a choice the reader makes rather than a side effect of scrolling.
 *
 * Controls are labelled in English, matching the status and overdue pills; the
 * surrounding table keeps its Indonesian headings.
 */
export function TablePagination({
  matched,
  total,
  page,
  pageCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  const sizeId = useId();
  const paged = matched > 0 && pageCount > 1;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-t border-line px-3 py-2.5 sm:px-4">
      {/* Filtering changes this line and nothing else visible above the fold, so
          it announces itself rather than waiting to be re-read. */}
      <p
        className="text-[12px] text-faint"
        role="status"
        aria-live="polite"
        data-testid="result-count"
      >
        Menampilkan {matched} dari {total} item aksi.
      </p>

      {matched > 0 ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="flex items-center gap-2">
            <label
              htmlFor={sizeId}
              className="text-[12px] whitespace-nowrap text-label"
            >
              Rows per page
            </label>
            <select
              id={sizeId}
              data-testid="page-size"
              className="field min-h-[34px] w-auto py-1 pr-7 pl-2 text-[12px]"
              value={String(pageSize)}
              onChange={(event) => onPageSizeChange(toPageSize(event.target.value))}
            >
              {ROW_PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
              <option value="case">One IAP case</option>
              <option value="all">All</option>
            </select>
          </div>

          {paged ? (
            <nav
              aria-label="Tracker table pages"
              className="flex items-center gap-1"
            >
              <Step
                direction="prev"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              />

              {/* Numbered pages are the fastest way across nine cases, but they are
                  the first thing to go when the bar has to share a phone with the
                  count line. */}
              <ol className="hidden items-center gap-1 sm:flex">
                {pageTokens(page, pageCount).map((token, index) =>
                  token === "gap" ? (
                    <li
                      key={`gap-${index}`}
                      aria-hidden
                      className="px-1 text-[12px] text-faint"
                    >
                      …
                    </li>
                  ) : (
                    <li key={token}>
                      <PageButton
                        page={token}
                        current={token === page}
                        pageSize={pageSize}
                        onClick={() => onPageChange(token)}
                      />
                    </li>
                  ),
                )}
              </ol>

              <p className="px-1 text-[12px] whitespace-nowrap text-ink-mid sm:hidden">
                {pageSize === "case" ? "Case" : "Page"} {page} of {pageCount}
              </p>

              <Step
                direction="next"
                disabled={page >= pageCount}
                onClick={() => onPageChange(page + 1)}
              />
            </nav>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Step({
  direction,
  disabled,
  onClick,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  const previous = direction === "prev";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      data-testid={`page-${direction}`}
      aria-label={previous ? "Previous page" : "Next page"}
      className="flex min-h-[34px] min-w-[34px] cursor-pointer items-center justify-center gap-1 rounded-[7px] border border-line-strong bg-surface px-2 text-[12px] font-semibold text-ink-mid transition-colors duration-150 hover:bg-head disabled:cursor-not-allowed disabled:border-line-soft disabled:bg-transparent disabled:text-faint disabled:opacity-60"
    >
      {previous ? <ChevronLeftIcon size={13} /> : null}
      <span className="hidden sm:inline">{previous ? "Previous" : "Next"}</span>
      {previous ? null : <ChevronRightIcon size={13} />}
    </button>
  );
}

function PageButton({
  page,
  current,
  pageSize,
  onClick,
}: {
  page: number;
  current: boolean;
  pageSize: PageSize;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`page-${page}`}
      aria-current={current ? "page" : undefined}
      aria-label={`${pageSize === "case" ? "Case" : "Page"} ${page}`}
      className={`flex min-h-[34px] min-w-[34px] cursor-pointer items-center justify-center rounded-[7px] border px-1.5 text-[12px] tabular-nums transition-colors duration-150 ${
        current
          ? "border-accent bg-accent font-bold text-[oklch(100%_0_0)]"
          : "border-line-strong bg-surface font-semibold text-ink-mid hover:bg-head"
      }`}
    >
      {page}
    </button>
  );
}
