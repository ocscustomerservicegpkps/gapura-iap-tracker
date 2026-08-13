import { emptyContext, splitKpis, type CaseContext } from "./context";
import { formatTrackerDate, parseTrackerDate } from "./dates";
import { clampProgress, safeLink } from "./rows";
import { STATUSES, type Status } from "./types";

/** Field name → Indonesian message. Keys match the form control names. */
export type FieldErrors = Record<string, string>;

export type Validated<T> =
  | { ok: true; value: T }
  | { ok: false; errors: FieldErrors };

/**
 * What a step form submits. Dates arrive as `YYYY-MM-DD` from the date picker and
 * leave as `d Mmm yyyy` — see {@link NormalisedStep}.
 */
export interface StepInput {
  step: string;
  action: string;
  pic: string;
  timeline: string;
  targetDate: string;
  status: Status;
  progress: number;
  actualDate: string;
  evidence: string;
  evidenceLink: string;
}

export interface CaseInput {
  iapId: string;
  title: string;
  station: string;
  steps: StepInput[];
  context: CaseContext;
}

export interface CaseMetaInput {
  iapId: string;
  title: string;
  station: string;
  context: CaseContext;
}

/** Step fields normalised for storage: dates back to `d Mmm yyyy`, text trimmed. */
export interface NormalisedStep extends StepInput {
  /** `d Mmm yyyy`, the sheet's own format. */
  targetDate: string;
  actualDate: string;
}

/**
 * An omitted status means "not started" — the case builder's compact step form does
 * not ask, because a step being planned has never been started.
 */
function asStatus(raw: unknown): Status | null {
  const text = String(raw ?? "").trim();
  if (text === "") return "Belum Dimulai";
  return STATUSES.find((s) => s === text) ?? null;
}

function text(raw: unknown): string {
  return String(raw ?? "").trim();
}

function readProgress(raw: unknown): number | null {
  const value = Number(String(raw ?? "").trim());
  if (!Number.isFinite(value)) return null;
  if (!Number.isInteger(value)) return null;
  if (value < 0 || value > 100) return null;
  return value;
}

/**
 * Shared step rules. `Selesai` closes the loop: it pins progress at 100 and demands
 * a completion date, so an item cannot be closed half-recorded.
 */
function validateStep(
  raw: Record<string, unknown>,
  errors: FieldErrors,
  prefix = "",
): NormalisedStep | null {
  const key = (name: string) => `${prefix}${name}`;

  const step = text(raw.step);
  const action = text(raw.action);
  if (!step) errors[key("step")] = "Langkah Perbaikan wajib diisi.";
  if (!action) errors[key("action")] = "Detail Tindakan wajib diisi.";

  const status = asStatus(raw.status);
  if (!status) {
    errors[key("status")] =
      "Status harus salah satu dari Selesai, Sedang Berjalan, Belum Dimulai.";
  }

  const rawProgress = readProgress(raw.progress);
  if (rawProgress === null) {
    errors[key("progress")] = "% Progres harus bilangan bulat 0–100.";
  }

  const targetRaw = text(raw.targetDate);
  const targetIso = parseTrackerDate(targetRaw);
  if (targetRaw && !targetIso) {
    errors[key("targetDate")] = "Tanggal Target tidak dapat dibaca.";
  }

  const actualRaw = text(raw.actualDate);
  const actualIso = parseTrackerDate(actualRaw);
  if (actualRaw && !actualIso) {
    errors[key("actualDate")] = "Tanggal Selesai Aktual tidak dapat dibaca.";
  }

  if (status === "Selesai" && !actualIso) {
    errors[key("actualDate")] =
      "Item Selesai wajib mencantumkan Tanggal Selesai Aktual.";
  }

  // Rejected rather than silently blanked: a PIC who pasted a Drive path or typed a
  // bare domain needs to be told, not to have their evidence quietly vanish on save.
  const linkRaw = text(raw.evidenceLink);
  const link = safeLink(linkRaw);
  const submittedLinkCount = linkRaw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length;
  const validLinkCount = link ? link.split("\n").length : 0;
  if (submittedLinkCount !== validLinkCount) {
    errors[key("evidenceLink")] =
      "Setiap Link Evidence harus berupa URL lengkap yang diawali http:// atau https://.";
  }

  if (Object.keys(errors).length > 0) return null;

  return {
    step,
    action,
    pic: text(raw.pic),
    timeline: text(raw.timeline),
    targetDate: formatTrackerDate(targetIso),
    status: status!,
    progress: status === "Selesai" ? 100 : clampProgress(rawProgress!),
    actualDate: formatTrackerDate(actualIso),
    evidence: String(raw.evidence ?? "").trim(),
    evidenceLink: link,
  };
}

/** One action item's own fields. The case it belongs to is never edited here. */
export function validateStepInput(
  raw: Record<string, unknown>,
): Validated<NormalisedStep> {
  const errors: FieldErrors = {};
  const step = validateStep(raw, errors);
  if (!step) return { ok: false, errors };
  return { ok: true, value: step };
}

/** The fields that identify and describe a case, shared by create and edit. */
function validateCaseFields(
  raw: Record<string, unknown>,
  errors: FieldErrors,
): { iapId: string; title: string; station: string } {
  const iapId = text(raw.iapId);
  const title = text(raw.title);
  if (!iapId) errors.iapId = "ID IAP wajib diisi.";
  if (!title) errors.title = "Judul IAP / Kasus wajib diisi.";
  return { iapId, title, station: text(raw.station) };
}

/**
 * The context block. Every field is free text and every one of them is optional —
 * an IAP raised in the app has no source document to quote, and forcing a
 * placeholder in would be worse than leaving the section blank.
 */
export function normaliseContext(
  raw: unknown,
  iapId: string,
): CaseContext {
  const source = (raw ?? {}) as Record<string, unknown>;
  const rawKpis = source.kpis;
  return {
    ...emptyContext(iapId),
    incident: text(source.incident),
    parties: text(source.parties),
    purpose: text(source.purpose),
    effectiveDate: text(source.effectiveDate),
    rootCause: text(source.rootCause),
    kpis: Array.isArray(rawKpis)
      ? splitKpis(rawKpis.map((kpi) => String(kpi ?? "")).join("\n"))
      : splitKpis(String(rawKpis ?? "")),
  };
}

export function validateCaseInput(
  raw: Record<string, unknown>,
): Validated<CaseInput> {
  const errors: FieldErrors = {};
  const { iapId, title, station } = validateCaseFields(raw, errors);

  const rawSteps = Array.isArray(raw.steps) ? raw.steps : [];
  if (rawSteps.length === 0) {
    errors.steps = "Minimal satu langkah diperlukan.";
    return { ok: false, errors };
  }

  const steps: NormalisedStep[] = [];
  rawSteps.forEach((entry, index) => {
    const stepErrors: FieldErrors = {};
    const step = validateStep(
      (entry ?? {}) as Record<string, unknown>,
      stepErrors,
      `steps.${index}.`,
    );
    Object.assign(errors, stepErrors);
    if (step) steps.push(step);
  });

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      iapId,
      title,
      station,
      steps,
      context: normaliseContext(raw.context, iapId),
    },
  };
}

export function validateCaseMetaInput(
  raw: Record<string, unknown>,
): Validated<CaseMetaInput> {
  const errors: FieldErrors = {};
  const value = validateCaseFields(raw, errors);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { ...value, context: normaliseContext(raw.context, value.iapId) },
  };
}

/** First message, for surfacing a single-line failure. */
export function firstError(errors: FieldErrors): string {
  return Object.values(errors)[0] ?? "Data tidak valid.";
}
