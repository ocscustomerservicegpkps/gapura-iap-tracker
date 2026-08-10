"use client";

import {
  ANY,
  EMPTY_FILTERS,
  hasActiveFilters,
  type FilterCriteria,
} from "@/domain/filter";
import { STATUSES, type Status } from "@/domain/types";

interface FilterBarProps {
  criteria: FilterCriteria;
  onChange: (next: FilterCriteria) => void;
  iapIds: readonly string[];
  overdueCount: number;
  dueSoonCount: number;
}

/** Sticky on phones so filtering does not mean scrolling back to the top. */
export function FilterBar({
  criteria,
  onChange,
  iapIds,
  overdueCount,
  dueSoonCount,
}: FilterBarProps) {
  const set = <K extends keyof FilterCriteria>(
    key: K,
    value: FilterCriteria[K],
  ) => onChange({ ...criteria, [key]: value });

  return (
    <div
      className="sticky top-0 z-20 -mx-4 mb-3.5 flex flex-wrap items-center gap-2 bg-canvas/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none"
      data-testid="filter-bar"
    >
      <input
        type="search"
        placeholder="Cari (kasus, PIC, kata kunci)..."
        aria-label="Cari item aksi"
        data-testid="filter-search"
        className="field w-full sm:w-[240px]"
        value={criteria.search}
        onChange={(e) => set("search", e.target.value)}
      />

      <select
        aria-label="Filter ID IAP"
        data-testid="filter-iap"
        className="field w-[calc(50%-4px)] sm:w-auto"
        value={criteria.iapId}
        onChange={(e) => set("iapId", e.target.value)}
      >
        <option value={ANY}>Semua IAP</option>
        {iapIds.map((id) => (
          <option key={id} value={id}>
            {id}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter status"
        data-testid="filter-status"
        className="field w-[calc(50%-4px)] sm:w-auto"
        value={criteria.status}
        onChange={(e) => set("status", e.target.value as Status | typeof ANY)}
      >
        <option value={ANY}>Semua Status</option>
        {STATUSES.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>

      <Toggle
        active={criteria.overdueOnly}
        onClick={() => set("overdueOnly", !criteria.overdueOnly)}
        testId="filter-overdue"
        activeClass="border-late bg-late-soft text-late-ink"
      >
        Terlambat ({overdueCount})
      </Toggle>

      <Toggle
        active={criteria.dueSoonOnly}
        onClick={() => set("dueSoonOnly", !criteria.dueSoonOnly)}
        testId="filter-due-soon"
        activeClass="border-accent bg-plan-soft text-plan-ink"
      >
        Jatuh tempo ≤ 7 hari ({dueSoonCount})
      </Toggle>

      {hasActiveFilters(criteria) ? (
        <button
          type="button"
          className="cursor-pointer text-[12px] font-semibold text-accent hover:underline"
          data-testid="filter-clear"
          onClick={() => onChange(EMPTY_FILTERS)}
        >
          Hapus semua filter
        </button>
      ) : null}
    </div>
  );
}

function Toggle({
  active,
  onClick,
  testId,
  activeClass,
  children,
}: {
  active: boolean;
  onClick: () => void;
  testId: string;
  activeClass: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      data-testid={testId}
      onClick={onClick}
      className={`cursor-pointer rounded-[7px] border px-3 py-2 text-[12px] font-semibold whitespace-nowrap ${
        active
          ? activeClass
          : "border-line-strong bg-surface text-ink-mid hover:bg-head"
      }`}
    >
      {children}
    </button>
  );
}
