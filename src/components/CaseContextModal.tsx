"use client";

import { hasContext, type CaseContext } from "@/domain/context";
import type { CaseSummary } from "@/domain/types";
import { Modal } from "./Modal";

interface CaseContextModalProps {
  summary: CaseSummary;
  context: CaseContext | null;
  onEdit: () => void;
  onClose: () => void;
}

/**
 * The source IAP document's own framing, read-only. Sections the case has nothing
 * for are left out rather than shown empty — a case raised in the app has no
 * warning letter to cite and no file to point at.
 */
export function CaseContextModal({
  summary,
  context,
  onEdit,
  onClose,
}: CaseContextModalProps) {
  const filled = hasContext(context);

  return (
    <Modal
      title={`${summary.iapId} — Konteks Kasus`}
      subtitle={summary.title}
      onClose={onClose}
      testId="case-context-modal"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Tutup
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onEdit}
            data-testid="case-context-edit"
          >
            {filled ? "Ubah Konteks" : "Isi Konteks"}
          </button>
        </>
      }
    >
      {filled && context ? (
        <div className="space-y-4 text-[13px] leading-relaxed">
          <Section title="Kasus / Insiden">{context.incident}</Section>
          <Section title="Pihak Terkait">{context.parties}</Section>
          <Section title="Tujuan Dokumen">{context.purpose}</Section>
          <Section title="Tanggal Efektif">{context.effectiveDate}</Section>
          <Section title="Latar Belakang & Analisis Akar Masalah">
            {context.rootCause}
          </Section>

          {context.kpis.length > 0 ? (
            <div>
              <Heading>Parameter Keberhasilan (KPI)</Heading>
              <ul
                className="list-disc space-y-2 pl-5 text-ink-mid"
                data-testid="case-context-kpis"
              >
                {context.kpis.map((kpi) => (
                  <li key={kpi}>{kpi}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-[13px] text-faint" data-testid="case-context-empty">
          Belum ada konteks untuk kasus{" "}
          <span className="font-mono">{summary.iapId}</span>. Gunakan{" "}
          <b>Isi Konteks</b> untuk menuliskan insiden, akar masalah, dan Parameter
          Keberhasilan dari dokumen IAP-nya.
        </p>
      )}
    </Modal>
  );
}

/** Renders nothing when the case has nothing to say under this heading. */
function Section({ title, children }: { title: string; children: string }) {
  if (!children.trim()) return null;
  return (
    <div>
      <Heading>{title}</Heading>
      <p className="whitespace-pre-line text-ink-mid">{children}</p>
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1 text-[11.5px] font-bold tracking-[0.06em] text-label uppercase">
      {children}
    </h3>
  );
}
