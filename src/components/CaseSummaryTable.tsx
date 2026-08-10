"use client";

import type { CaseSummary, Totals } from "@/domain/types";

interface CaseSummaryTableProps {
  byCase: readonly CaseSummary[];
  totals: Totals;
  onOpenContext: (summary: CaseSummary) => void;
  onAddStep: (summary: CaseSummary) => void;
  onEditCase: (summary: CaseSummary) => void;
  onDeleteCase: (summary: CaseSummary) => void;
}

export function CaseSummaryTable({
  byCase,
  totals,
  onOpenContext,
  onAddStep,
  onEditCase,
  onDeleteCase,
}: CaseSummaryTableProps) {
  return (
    <section className="card mb-8 px-4 py-4 sm:px-[22px] sm:py-5">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[14px] font-semibold text-ink">
          Ringkasan per Kasus IAP
        </h2>
        <div className="flex items-center gap-3 text-[13px] text-idle">
          Persentase selesai keseluruhan:
          <span className="flex items-center gap-2">
            <span className="h-[8px] w-[90px] overflow-hidden rounded-[4px] bg-[oklch(93%_0.004_250)]">
              <span
                className="block h-full rounded-[4px] bg-done-bar"
                style={{ width: `${totals.pctClosed}%` }}
              />
            </span>
            <b className="text-[15px] text-ink-strong" data-testid="pct-closed">
              {totals.pctClosed}%
            </b>
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]" data-testid="case-summary">
          <thead>
            <tr className="border-b border-[oklch(90%_0.005_250)]">
              <Th>Number Flight / ID IAP</Th>
              <Th>Judul Kasus</Th>
              <Th center>Total</Th>
              <Th center className="text-done">
                Selesai
              </Th>
              <Th center className="text-running">
                Berjalan
              </Th>
              <Th center>Belum Mulai</Th>
              <Th center className="text-late">
                Terlambat
              </Th>
              <Th right>Aksi</Th>
            </tr>
          </thead>
          <tbody>
            {byCase.map((summary) => (
              <tr
                key={summary.iapId}
                className="border-b border-line-soft"
                data-testid={`case-row-${summary.iapId}`}
              >
                <td className="px-2.5 py-2.5 font-mono text-[12px] font-semibold text-ink">
                  {summary.iapId}
                </td>
                <td className="max-w-[360px] px-2.5 py-2.5 text-ink-mid">
                  {summary.title}
                  <span className="mt-0.5 block text-[11px] text-faint">
                    {summary.station}
                  </span>
                </td>
                <td className="px-2.5 py-2.5 text-center">{summary.total}</td>
                <td className="px-2.5 py-2.5 text-center font-semibold text-done">
                  {summary.closed}
                </td>
                <td className="px-2.5 py-2.5 text-center font-semibold text-running">
                  {summary.inProgress}
                </td>
                <td className="px-2.5 py-2.5 text-center text-idle">
                  {summary.open}
                </td>
                <td className="px-2.5 py-2.5 text-center font-semibold text-late">
                  {summary.overdue}
                </td>
                <td className="px-2.5 py-2.5">
                  <div className="flex flex-wrap justify-end gap-2">
                    <LinkButton
                      onClick={() => onOpenContext(summary)}
                      testId={`case-context-${summary.iapId}`}
                    >
                      Konteks
                    </LinkButton>
                    <LinkButton
                      onClick={() => onAddStep(summary)}
                      testId={`case-add-item-${summary.iapId}`}
                    >
                      + Item
                    </LinkButton>
                    <LinkButton
                      onClick={() => onEditCase(summary)}
                      testId={`case-edit-${summary.iapId}`}
                    >
                      Ubah
                    </LinkButton>
                    <LinkButton
                      onClick={() => onDeleteCase(summary)}
                      testId={`case-delete-${summary.iapId}`}
                      danger
                    >
                      Hapus
                    </LinkButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Th({
  children,
  center = false,
  right = false,
  className = "",
}: {
  children: React.ReactNode;
  center?: boolean;
  right?: boolean;
  className?: string;
}) {
  const align = center ? "text-center" : right ? "text-right" : "text-left";
  return (
    <th
      className={`px-2.5 py-2 font-semibold whitespace-nowrap text-idle ${align} ${className}`}
    >
      {children}
    </th>
  );
}

function LinkButton({
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
      className={`cursor-pointer rounded-[5px] border border-line px-2 py-1 text-[11.5px] font-semibold hover:bg-head ${
        danger ? "text-late-ink" : "text-ink-mid"
      }`}
    >
      {children}
    </button>
  );
}
