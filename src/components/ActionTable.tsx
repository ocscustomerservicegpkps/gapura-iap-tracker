"use client";

import { useEffect, useRef, useState } from "react";
import type { SortDirection, SortKey } from "@/domain/filter";
import type { DerivedActionItem } from "@/domain/types";
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

const PAGE = 10;

export function ActionTable({
  rows,
  sortKey,
  sortDirection,
  onSort,
  onEdit,
  onDelete,
}: ActionTableProps) {
  // Infinite scroll: ten more rows each time the sentinel below the list comes
  // into view. Plain IntersectionObserver, no virtualisation, no library.
  const [limit, setLimit] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => setLimit(PAGE), [rows]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || limit >= rows.length) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) setLimit((current) => current + PAGE);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [limit, rows.length]);

  const visible = rows.slice(0, limit);

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

  return (
    <>
      {/* Desktop: every column fits the container width; long text wraps. */}
      <div
        className="card hidden overflow-hidden md:block"
        data-testid="table-view"
      >
        <div>
          <table className="w-full table-fixed border-collapse text-[11.5px] [&_td]:break-words [&_td_.pill]:whitespace-normal">
            <caption className="sr-only">
              Seluruh item aksi, dikelompokkan per kasus IAP. Judul kolom dapat
              diklik untuk mengurutkan.
            </caption>
            <thead>
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
                    className="p-0 text-left font-semibold text-idle-ink"
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

      <div
        ref={sentinel}
        className="py-3 text-center text-[11.5px] text-faint"
        data-testid="load-more"
      >
        {limit < rows.length ? (
          // The observer normally trips this on scroll; the button keeps it
          // reachable by keyboard and where IntersectionObserver never fires.
          <button
            type="button"
            className="min-h-[32px] cursor-pointer px-3 py-1.5 underline"
            onClick={() => setLimit((current) => current + PAGE)}
          >
            Muat {PAGE} item berikutnya ({visible.length} dari {rows.length})
          </button>
        ) : (
          `Semua ${rows.length} item ditampilkan.`
        )}
      </div>
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
  const href = `/api/export/${encodeURIComponent(item.iapId)}`;
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
        href={`${href}?format=docx`}
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
