/**
 * Case context — the standard header block of an IAP document, one record per case.
 *
 * The six fields below are the agreed standard and the whole of it. Anything a
 * particular document adds on top (a warning-letter reference, a closing commitment,
 * the filename it came from) belongs inside the narrative fields, not as another
 * column: a schema that grows a field per document variant stops being a standard.
 *
 * Every field is optional. A case raised from a phone call has no document to quote,
 * and an empty section is simply not rendered.
 */
export interface CaseContext {
  iapId: string;
  /** Kasus / Insiden */
  incident: string;
  /** Pihak Terkait */
  parties: string;
  /** Tujuan Dokumen */
  purpose: string;
  /** Tanggal Efektif, as written in the document. */
  effectiveDate: string;
  /** Latar Belakang & Analisis Akar Masalah. */
  rootCause: string;
  /** Parameter Keberhasilan (KPI), one per entry. Stored newline-separated in one cell. */
  kpis: string[];
}

/** Columns A–G of the `Konteks` tab. */
export const CONTEXT_COLUMN_COUNT = 7;

export const CONTEXT_HEADER: readonly string[] = [
  "ID IAP",
  "Kasus / Insiden",
  "Pihak Terkait",
  "Tujuan Dokumen",
  "Tanggal Efektif",
  "Latar Belakang & Analisis Akar Masalah",
  "Parameter Keberhasilan (KPI)",
];

export function emptyContext(iapId = ""): CaseContext {
  return {
    iapId,
    incident: "",
    parties: "",
    purpose: "",
    effectiveDate: "",
    rootCause: "",
    kpis: [],
  };
}

/** Blank lines are dropped so a stray Enter does not become an empty KPI bullet. */
export function splitKpis(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*[-•*]\s*/, "").trim())
    .filter((line) => line !== "");
}

export function joinKpis(kpis: readonly string[]): string {
  return kpis.join("\n");
}

export function rowToContext(cells: readonly unknown[]): CaseContext {
  const c: string[] = [];
  for (let i = 0; i < CONTEXT_COLUMN_COUNT; i += 1) {
    const cell = cells[i];
    c.push(cell === null || cell === undefined ? "" : String(cell));
  }
  return {
    iapId: c[0]!.trim(),
    incident: c[1]!,
    parties: c[2]!,
    purpose: c[3]!,
    effectiveDate: c[4]!,
    rootCause: c[5]!,
    kpis: splitKpis(c[6]!),
  };
}

export function contextToRow(context: CaseContext): string[] {
  return [
    context.iapId,
    context.incident,
    context.parties,
    context.purpose,
    context.effectiveDate,
    context.rootCause,
    joinKpis(context.kpis),
  ];
}

/** True when at least one field beyond the ID carries something. */
export function hasContext(context: CaseContext | null | undefined): boolean {
  if (!context) return false;
  const { iapId: _iapId, kpis, ...text } = context;
  return (
    kpis.length > 0 || Object.values(text).some((value) => value.trim() !== "")
  );
}

/** How much of the document has been captured, for the "3/6 terisi" hint on the form. */
export function contextFilledCount(context: CaseContext): number {
  const { iapId: _iapId, kpis, ...text } = context;
  return (
    Object.values(text).filter((value) => value.trim() !== "").length +
    (kpis.length > 0 ? 1 : 0)
  );
}

/** Denominator for {@link contextFilledCount}. */
export const CONTEXT_FIELD_COUNT = CONTEXT_COLUMN_COUNT - 1;
