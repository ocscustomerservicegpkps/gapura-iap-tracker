"use client";

import { useMemo, useRef } from "react";
import { summariseByCase } from "@/domain/aggregate";
import type { SortDirection, SortKey } from "@/domain/filter";
import { paginate, type CaseGroup, type PageSize } from "@/domain/pagination";
import type { CaseSummary, DerivedActionItem } from "@/domain/types";
import { EditIcon, NoResultsIcon, SortIcon, TrashIcon } from "./icons";
import {
  OVERDUE_LABEL,
  OVERDUE_PILL,
  progressColor,
  STATUS_LABEL,
  STATUS_PILL,
} from "./status-styles";
import { TablePagination } from "./TablePagination";

interface ActionTableProps {
  rows: readonly DerivedActionItem[];
  /** Rows in the tracker before any filter, for the count under the table. */
  total: number;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
  onEdit: (item: DerivedActionItem) => void;
  onDelete: (item: DerivedActionItem) => void;
  page: number;
  pageSize: PageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
  /** Whether anything is filtered, which decides what the empty state offers. */
  filtered: boolean;
  onClearFilters: () => void;
}

/**
 * Percentage widths on a fixed layout: every column keeps its share of the
 * container, text wraps instead of truncating, and nothing scrolls sideways. The
 * case column carries only the ID and station because the band above each group
 * already states the case in full.
 */
const COLUMNS: Array<{ key: SortKey; label: string; width: string }> = [
  { key: "no", label: "No", width: "3%" },
  { key: "iapId", label: "Kasus / Stasiun", width: "11%" },
  { key: "step", label: "Langkah & Detail Tindakan", width: "22%" },
  { key: "pic", label: "PIC", width: "9%" },
  { key: "timeline", label: "Linimasa", width: "7%" },
  { key: "targetDate", label: "Target", width: "8%" },
  { key: "status", label: "Status", width: "9%" },
  { key: "progress", label: "Progres", width: "8%" },
  { key: "overdue", label: "Overdue", width: "6%" },
  { key: "evidence", label: "Bukti / Catatan", width: "10%" },
];

const ACTIONS_WIDTH = "7%";

export function ActionTable({
  rows,
  total,
  sortKey,
  sortDirection,
  onSort,
  onEdit,
  onDelete,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  filtered,
  onClearFilters,
}: ActionTableProps) {
  const container = useRef<HTMLElement>(null);

  const paged = useMemo(
    () => paginate(rows, pageSize, page),
    [rows, pageSize, page],
  );

  /**
   * Per-case totals across the whole filtered set, not the page slice — a band
   * reading "3 item" above a case that actually has nine would be a lie the moment
   * the case straddles a page boundary.
   */
  const summaries = useMemo(() => {
    const byId = new Map<string, CaseSummary>();
    for (const summary of summariseByCase(rows)) byId.set(summary.iapId, summary);
    return byId;
  }, [rows]);

  /**
   * Paging from the bottom of a long page otherwise lands the reader at the bottom
   * of the next one. Only pulls up when the table has already scrolled past.
   */
  const goToPage = (next: number) => {
    onPageChange(next);
    const node = container.current;
    if (!node || node.getBoundingClientRect().top >= 0) return;
    node.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  };

  const footer = (
    <TablePagination
      matched={rows.length}
      total={total}
      page={paged.page}
      pageCount={paged.pageCount}
      pageSize={pageSize}
      onPageChange={goToPage}
      onPageSizeChange={onPageSizeChange}
    />
  );

  if (rows.length === 0) {
    return (
      <section className="card scroll-mt-4" ref={container}>
        <div
          className="flex flex-col items-center px-6 py-12 text-center"
          data-testid="empty-state"
        >
          <NoResultsIcon className="text-[oklch(76%_0.012_250)]" />
          <p className="mt-3 text-[14px] font-semibold text-ink">
            Tidak ada item aksi yang cocok
          </p>
          <p className="mt-1 max-w-[42ch] text-[12.5px] leading-relaxed text-faint">
            {filtered
              ? "Coba kata kunci lain, atau longgarkan filter di atas tabel."
              : "Tracker masih kosong. Tambahkan kasus IAP untuk mulai memantau tindakan perbaikan."}
          </p>
          {filtered ? (
            <button
              type="button"
              className="btn mt-4"
              onClick={onClearFilters}
              data-testid="empty-clear-filters"
            >
              Hapus semua filter
            </button>
          ) : null}
        </div>
        {footer}
      </section>
    );
  }

  return (
    <section className="card scroll-mt-4" ref={container}>
      {/* Desktop: every column fits the container width; long text wraps. */}
      <div className="hidden md:block" data-testid="table-view">
        <table className="w-full table-fixed border-collapse text-[12px] [&_td]:break-words [&_td_.pill]:whitespace-normal">
          <caption className="sr-only">
            Seluruh item aksi, dikelompokkan per kasus IAP. Judul kolom dapat
            diklik untuk mengurutkan.
          </caption>
          <thead>
            <tr>
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    sortKey === column.key
                      ? sortDirection === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  style={{ width: column.width }}
                  className={`${HEAD_CELL} p-0`}
                >
                  {/* The button fills the header cell: the whole label is the
                      target, and it clears the 24px minimum on its own. */}
                  <button
                    type="button"
                    onClick={() => onSort(column.key)}
                    data-testid={`sort-${column.key}`}
                    className={`flex w-full min-h-[34px] cursor-pointer items-center gap-1.5 px-2 py-1.5 text-left font-semibold transition-colors duration-150 hover:text-ink ${
                      sortKey === column.key ? "text-ink" : ""
                    }`}
                  >
                    {column.label}
                    <SortIcon
                      active={sortKey === column.key}
                      direction={sortDirection}
                    />
                  </button>
                </th>
              ))}
              <th
                scope="col"
                style={{ width: ACTIONS_WIDTH }}
                className={`${HEAD_CELL} px-2 py-1.5 text-right`}
              >
                Aksi
              </th>
            </tr>
          </thead>

          {paged.groups.map((group, index) => (
            <tbody
              // Re-keyed per page so the fade marks the page turn, not every re-render.
              key={`${paged.page}-${group.iapId}`}
              data-testid={`group-${group.iapId}`}
              className="animate-page-in"
            >
              <tr>
                <th
                  colSpan={COLUMNS.length + 1}
                  scope="colgroup"
                  // The header already draws the rule above the first band.
                  className={`bg-head px-2.5 py-2 text-left ${
                    index === 0 ? "" : "border-t border-line-strong"
                  }`}
                >
                  <CaseBand summary={summaries.get(group.iapId)} group={group} />
                </th>
              </tr>

              {group.rows.map((row) => (
                <tr
                  key={`${row.iapId}-${row.stepNo}`}
                  className="border-b border-line-soft align-top transition-colors duration-150 last:border-b-0 hover:bg-head/60"
                  data-testid={`row-${row.iapId}-${row.stepNo}`}
                >
                  <td className="px-2 py-2 tabular-nums text-label">{row.no}</td>
                  <td className="px-2 py-2">
                    <div className="font-mono text-[11.5px] font-bold text-ink">
                      {row.iapId}
                    </div>
                    <div className="mt-0.5 text-[11px] leading-snug text-faint">
                      {row.station}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="font-semibold text-ink">
                      Langkah {row.stepNo}: {row.step}
                    </div>
                    <div className="mt-1 text-[11.5px] leading-relaxed text-muted">
                      {row.action}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-ink-mid">{row.pic}</td>
                  <td className="px-2 py-2 text-idle">{row.timeline}</td>
                  <td
                    className={`px-2 py-2 tabular-nums ${
                      row.overdue === "TERLAMBAT"
                        ? "font-semibold text-late-ink"
                        : "text-ink-mid"
                    }`}
                    data-testid={`target-${row.iapId}-${row.stepNo}`}
                  >
                    {row.targetDate}
                  </td>
                  <td className="px-2 py-2">
                    <span className={`pill ${STATUS_PILL[row.status]}`}>
                      {STATUS_LABEL[row.status]}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <ProgressBar value={row.progress} />
                  </td>
                  <td className="px-2 py-2">
                    <span
                      className={`pill ${OVERDUE_PILL[row.overdue]}`}
                      data-testid={`overdue-${row.iapId}-${row.stepNo}`}
                    >
                      {OVERDUE_LABEL[row.overdue]}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-[11.5px] leading-relaxed text-idle">
                    {row.evidence}
                    <EvidenceLink item={row} />
                  </td>
                  <td className="px-2 py-2">
                    {/* Wraps rather than squeezing: below roughly 1000px the
                        column cannot hold both targets side by side. */}
                    <div className="flex flex-wrap justify-end gap-1">
                      <RowButton
                        onClick={() => onEdit(row)}
                        testId={`edit-${row.iapId}-${row.stepNo}`}
                        label={`Ubah langkah ${row.stepNo} kasus ${row.iapId}`}
                      >
                        <EditIcon />
                      </RowButton>
                      <RowButton
                        onClick={() => onDelete(row)}
                        testId={`delete-${row.iapId}-${row.stepNo}`}
                        label={`Hapus langkah ${row.stepNo} kasus ${row.iapId}`}
                        danger
                      >
                        <TrashIcon />
                      </RowButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      {/* Phones: one row per item, stacked, so a row is readable without panning
          sideways. Dividers rather than nested cards — the section is the card. */}
      <ul className="md:hidden" data-testid="card-view">
        {paged.groups.map((group, index) => (
          <li
            key={`${paged.page}-${group.iapId}`}
            className={`animate-page-in ${
              index === 0 ? "" : "border-t border-line-strong"
            }`}
          >
            <h3 className="bg-head px-4 py-2.5">
              <CaseBand summary={summaries.get(group.iapId)} group={group} />
            </h3>
            <ul className="divide-y divide-line-soft border-t border-line-strong">
              {group.rows.map((row) => (
                <li
                  key={`${row.iapId}-${row.stepNo}`}
                  className="px-4 py-3.5"
                  data-testid={`card-${row.iapId}-${row.stepNo}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-[11.5px] font-bold text-ink">
                        {row.iapId}
                      </div>
                      <div className="mt-0.5 text-[11px] leading-snug text-faint">
                        {row.station}
                      </div>
                    </div>
                    <span className="tabular-nums text-[11px] text-faint">
                      #{row.no}
                    </span>
                  </div>

                  <div className="mt-2.5 text-[13px] font-semibold text-ink">
                    Langkah {row.stepNo}: {row.step}
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted">
                    {row.action}
                  </p>

                  <dl className="mt-3 grid grid-cols-2 gap-2 text-[11.5px]">
                    <CardField label="PIC" value={row.pic} />
                    <CardField label="Linimasa" value={row.timeline} />
                    <CardField
                      label="Tanggal Target"
                      value={row.targetDate || "—"}
                      tone={
                        row.overdue === "TERLAMBAT"
                          ? "font-semibold text-late-ink"
                          : undefined
                      }
                    />
                    <CardField
                      label="Tanggal Selesai"
                      value={row.actualDate || "—"}
                    />
                  </dl>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={`pill ${STATUS_PILL[row.status]}`}>
                      {STATUS_LABEL[row.status]}
                    </span>
                    <span className={`pill ${OVERDUE_PILL[row.overdue]}`}>
                      {OVERDUE_LABEL[row.overdue]}
                    </span>
                    <span className="flex-1" />
                    <ProgressBar value={row.progress} />
                  </div>

                  {row.evidence || row.evidenceLink ? (
                    <p className="mt-2.5 border-t border-line-soft pt-2.5 text-[11.5px] leading-relaxed text-idle">
                      {row.evidence}
                      <EvidenceLink item={row} prefix="card-" />
                    </p>
                  ) : null}

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      className="btn flex-1"
                      onClick={() => onEdit(row)}
                      data-testid={`card-edit-${row.iapId}-${row.stepNo}`}
                    >
                      Ubah
                    </button>
                    <button
                      type="button"
                      className="btn text-late-ink"
                      onClick={() => onDelete(row)}
                      data-testid={`card-delete-${row.iapId}-${row.stepNo}`}
                    >
                      Hapus
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {footer}
    </section>
  );
}

/**
 * Sticky, so the column meanings survive a 50-row page. `border-collapse` drops the
 * borders of a stuck cell, so the rule under the header is an inset shadow instead.
 */
const HEAD_CELL =
  "sticky top-0 z-10 bg-head text-left font-semibold text-idle-ink shadow-[inset_0_-1px_0_var(--color-line-strong)]";

/**
 * The band above each case: what the case is, how much of it the filter matched,
 * and how far along it is — so the reader orients without going back to the summary
 * table. Shared by both layouts so the two never drift.
 */
function CaseBand({
  summary,
  group,
}: {
  summary: CaseSummary | undefined;
  group: CaseGroup;
}) {
  const matched = summary?.total ?? group.rows.length;
  const overdue = summary?.overdue ?? 0;
  const pct = summary?.pctClosed ?? 0;

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      <span className="rounded-[5px] border border-line-strong bg-surface px-1.5 py-0.5 font-mono text-[11.5px] font-bold text-ink">
        {group.iapId}
      </span>
      <span className="text-[12px] font-semibold text-ink-mid">
        {summary?.title ?? group.rows[0]?.title}
      </span>
      <span className="text-[11px] font-normal text-faint">
        {summary?.station ?? group.rows[0]?.station} · {matched} item
      </span>

      <span className="ml-auto flex items-center gap-2.5">
        {overdue > 0 ? (
          <span className="pill bg-late-soft text-late-ink">
            {overdue} overdue
          </span>
        ) : null}
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="block h-[5px] w-[52px] overflow-hidden rounded-full bg-track"
          >
            <span
              className="block h-full rounded-full bg-done-bar"
              style={{ width: `${pct}%` }}
            />
          </span>
          <b className="text-[11px] font-semibold tabular-nums text-ink-mid">
            {pct}%
          </b>
        </span>
      </span>
    </div>
  );
}

/**
 * The evidence itself, next to the note describing it. `rowToItem` has already
 * discarded anything that is not an http(s) URL, so this only ever renders a link it
 * was given one — and `noreferrer` keeps the tracker's URL out of the target's logs,
 * which matters when the rows name individual employees.
 */
function EvidenceLink({
  item,
  prefix = "",
}: {
  item: DerivedActionItem;
  /** Both layouts are always in the DOM, so their test ids must not collide. */
  prefix?: string;
}) {
  if (!item.evidenceLink) return null;
  return (
    <a
      href={item.evidenceLink}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={`${prefix}evidence-link-${item.iapId}-${item.stepNo}`}
      className="mt-1 block font-semibold text-accent underline underline-offset-2"
    >
      Buka bukti ↗
    </a>
  );
}

function CardField({
  label,
  value,
  tone = "text-ink-mid",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div>
      <dt className="font-semibold text-label">{label}</dt>
      <dd className={tone}>{value || "—"}</dd>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        aria-hidden
        className="h-[5px] w-full min-w-[26px] shrink overflow-hidden rounded-full bg-track"
      >
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${value}%`, background: progressColor(value) }}
        />
      </div>
      <span className="shrink-0 text-[11px] tabular-nums text-idle">
        {value}%
      </span>
    </div>
  );
}

function RowButton({
  children,
  onClick,
  testId,
  label,
  danger = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  testId: string;
  /** Icon-only, so the action names itself for anything that cannot see it. */
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      aria-label={label}
      title={label}
      className={`flex h-[28px] w-[28px] shrink-0 cursor-pointer items-center justify-center rounded-[6px] border border-line text-ink-mid transition-colors duration-150 ${
        danger
          ? "hover:border-late hover:bg-late-soft hover:text-late-ink"
          : "hover:bg-head hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
