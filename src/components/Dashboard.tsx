"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCaseAction, deleteItemAction } from "@/app/actions";
import { caseIds, summariseByCase, summariseTotals } from "@/domain/aggregate";
import { hasContext, type CaseContext } from "@/domain/context";
import { formatTrackerDateLong } from "@/domain/dates";
import {
  ANY,
  EMPTY_FILTERS,
  filterItems,
  sortItems,
  type FilterCriteria,
  type SortDirection,
  type SortKey,
} from "@/domain/filter";
import type { CaseSummary, DerivedActionItem } from "@/domain/types";
import { firstError } from "@/domain/validate";
import { ActionTable } from "./ActionTable";
import { CaseContextModal } from "./CaseContextModal";
import { CaseModal } from "./CaseModal";
import { CaseSummaryTable } from "./CaseSummaryTable";
import { Charts } from "./Charts";
import { ConfirmDialog } from "./ConfirmDialog";
import { FilterBar } from "./FilterBar";
import { ItemModal } from "./ItemModal";
import { KpiCards } from "./KpiCards";
import { runAction } from "./run-action";
import type { Suggestions } from "./StepFields";
import { UsageNotes } from "./UsageNotes";

interface DashboardProps {
  items: readonly DerivedActionItem[];
  /** Asia/Jakarta, computed on the server so the client cannot disagree. */
  today: string;
  caseContext: Readonly<Record<string, CaseContext>>;
}

type Dialog =
  | { kind: "none" }
  | { kind: "edit-item"; item: DerivedActionItem }
  | { kind: "new-item"; iapId: string }
  | { kind: "new-case" }
  | { kind: "edit-case"; summary: CaseSummary; focusContext?: boolean }
  | { kind: "case-context"; summary: CaseSummary }
  | { kind: "delete-item"; item: DerivedActionItem }
  | { kind: "delete-case"; summary: CaseSummary };

/** The sheet's own vocabulary, offered back as autocomplete rather than re-typed. */
function gatherSuggestions(items: readonly DerivedActionItem[]): Suggestions {
  const unique = (pick: (item: DerivedActionItem) => string) =>
    [...new Set(items.map(pick).map((v) => v.trim()).filter(Boolean))].sort();
  return {
    pic: unique((item) => item.pic),
    timeline: unique((item) => item.timeline),
  };
}

export function Dashboard({ items, today, caseContext }: DashboardProps) {
  const router = useRouter();
  const [criteria, setCriteria] = useState<FilterCriteria>(EMPTY_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>("no");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [dialog, setDialog] = useState<Dialog>({ kind: "none" });
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();

  const totals = useMemo(() => summariseTotals(items), [items]);
  const byCase = useMemo(() => summariseByCase(items), [items]);
  const ids = useMemo(() => caseIds(items), [items]);
  const suggestions = useMemo(() => gatherSuggestions(items), [items]);

  const rows = useMemo(
    () => sortItems(filterItems(items, criteria), sortKey, sortDirection),
    [items, criteria, sortKey, sortDirection],
  );

  const close = () => {
    setDialog({ kind: "none" });
    setDeleteError(null);
  };

  const afterSave = () => {
    close();
    // The action already revalidated the cache; this pulls the fresh render in.
    router.refresh();
  };

  /** Clicking the active column flips direction; a new column starts ascending. */
  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const confirmDelete = () => {
    if (dialog.kind !== "delete-item" && dialog.kind !== "delete-case") return;
    const target = dialog;

    setDeleteError(null);
    startDelete(async () => {
      const result = await runAction(() =>
        target.kind === "delete-item"
          ? deleteItemAction({
              iapId: target.item.iapId,
              stepNo: target.item.stepNo,
            })
          : deleteCaseAction(target.summary.iapId),
      );

      if (result.ok) afterSave();
      else setDeleteError(firstError(result.errors));
    });
  };

  const caseOf = (iapId: string) => byCase.find((c) => c.iapId === iapId);

  // Everything behind an open dialog leaves the tab order and the accessibility
  // tree, so the trap inside the panel has nothing left to leak into.
  const dialogOpen = dialog.kind !== "none";

  return (
    <div className="min-h-screen">
      <a
        href="#tracker"
        inert={dialogOpen}
        className="sr-only rounded-[7px] bg-surface text-[13px] font-semibold text-accent focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:flex focus:min-h-[36px] focus:items-center focus:border focus:border-accent focus:px-4"
      >
        Lewati ke tabel tracker
      </a>

      <main
        inert={dialogOpen}
        className="mx-auto max-w-[1400px] px-4 pt-7 pb-16 sm:px-8 sm:pt-9"
      >
        <header className="mb-7 flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="mb-1.5 text-[12px] font-semibold tracking-[0.12em] text-accent uppercase">
              IAP Monitoring Tracker
            </p>
            <h1 className="text-[24px] font-bold text-ink-strong sm:text-[30px]">
              Dasbor Monitoring Improvement Action Plan
            </h1>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setDialog({ kind: "new-case" })}
              data-testid="new-case"
            >
              + Kasus IAP Baru
            </button>
            <p className="text-[12px] text-label" data-testid="today">
              Hari ini (WIB): {formatTrackerDateLong(today)}
            </p>
          </div>
        </header>

        <KpiCards totals={totals} />

        <CaseSummaryTable
          byCase={byCase}
          totals={totals}
          hasContext={(iapId) => hasContext(caseContext[iapId])}
          onOpenContext={(summary) =>
            setDialog({ kind: "case-context", summary })
          }
          onAddStep={(summary) =>
            setDialog({ kind: "new-item", iapId: summary.iapId })
          }
          onEditCase={(summary) => setDialog({ kind: "edit-case", summary })}
          onDeleteCase={(summary) =>
            setDialog({ kind: "delete-case", summary })
          }
        />

        <Charts items={items} byCase={byCase} totals={totals} />

        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
          <h2 id="tracker" className="scroll-mt-4 text-[16px] font-bold text-ink-strong">
            Tabel Tracker — Seluruh Item Aksi
          </h2>
          {criteria.iapId !== ANY ? (
            <button
              type="button"
              className="btn"
              onClick={() =>
                setDialog({ kind: "new-item", iapId: criteria.iapId })
              }
              data-testid="new-item"
            >
              + Item Aksi untuk {criteria.iapId}
            </button>
          ) : (
            <p className="text-[12px] text-faint">
              Gunakan tombol <b>+ Item</b> pada ringkasan kasus di atas, atau
              pilih satu ID IAP pada filter, untuk menambah item aksi.
            </p>
          )}
        </div>

        <FilterBar
          criteria={criteria}
          onChange={setCriteria}
          iapIds={ids}
          overdueCount={totals.overdue}
          dueSoonCount={totals.dueSoon}
        />

        <ActionTable
          rows={rows}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={toggleSort}
          onEdit={(item) => setDialog({ kind: "edit-item", item })}
          onDelete={(item) => setDialog({ kind: "delete-item", item })}
        />

        {/* Filtering changes this line and nothing else visible above the fold, so
            it announces itself rather than waiting to be re-read. */}
        <p
          className="mt-2 text-[12px] text-faint"
          role="status"
          aria-live="polite"
          data-testid="result-count"
        >
          Menampilkan {rows.length} dari {totals.total} item aksi.
        </p>

        <UsageNotes />
      </main>

      {dialog.kind === "edit-item" || dialog.kind === "new-item" ? (
        <ItemModal
          item={dialog.kind === "edit-item" ? dialog.item : null}
          iapId={dialog.kind === "edit-item" ? dialog.item.iapId : dialog.iapId}
          caseTitle={
            (dialog.kind === "edit-item"
              ? dialog.item.title
              : caseOf(dialog.iapId)?.title) ?? ""
          }
          caseStation={
            (dialog.kind === "edit-item"
              ? dialog.item.station
              : caseOf(dialog.iapId)?.station) ?? ""
          }
          today={today}
          suggestions={suggestions}
          onClose={close}
          onSaved={afterSave}
          onEvidenceStored={() => router.refresh()}
        />
      ) : null}

      {dialog.kind === "new-case" || dialog.kind === "edit-case" ? (
        <CaseModal
          existing={
            dialog.kind === "edit-case"
              ? {
                  iapId: dialog.summary.iapId,
                  title: dialog.summary.title,
                  station: dialog.summary.station,
                  rowCount: dialog.summary.total,
                }
              : null
          }
          context={
            dialog.kind === "edit-case"
              ? (caseContext[dialog.summary.iapId] ?? null)
              : null
          }
          focusContext={dialog.kind === "edit-case" && dialog.focusContext}
          suggestions={suggestions}
          onClose={close}
          onSaved={afterSave}
        />
      ) : null}

      {dialog.kind === "case-context" ? (
        <CaseContextModal
          summary={dialog.summary}
          context={caseContext[dialog.summary.iapId] ?? null}
          onEdit={() =>
            setDialog({
              kind: "edit-case",
              summary: dialog.summary,
              focusContext: true,
            })
          }
          onClose={close}
        />
      ) : null}

      {dialog.kind === "delete-item" ? (
        <ConfirmDialog
          title="Hapus item aksi?"
          message={`Menghapus 1 baris: ${dialog.item.iapId} langkah ${dialog.item.stepNo} — ${dialog.item.step}.`}
          detail="1 baris akan dihapus dari sheet Tracker dan kolom No akan dinomori ulang."
          confirmLabel="Hapus item"
          busy={deleting}
          error={deleteError}
          onConfirm={confirmDelete}
          onCancel={close}
        />
      ) : null}

      {dialog.kind === "delete-case" ? (
        <ConfirmDialog
          title="Hapus kasus IAP?"
          message={`Menghapus kasus ${dialog.summary.iapId} — ${dialog.summary.title}.`}
          detail={`${dialog.summary.total} baris akan dihapus dari sheet Tracker dan kolom No akan dinomori ulang.`}
          confirmLabel={`Hapus ${dialog.summary.total} baris`}
          busy={deleting}
          error={deleteError}
          onConfirm={confirmDelete}
          onCancel={close}
        />
      ) : null}
    </div>
  );
}
