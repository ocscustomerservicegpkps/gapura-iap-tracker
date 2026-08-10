"use client";

import type { CaseContext } from "@/data/case-context";
import type { CaseSummary } from "@/domain/types";
import { Modal } from "./Modal";

interface CaseContextModalProps {
  summary: CaseSummary;
  context: CaseContext | null;
  onClose: () => void;
}

/**
 * Read-only background from the originating IAP document. Nothing here is stored in
 * the spreadsheet — it exists so a case can be judged without opening the source file.
 */
export function CaseContextModal({
  summary,
  context,
  onClose,
}: CaseContextModalProps) {
  return (
    <Modal
      title={`${summary.iapId} — Konteks Kasus`}
      subtitle={summary.title}
      onClose={onClose}
      testId="case-context-modal"
      footer={
        <button type="button" className="btn" onClick={onClose}>
          Tutup
        </button>
      }
    >
      {context ? (
        <div className="space-y-4 text-[13px] leading-relaxed">
          <Section title="Kasus / Insiden">{context.incident}</Section>
          <Section title="Pihak Terkait">{context.parties}</Section>
          <Section title="Tujuan Dokumen">{context.purpose}</Section>
          <Section title="Tanggal Efektif">{context.effectiveDate}</Section>
          <Section title="Analisis Akar Masalah">{context.rootCause}</Section>

          <div>
            <h3 className="mb-2 text-[11.5px] font-bold tracking-[0.06em] text-label uppercase">
              Parameter Keberhasilan (KPI)
            </h3>
            <ul
              className="list-disc space-y-2 pl-5 text-ink-mid"
              data-testid="case-context-kpis"
            >
              {context.kpis.map((kpi) => (
                <li key={kpi}>{kpi}</li>
              ))}
            </ul>
          </div>

          <p className="border-t border-line-soft pt-3 text-[11.5px] text-faint">
            Sumber dokumen:{" "}
            <span className="font-mono">{context.sourceDocument}</span>
          </p>
        </div>
      ) : (
        <p className="text-[13px] text-faint">
          Belum ada konteks dokumen sumber untuk kasus{" "}
          <span className="font-mono">{summary.iapId}</span>. Kasus yang dibuat
          melalui aplikasi tidak memiliki dokumen sumber terlampir.
        </p>
      )}
    </Modal>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-1 text-[11.5px] font-bold tracking-[0.06em] text-label uppercase">
        {title}
      </h3>
      <p className="text-ink-mid">{children}</p>
    </div>
  );
}
