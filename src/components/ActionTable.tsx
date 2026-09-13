"use client";

import { useEffect, useState } from "react";
import type { SortDirection, SortKey } from "@/domain/filter";
import type { DerivedActionItem } from "@/domain/types";
import { safeLinks } from "@/domain/rows";
import {
  OVERDUE_LABEL,
  OVERDUE_PILL,
  progressColor,
  STATUS_LABEL,
  STATUS_PILL,
} from "./status-styles";

interface ActionTableProps {
  rows: readonly DerivedActionItem[];
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
  onEdit: (item: DerivedActionItem) => void;
  onDelete: (item: DerivedActionItem) => void;
}

// Percentage widths on a fixed layout: every column keeps its share of the
// container, text wraps instead of truncating, and nothing scrolls sideways.
const COLUMNS: Array<{ key: SortKey; label: string; width: string }> = [
  { key: "no", label: "No", width: "3%" },
  { key: "iapId", label: "Kasus / Stasiun", width: "14%" },
  { key: "step", label: "Langkah & Detail Tindakan", width: "18%" },
  { key: "pic", label: "PIC", width: "9%" },
  { key: "timeline", label: "Linimasa", width: "8%" },
  { key: "targetDate", label: "Target", width: "7%" },
  { key: "status", label: "Status", width: "9%" },
  { key: "progress", label: "Progres", width: "7%" },
  { key: "overdue", label: "Overdue", width: "8%" },
  { key: "evidence", label: "Bukti / Catatan", width: "10%" },
];

/** `0` means every row on one page. */
const PAGE_SIZES = [10, 25, 50, 0] as const;
/**
 * Ten, because rows are tall: a column of wrapped step text and detail runs about
 * 180px, so twenty-five of them is five screens of scrolling inside one page.
 */
const DEFAULT_PAGE_SIZE = 10;

export function ActionTable({
  rows,
  sortKey,
  sortDirection,
  onSort,
  onEdit,
  onDelete,
}: ActionTableProps) {
  /**
   * Explicit pages, not infinite scroll.
   *
   * This table used to append ten rows whenever a sentinel scrolled into view, so
   * reaching the last of 117 items meant eleven sequential auto-loads down a page
   * that kept growing underneath you — the scrollbar never settled, the footer was
   * unreachable, and a remembered scroll position meant nothing. A page of rows is
   * a fixed height you can scroll to the end of, and "halaman 3" is somewhere a
   * person can actually return to.
   */
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);

  const perPage = pageSize === 0 ? Math.max(rows.length, 1) : pageSize;
  const pageCount = Math.max(1, Math.ceil(rows.length / perPage));
  // Filtering can shorten the list under a page that no longer exists.
  const current = Math.min(page, pageCount);
  const start = (current - 1) * perPage;

  // A new filter or sort means a different list; start reading it from the top.
  useEffect(() => setPage(1), [rows]);

  const visible = rows.slice(start, start + perPage);

  // Grouped by IAP ID in first-appearance order, so the active sort still decides
  // which case comes first and how its items are ordered inside the group.
  const groups = new Map<string, DerivedActionItem[]>();
  for (const row of visible) {
    const group = groups.get(row.iapId);
    if (group) group.push(row);
    else groups.set(row.iapId, [row]);
  }

  if (rows.length === 0) {
    return (
      <div className="card overflow-hidden">
        <p
          className="p-8 text-center text-[13px] text-faint"
          data-testid="empty-state"
        >
          Tidak ada item aksi yang cocok dengan filter saat ini.
        </p>
      </div>
    );
  }

  const pager = (place: "top" | "bottom") => (
    <Pager
      place={place}
      first={start + 1}
      last={start + visible.length}
      total={rows.length}
      page={current}
      pageCount={pageCount}
      pageSize={pageSize}
      onPage={setPage}
      onPageSize={(size) => {
        setPageSize(size);
        setPage(1);
      }}
    />
  );

  return (
    <>
      {pager("top")}

      {/* Desktop: every column fits the container width; long text wraps. */}
      {/*
        No `overflow-hidden` here on purpose: it would make this card the sticky
        header's scrollport, and a scrollport that never scrolls pins nothing. The
        header cells carry the card's top corners instead.
      */}
      <div
        className="card hidden md:block"
        data-testid="table-view"
      >
        <div>
          <table className="w-full table-fixed border-collapse text-[11.5px] [&_td]:break-words [&_td_.pill]:whitespace-normal">
            <caption className="sr-only">
              Seluruh item aksi, dikelompokkan per kasus IAP. Judul kolom dapat
              diklik untuk mengurutkan.
            </caption>
            {/* Parks directly under the account bar, which is the page's only
                other sticky element; the two share one height token. */}
            <thead className="sticky top-[var(--app-header-h)] z-10">
              <tr className="border-b border-line-strong bg-head">
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
                    className="bg-head p-0 text-left font-semibold text-idle-ink first:rounded-tl-[var(--radius-card)] last:rounded-tr-[var(--radius-card)]"
                  >
                    {/* The button fills the header cell: the whole label is the
                        target, and it clears the 24px minimum on its own. */}
                    <button
                      type="button"
                      onClick={() => onSort(column.key)}
                      data-testid={`sort-${column.key}`}
                      className="flex w-full min-h-[32px] cursor-pointer items-center gap-1 px-2 py-1.5 text-left font-semibold hover:text-ink"
                    >
                      {column.label}
                      <SortMark
                        active={sortKey === column.key}
                        direction={sortDirection}
                      />
                    </button>
                  </th>
                ))}
                <th
                  scope="col"
                  style={{ width: "7%" }}
                  className="px-2 py-1.5 text-right font-semibold text-idle-ink"
                >
                  Aksi
                </th>
              </tr>
            </thead>
            {[...groups].map(([iapId, groupRows]) => (
              <tbody key={iapId} data-testid={`group-${iapId}`}>
                <tr className="border-b border-line-strong bg-head">
                  <th
                    colSpan={COLUMNS.length + 1}
                    scope="colgroup"
                    className="px-2.5 py-2 text-left"
                  >
                    <span className="font-mono text-[11.5px] font-bold text-ink">
                      {iapId}
                    </span>
                    <span className="ml-2 text-[11.5px] font-normal text-ink-mid">
                      {groupRows[0]?.title}
                    </span>
                    <span className="ml-2 text-[11px] font-normal text-faint">
                      {groupRows[0]?.station} · {groupRows.length} item
                    </span>
                  </th>
                </tr>
                {groupRows.map((row) => (
                  <tr
                    key={`${row.iapId}-${row.stepNo}`}
                    className="border-b border-line-soft align-top"
                    data-testid={`row-${row.iapId}-${row.stepNo}`}
                  >
                    <td className="px-2 py-1.5 text-label">{row.no}</td>
                    <td className="px-2 py-1.5">
                      <div className="font-mono text-[11.5px] font-bold text-ink">
                        {row.iapId}
                      </div>
                      <div className="mt-0.5 text-[12px] leading-snug text-ink-mid">
                        {row.title}
                      </div>
                      <div className="mt-0.5 text-[11px] text-faint">
                        {row.station}
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="font-semibold text-ink">
                        Langkah {row.stepNo}: {row.step}
                      </div>
                      <div className="mt-0.5 text-[11.5px] leading-snug text-muted">
                        {row.action}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-[12px] text-ink-mid">
                      {row.pic}
                    </td>
                    <td className="px-2 py-1.5 text-[12px] text-idle">
                      {row.timeline}
                    </td>
                    <td
                      className="px-2 py-1.5 text-[12px] text-ink-mid"
                      data-testid={`target-${row.iapId}-${row.stepNo}`}
                    >
                      {row.targetDate}
                    </td>
                    <td className="px-2 py-1.5">
                      <span className={`pill ${STATUS_PILL[row.status]}`}>
                        {STATUS_LABEL[row.status]}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <ProgressBar value={row.progress} />
                    </td>
                    <td className="px-2 py-1.5">
                      <span
                        className={`pill ${OVERDUE_PILL[row.overdue]}`}
                        data-testid={`overdue-${row.iapId}-${row.stepNo}`}
                      >
                        {OVERDUE_LABEL[row.overdue]}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-[11.5px] leading-snug text-idle">
                      {row.evidence}
                      <EvidenceLink item={row} />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex flex-wrap justify-end gap-1">
                        <ItemDownloadLinks item={row} />
                        <RowButton
                          onClick={() => onEdit(row)}
                          testId={`edit-${row.iapId}-${row.stepNo}`}
                        >
                          Ubah
                        </RowButton>
                        <RowButton
                          onClick={() => onDelete(row)}
                          testId={`delete-${row.iapId}-${row.stepNo}`}
                          danger
                        >
                          Hapus
                        </RowButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </div>

      {/* Phones: one card per item, so a row is readable without panning sideways. */}
      <ul className="space-y-3 md:hidden" data-testid="card-view">
        {[...groups].map(([iapId, groupRows]) => (
          <li key={iapId}>
            <h3 className="mb-2 flex items-baseline gap-2 px-1">
              <span className="font-mono text-[12px] font-bold text-ink">
                {iapId}
              </span>
              <span className="text-[11px] text-faint">
                {groupRows.length} item
              </span>
            </h3>
            <ul className="space-y-3">
              {groupRows.map((row) => (
                <li
                  key={`${row.iapId}-${row.stepNo}`}
                  className="card px-4 py-3"
                  data-testid={`card-${row.iapId}-${row.stepNo}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-[11.5px] font-bold text-ink">
                        {row.iapId}
                      </div>
                      <div className="mt-0.5 text-[12px] leading-snug text-ink-mid">
                        {row.title}
                      </div>
                      <div className="mt-0.5 text-[11px] text-faint">
                        {row.station}
                      </div>
                    </div>
                    <span className="text-[11px] text-faint">#{row.no}</span>
                  </div>

                  <div className="mt-2.5 text-[13px] font-semibold text-ink">
                    Langkah {row.stepNo}: {row.step}
                  </div>
                  <p className="mt-1 text-[12px] leading-snug text-muted">
                    {row.action}
                  </p>

                  <dl className="mt-3 grid grid-cols-2 gap-2 text-[11.5px]">
                    <CardField label="PIC" value={row.pic} />
                    <CardField label="Linimasa" value={row.timeline} />
                    <CardField
                      label="Tanggal Target"
                      value={row.targetDate || "—"}
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
                    <p className="mt-2.5 border-t border-line-soft pt-2.5 text-[11.5px] leading-snug text-idle">
                      {row.evidence}
                      <EvidenceLink item={row} prefix="card-" />
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <ItemDownloadLinks item={row} prefix="card-" />
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
                      className="btn"
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

      {pager("bottom")}
    </>
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
  const links = safeLinks(item.evidenceLink);
  if (links.length === 0) return null;
  return (
    <span className="mt-1 block">
      {links.map((link, index) => (
        <a
          key={`${link}-${index}`}
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          data-testid={
            index === 0
              ? `${prefix}evidence-link-${item.iapId}-${item.stepNo}`
              : `${prefix}evidence-link-${item.iapId}-${item.stepNo}-${index + 1}`
          }
          className="block font-semibold text-accent underline underline-offset-2"
        >
          Buka bukti {links.length > 1 ? index + 1 : ""} ↗
        </a>
      ))}
    </span>
  );
}

function CardField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold text-label">{label}</dt>
      <dd className="text-ink-mid">{value || "—"}</dd>
    </div>
  );
}

/**
 * Each action item belongs to one IAP case, so its export buttons generate the
 * complete case document. Both layouts stay mounted, hence the distinct prefixes.
 */
function ItemDownloadLinks({
  item,
  prefix = "",
}: {
  item: DerivedActionItem;
  prefix?: string;
}) {
  const href = `/api/export/${encodeURIComponent(item.iapId)}?step=${item.stepNo}`;
  const testSuffix = `${item.iapId}-${item.stepNo}`;

  return (
    <>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        data-testid={`${prefix}item-pdf-${testSuffix}`}
        title={`Cetak / simpan PDF dokumen IAP ${item.iapId}`}
        className={ROW_LINK_CLASS}
      >
        PDF
      </a>
      <a
        href={`/api/export/${encodeURIComponent(item.iapId)}?format=docx&step=${item.stepNo}`}
        data-testid={`${prefix}item-docx-${testSuffix}`}
        title={`Unduh dokumen Word IAP ${item.iapId}`}
        className={ROW_LINK_CLASS}
      >
        DOCX
      </a>
    </>
  );
}

const ROW_LINK_CLASS =
  "flex min-h-[26px] cursor-pointer items-center rounded-[5px] border border-line px-2 py-1 text-[11.5px] font-semibold whitespace-nowrap text-ink-mid hover:bg-head";

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-[6px] w-[34px] shrink-0 overflow-hidden rounded-[4px] bg-track">
        <div
          className="h-full rounded-[4px]"
          style={{ width: `${value}%`, background: progressColor(value) }}
        />
      </div>
      <span className="text-[11.5px] text-idle">{value}%</span>
    </div>
  );
}

function SortMark({
  active,
  direction,
}: {
  active: boolean;
  direction: SortDirection;
}) {
  return (
    <span
      aria-hidden
      className={`text-[9px] ${active ? "text-accent" : "text-[oklch(78%_0.01_250)]"}`}
    >
      {active ? (direction === "asc" ? "▲" : "▼") : "↕"}
    </span>
  );
}

function RowButton({
  children,
  onClick,
  testId,
  danger = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  testId: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={`min-h-[26px] cursor-pointer rounded-[5px] border border-line px-2 py-1 text-[11.5px] font-semibold whitespace-nowrap hover:bg-head ${
        danger ? "text-late-ink" : "text-ink-mid"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Range summary, page size, and the two controls that move between pages.
 *
 * The summary is first because it answers the question the pager exists for —
 * "where am I in 117 rows" — and it is the part that stays useful when there is
 * only one page.
 */
function Pager({
  place,
  first,
  last,
  total,
  page,
  pageCount,
  pageSize,
  onPage,
  onPageSize,
}: {
  /** Both ends carry a pager, so neither is ever a scroll away. */
  place: "top" | "bottom";
  first: number;
  last: number;
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  return (
    <nav
      aria-label={`Navigasi halaman tabel (${place === "top" ? "atas" : "bawah"})`}
      className={`flex flex-wrap items-center justify-between gap-3 px-1 ${
        place === "top" ? "mb-2.5" : "mt-3"
      }`}
      data-testid={`pagination-${place}`}
    >
      <p className="text-[11.5px] text-faint" data-testid={`page-summary-${place}`}>
        Menampilkan <b className="text-ink-mid">{first}</b>–
        <b className="text-ink-mid">{last}</b> dari{" "}
        <b className="text-ink-mid">{total}</b> item aksi
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[11.5px] text-faint">
          <span>Per halaman</span>
          <select
            className="field min-h-[30px] py-1 text-[11.5px]"
            value={pageSize}
            onChange={(event) => onPageSize(Number(event.target.value))}
            data-testid={`page-size-${place}`}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size === 0 ? "Semua" : size}
              </option>
            ))}
          </select>
        </label>

        {pageCount > 1 ? (
          <div className="flex items-center gap-1.5">
            <PagerButton
              onClick={() => onPage(page - 1)}
              disabled={page <= 1}
              testId={`page-prev-${place}`}
            >
              ← Sebelumnya
            </PagerButton>
            <span
              className="px-1 text-[11.5px] text-faint"
              aria-live="polite"
              data-testid={`page-indicator-${place}`}
            >
              Halaman {page} dari {pageCount}
            </span>
            <PagerButton
              onClick={() => onPage(page + 1)}
              disabled={page >= pageCount}
              testId={`page-next-${place}`}
            >
              Berikutnya →
            </PagerButton>
          </div>
        ) : null}
      </div>
    </nav>
  );
}

function PagerButton({
  children,
  onClick,
  disabled,
  testId,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className="flex min-h-[30px] cursor-pointer items-center rounded-[6px] border border-line px-2.5 text-[11.5px] font-semibold text-ink-mid hover:bg-head disabled:cursor-not-allowed disabled:opacity-45"
    >
      {children}
    </button>
  );
}
