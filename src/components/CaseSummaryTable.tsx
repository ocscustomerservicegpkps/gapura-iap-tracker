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
            <div className="mt-2">
              <div className="text-[11px] font-semibold text-label">Link Evidence</div>
              <CaseEvidenceLinks
                links={summary.evidenceLinks}
                iapId={summary.iapId}
                prefix="case-card"
                className="mt-1"
              />
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
              <DownloadLinks iapId={summary.iapId} prefix="case-card" />
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
        <table
          // Headers wrap rather than run into the next column: under `table-fixed`
          // a `nowrap` heading overflows its cell instead of widening it.
          className="w-full table-fixed border-collapse text-[13px] [&_td]:break-words [&_thead_th]:whitespace-normal"
          data-testid="case-summary"
        >
          <caption className="sr-only">
            Ringkasan item aksi per kasus IAP: jumlah total, selesai, sedang
            berjalan, belum dimulai, dan terlambat.
          </caption>
          {/*
            Without this the browser splits the width by header text, which left
            `Judul Kasus` about 110px and wrapped every title over five lines —
            the tallest thing in the row. The counts and actions are what have a
            known size, so they are pinned and the title takes the remainder.
          */}
          <colgroup>
            <col className="w-[112px]" />
            <col />
            <col className="w-[124px]" />
            <col className="w-[46px]" />
            <col className="w-[76px]" />
            <col className="w-[64px]" />
            <col className="w-[60px]" />
            <col className="w-[64px]" />
            <col className="w-[168px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-line">
              <Th>Number Flight / ID IAP</Th>
              <Th>Judul Kasus</Th>
              <Th>Link Evidence</Th>
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
                <td className="px-2.5 py-2.5 align-top text-[12.5px] leading-snug text-ink-mid">
                  {summary.title}
                  <span className="mt-0.5 block text-[11px] leading-snug text-faint">
                    {summary.station}
                  </span>
                </td>
                <td className="min-w-[130px] px-2.5 py-2.5 align-top">
                  <CaseEvidenceLinks
                    links={summary.evidenceLinks}
                    iapId={summary.iapId}
                    prefix="case"
                  />
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
                {/* Six actions in a narrow column wrap one-per-line and set the
                    height of the whole table. A fixed two-column grid pairs them
                    into three predictable rows instead. */}
                <td className="px-2.5 py-2.5 align-top">
                  <div className="grid grid-cols-2 gap-1.5">
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
                    <DownloadLinks iapId={summary.iapId} prefix="case" />
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

/**
 * The case as its IAP document. Plain links, so the browser downloads the Word file
 * and opens the print page — which prints itself — without any client code.
 */
function DownloadLinks({ iapId, prefix }: { iapId: string; prefix: string }) {
  const href = `/api/export/${encodeURIComponent(iapId)}`;
  return (
    <>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        data-testid={`${prefix}-pdf-${iapId}`}
        title={`Cetak / simpan PDF dokumen IAP ${iapId}`}
        className={`${LINK_CLASS} text-ink-mid`}
      >
        PDF
      </a>
      <a
        href={`${href}?format=docx`}
        data-testid={`${prefix}-docx-${iapId}`}
        title={`Unduh dokumen Word IAP ${iapId}`}
        className={`${LINK_CLASS} text-ink-mid`}
      >
        DOCX
      </a>
    </>
  );
}

function CaseEvidenceLinks({
  links,
  iapId,
  prefix,
  className = "",
}: {
  links: readonly string[];
  iapId: string;
  prefix: string;
  className?: string;
}) {
  if (links.length === 0) {
    return <span className={`text-[11px] text-faint ${className}`}>—</span>;
  }
  return (
    <div className={`space-y-1 ${className}`} aria-label={`Link Evidence ${iapId}`}>
      {links.map((link, index) => (
        <a
          key={link}
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          data-testid={`${prefix}-evidence-${iapId}-${index + 1}`}
          className="block text-[11.5px] font-semibold text-accent underline underline-offset-2"
        >
          Click Evidence {index + 1}
        </a>
      ))}
    </div>
  );
}

/**
 * Compact on purpose. Six of these sit in the summary's `Aksi` cell, and at the
 * previous size they wrapped one-per-line — which set the height of every row in
 * the table to ~237px and pushed the tracker below six screens of summary.
 */
const LINK_CLASS =
  "flex min-h-[26px] cursor-pointer items-center justify-center whitespace-nowrap rounded-[5px] border border-line px-2 py-0.5 text-[11px] font-semibold hover:bg-head";

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
      className={`${LINK_CLASS} ${danger ? "text-late-ink" : "text-ink-mid"}`}
    >
      {children}
    </button>
  );
}
