import type { CaseContext } from "@/domain/context";
import type { ActionItem } from "@/domain/types";

/**
 * One IAP case rendered as the printed document — the same four-section layout the
 * station already circulates in Word: header block, root cause, action matrix, KPIs,
 * closing and signature.
 *
 * The model carries plain strings only, so both writers (`docx.ts`, `print-html.ts`)
 * render the same document and neither has to know where a case lives.
 */
export interface IapDocument {
  iapId: string;
  /** Case title, station and ID, under the main heading. */
  subtitle: string;
  /** Label/value pairs of the header table. Blank fields are dropped. */
  header: readonly { label: string; value: string }[];
  /** Section I, one entry per paragraph. */
  background: readonly string[];
  /** Section II, one entry per action item. */
  matrix: readonly MatrixRow[];
  /** Section III. */
  kpis: readonly string[];
  /** Section IV. */
  closing: string;
}

export interface MatrixRow {
  no: number;
  step: string;
  /** `action`, split on newlines so a multi-case detail stays multi-line in Word. */
  details: readonly string[];
  timeline: string;
  status: string;
  pic: string;
}

export const DOCUMENT_TITLE = "IMPROVEMENT ACTION PLAN (IAP)";

export const SECTIONS = {
  background: "I. LATAR BELAKANG & ANALISIS AKAR MASALAH (ROOT CAUSE ANALYSIS)",
  matrix: "II. MATRIKS RENCANA PERBAIKAN (IMPROVEMENT ACTION PLAN MATRIX)",
  kpi: "III. PARAMETER KEBERHASILAN (KEY PERFORMANCE INDICATORS)",
  closing: "IV. PENUTUP & KOMITMEN MANAJEMEN",
} as const;

export const MATRIX_HEADINGS = [
  "No",
  "Langkah Perbaikan (Sesuai Komitmen)",
  "Rincian Detail Tindakan Konkret per Kasus (Action Items)",
  "Timeline",
  "Status",
  "PIC",
] as const;

/** The signature block, name left blank for whoever signs the printed copy. */
export const SIGNATURE = {
  intro: "Di Buat Oleh",
  name: "(.......................................................)",
  company: "PT. Gapura Angkasa",
} as const;

const lines = (text: string): string[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

export function buildIapDocument(
  items: readonly ActionItem[],
  context: CaseContext | null,
): IapDocument {
  const rows = [...items].sort((a, b) => a.stepNo - b.stepNo);
  const first = rows[0];
  const iapId = first?.iapId ?? context?.iapId ?? "";
  const title = first?.title ?? "";
  const station = first?.station ?? "";

  const header = [
    { label: "ID IAP", value: iapId },
    { label: "Kasus / Insiden", value: context?.incident ?? "" },
    { label: "Pihak Terkait", value: context?.parties ?? "" },
    { label: "Tujuan Dokumen", value: context?.purpose ?? "" },
    { label: "Tanggal Efektif", value: context?.effectiveDate ?? "" },
  ].filter((row) => row.value.trim() !== "");

  return {
    iapId,
    // `station` is written free-form in the sheet ("Stasiun CGK", "Hainan Airlines
    // (HU) - Stasiun CGK"), so it is printed as written rather than prefixed.
    subtitle: [title, station].filter(Boolean).join(" — "),
    header,
    background: lines(context?.rootCause ?? ""),
    matrix: rows.map((row) => ({
      no: row.stepNo,
      step: row.step,
      details: lines(row.action),
      timeline: row.timeline,
      status: row.status,
      pic: row.pic,
    })),
    kpis: context?.kpis ?? [],
    closing:
      `PT Gapura Angkasa berkomitmen mengawal seluruh langkah perbaikan di atas sampai ` +
      `tuntas sesuai timeline dan PIC yang telah ditetapkan, serta melaporkan ` +
      `perkembangannya secara berkala kepada manajemen dan pihak terkait, sehingga ` +
      `kejadian serupa tidak terulang di masa mendatang.`,
  };
}
