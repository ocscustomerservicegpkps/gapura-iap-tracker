"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCaseAction, deleteItemAction } from "@/app/actions";
import type { CaseContext } from "@/data/case-context";
import { caseIds, summariseByCase, summariseTotals } from "@/domain/aggregate";
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
  | { kind: "edit-case"; summary: CaseSummary }
  | { kind: "case-context"; summary: CaseSummary }
  | { kind: "delete-item"; item: DerivedActionItem }
  | { kind: "delete-case"; summary: CaseSummary };

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

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-[1400px] px-4 pt-7 pb-16 sm:px-8 sm:pt-9">
        <header className="mb-7 flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="mb-1.5 text-[12px] font-semibold tracking-[0.12em] text-accent uppercase">
              IAP Monitoring Tracker
            </p>
            <h1 className="text-[24px] font-bold text-ink-strong sm:text-[30px]">
              Dasbor Monitoring Improvement Action Plan
            </h1>
            <p className="mt-2 max-w-[640px] text-[14px] leading-relaxed text-muted">
              Ringkasan kendali &amp; pemantauan tindak lanjut atas seluruh kasus
              irregularity. Data dibaca langsung dari spreadsheet Tracker dan setiap
              perubahan ditulis kembali ke sana.
            </p>
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
          onOpenContext={(summary) => setDialog({ kind: "case-context", summary })}
          onAddStep={(summary) =>
            setDialog({ kind: "new-item", iapId: summary.iapId })
          }
          onEditCase={(summary) => setDialog({ kind: "edit-case", summary })}
          onDeleteCase={(summary) => setDialog({ kind: "delete-case", summary })}
        />

        <Charts items={items} byCase={byCase} totals={totals} />

        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[16px] font-bold text-ink-strong">
            Tabel Tracker — Seluruh Item Aksi
          </h2>
          {criteria.iapId !== ANY ? (
            <button
              type="button"
              className="btn"
              onClick={() => setDialog({ kind: "new-item", iapId: criteria.iapId })}
              data-testid="new-item"
            >
              + Item Aksi untuk {criteria.iapId}
            </button>
          ) : (
            <p className="text-[12px] text-faint">
              Gunakan tombol <b>+ Item</b> pada ringkasan kasus di atas, atau pilih
              satu ID IAP pada filter, untuk menambah item aksi.
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

        <p className="mt-2 text-[12px] text-faint" data-testid="result-count">
          Menampilkan {rows.length} dari {totals.total} item aksi.
        </p>

        <UsageNotes />
      </div>

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
          onClose={close}
          onSaved={afterSave}
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
          onClose={close}
          onSaved={afterSave}
        />
      ) : null}

      {dialog.kind === "case-context" ? (
        <CaseContextModal
          summary={dialog.summary}
          context={caseContext[dialog.summary.iapId] ?? null}
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
