"use client";

import type { SortDirection, SortKey } from "@/domain/filter";
import type { DerivedActionItem } from "@/domain/types";
import { OVERDUE_PILL, progressColor, STATUS_PILL } from "./status-styles";

interface ActionTableProps {
  rows: readonly DerivedActionItem[];
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
  onEdit: (item: DerivedActionItem) => void;
  onDelete: (item: DerivedActionItem) => void;
}

// Widths chosen so the whole grid, action buttons included, fits inside the 1400px
// container without horizontal scrolling on a desktop screen.
const COLUMNS: Array<{ key: SortKey; label: string; className?: string }> = [
  { key: "no", label: "No", className: "w-[42px]" },
  { key: "iapId", label: "Kasus / Stasiun", className: "min-w-[176px]" },
  { key: "step", label: "Langkah & Detail Tindakan", className: "min-w-[250px]" },
  { key: "pic", label: "PIC", className: "min-w-[128px]" },
  { key: "timeline", label: "Linimasa", className: "min-w-[92px]" },
  { key: "targetDate", label: "Target", className: "min-w-[88px]" },
  { key: "status", label: "Status", className: "min-w-[104px]" },
  { key: "progress", label: "Progres", className: "min-w-[96px]" },
  { key: "overdue", label: "Terlambat", className: "min-w-[100px]" },
  { key: "evidence", label: "Bukti / Catatan", className: "min-w-[140px]" },
];

export function ActionTable({
  rows,
  sortKey,
  sortDirection,
  onSort,
  onEdit,
  onDelete,
}: ActionTableProps) {
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
      {/* Desktop: the full grid, horizontally scrollable if the viewport is tight. */}
      <div className="card hidden overflow-hidden md:block" data-testid="table-view">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse text-[12.5px]">
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
                    className={`px-2.5 py-2.5 text-left font-semibold text-idle-ink ${column.className ?? ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => onSort(column.key)}
                      data-testid={`sort-${column.key}`}
                      className="flex cursor-pointer items-center gap-1 font-semibold hover:text-ink"
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
                  className="px-2.5 py-2.5 text-right font-semibold text-idle-ink"
                >
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.iapId}-${row.stepNo}`}
                  className="border-b border-line-soft align-top"
                  data-testid={`row-${row.iapId}-${row.stepNo}`}
                >
                  <td className="px-2.5 py-2.5 text-label">{row.no}</td>
                  <td className="px-2.5 py-2.5">
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
                  <td className="px-2.5 py-2.5">
                    <div className="font-semibold text-ink">
                      Langkah {row.stepNo}: {row.step}
                    </div>
                    <div className="mt-0.5 text-[11.5px] leading-snug text-muted">
                      {row.action}
                    </div>
                  </td>
                  <td className="px-2.5 py-2.5 text-[12px] text-ink-mid">
                    {row.pic}
                  </td>
                  <td className="px-2.5 py-2.5 text-[12px] text-idle">
                    {row.timeline}
                  </td>
                  <td
                    className="px-2.5 py-2.5 text-[12px] whitespace-nowrap text-ink-mid"
                    data-testid={`target-${row.iapId}-${row.stepNo}`}
                  >
                    {row.targetDate}
                  </td>
                  <td className="px-2.5 py-2.5">
                    <span className={`pill ${STATUS_PILL[row.status]}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-2.5 py-2.5">
                    <ProgressBar value={row.progress} />
                  </td>
                  <td className="px-2.5 py-2.5">
                    <span
                      className={`pill ${OVERDUE_PILL[row.overdue]}`}
                      data-testid={`overdue-${row.iapId}-${row.stepNo}`}
                    >
                      {row.overdue}
                    </span>
                  </td>
                  <td className="px-2.5 py-2.5 text-[11.5px] leading-snug text-idle">
                    {row.evidence}
                  </td>
                  <td className="px-2.5 py-2.5">
                    <div className="flex justify-end gap-1.5">
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
          </table>
        </div>
      </div>

      {/* Phones: one card per item, so a row is readable without panning sideways. */}
      <ul className="space-y-3 md:hidden" data-testid="card-view">
        {rows.map((row) => (
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
                <div className="mt-0.5 text-[11px] text-faint">{row.station}</div>
              </div>
              <span className="text-[11px] text-faint">#{row.no}</span>
            </div>

            <div className="mt-2.5 text-[13px] font-semibold text-ink">
              Langkah {row.stepNo}: {row.step}
            </div>
            <p className="mt-1 text-[12px] leading-snug text-muted">{row.action}</p>

            <dl className="mt-3 grid grid-cols-2 gap-2 text-[11.5px]">
              <CardField label="PIC" value={row.pic} />
              <CardField label="Linimasa" value={row.timeline} />
              <CardField label="Tanggal Target" value={row.targetDate || "—"} />
              <CardField
                label="Tanggal Selesai"
                value={row.actualDate || "—"}
              />
            </dl>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`pill ${STATUS_PILL[row.status]}`}>
                {row.status}
              </span>
              <span className={`pill ${OVERDUE_PILL[row.overdue]}`}>
                {row.overdue}
              </span>
              <span className="flex-1" />
              <ProgressBar value={row.progress} />
            </div>

            {row.evidence ? (
              <p className="mt-2.5 border-t border-line-soft pt-2.5 text-[11.5px] leading-snug text-idle">
                {row.evidence}
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
    </>
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

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-[6px] w-[52px] overflow-hidden rounded-[4px] bg-[oklch(93%_0.004_250)]">
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
      className={`cursor-pointer rounded-[5px] border border-line px-2 py-1 text-[11.5px] font-semibold whitespace-nowrap hover:bg-head ${
        danger ? "text-late-ink" : "text-ink-mid"
      }`}
    >
      {children}
    </button>
  );
}
