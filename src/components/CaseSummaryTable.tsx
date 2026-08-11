"use client";

import type { CaseSummary, Totals } from "@/domain/types";

interface CaseSummaryTableProps {
  byCase: readonly CaseSummary[];
  totals: Totals;
  /** Drives the Konteks button's label, so a gap is visible without opening it. */
  hasContext: (iapId: string) => boolean;
  onOpenContext: (summary: CaseSummary) => void;
  onAddStep: (summary: CaseSummary) => void;
  onEditCase: (summary: CaseSummary) => void;
  onDeleteCase: (summary: CaseSummary) => void;
}

export function CaseSummaryTable({
  byCase,
  totals,
  hasContext,
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
            <span className="h-[8px] w-[90px] overflow-hidden rounded-[4px] bg-track">
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

      {/* Phones get the same treatment the tracker table gets: one card per case,
          because eight columns behind a sideways scroll is not a summary. */}
      <ul className="space-y-3 md:hidden" data-testid="case-summary-cards">
        {byCase.map((summary) => (
          <li
            key={summary.iapId}
            className="rounded-[8px] border border-line-soft px-3.5 py-3"
            data-testid={`case-card-${summary.iapId}`}
          >
            <div className="font-mono text-[12px] font-semibold text-ink">
              {summary.iapId}
            </div>
            <div className="mt-0.5 text-[12px] leading-snug text-ink-mid">
              {summary.title}
            </div>
            <div className="mt-0.5 text-[11px] text-faint">
              {summary.station}
            </div>

            <dl className="mt-2.5 grid grid-cols-3 gap-2 text-[11.5px]">
              <Tally label="Total" value={summary.total} />
              <Tally label="Completed" value={summary.closed} tone="text-done" />
              <Tally label="Ongoing" value={summary.inProgress} tone="text-running" />
              <Tally label="Not Started" value={summary.open} tone="text-idle" />
              <Tally label="Overdue" value={summary.overdue} tone="text-late" />
            </dl>

            <div className="mt-3 flex flex-wrap gap-2">
              <LinkButton
                onClick={() => onOpenContext(summary)}
                testId={`case-card-context-${summary.iapId}`}
              >
                {hasContext(summary.iapId) ? "Konteks" : "+ Konteks"}
              </LinkButton>
              <LinkButton
                onClick={() => onAddStep(summary)}
                testId={`case-card-add-item-${summary.iapId}`}
              >
                + Item
              </LinkButton>
              <LinkButton
                onClick={() => onEditCase(summary)}
                testId={`case-card-edit-${summary.iapId}`}
              >
                Ubah
              </LinkButton>
              <LinkButton
                onClick={() => onDeleteCase(summary)}
                testId={`case-card-delete-${summary.iapId}`}
                danger
              >
                Hapus
              </LinkButton>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-[13px]" data-testid="case-summary">
          <caption className="sr-only">
            Ringkasan item aksi per kasus IAP: jumlah total, selesai, sedang
            berjalan, belum dimulai, dan terlambat.
          </caption>
          <thead>
            <tr className="border-b border-line">
              <Th>Number Flight / ID IAP</Th>
              <Th>Judul Kasus</Th>
              <Th center>Total</Th>
              <Th center className="text-done">
                Completed
              </Th>
              <Th center className="text-running">
                Ongoing
              </Th>
              <Th center>Not Started</Th>
              <Th center className="text-late">
                Overdue
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
                <th
                  scope="row"
                  className="px-2.5 py-2.5 text-left font-mono text-[12px] font-semibold text-ink"
                >
                  {summary.iapId}
                </th>
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
                      {hasContext(summary.iapId) ? "Konteks" : "+ Konteks"}
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
      scope="col"
      className={`px-2.5 py-2 font-semibold whitespace-nowrap text-idle ${align} ${className}`}
    >
      {children}
    </th>
  );
}

/** One count on the phone card, labelled the way its column is labelled. */
function Tally({
  label,
  value,
  tone = "text-ink",
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div>
      <dt className="font-semibold text-label">{label}</dt>
      <dd className={`text-[15px] font-bold ${tone}`}>{value}</dd>
    </div>
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
      className={`min-h-[28px] cursor-pointer rounded-[5px] border border-line px-2.5 py-1 text-[11.5px] font-semibold hover:bg-head ${
        danger ? "text-late-ink" : "text-ink-mid"
      }`}
    >
      {children}
    </button>
  );
}
