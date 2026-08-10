import { formatTrackerDate, parseTrackerDate } from "./dates";
import { clampProgress } from "./rows";
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
}

export interface CaseInput {
  iapId: string;
  title: string;
  station: string;
  steps: StepInput[];
}

/** Step fields normalised for storage: dates back to `d Mmm yyyy`, text trimmed. */
export interface NormalisedStep extends StepInput {
  /** `d Mmm yyyy`, the sheet's own format. */
  targetDate: string;
  actualDate: string;
}

function asStatus(raw: unknown): Status | null {
  const text = String(raw ?? "").trim();
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
  return { ok: true, value: { iapId, title, station, steps } };
}

export function validateCaseMetaInput(
  raw: Record<string, unknown>,
): Validated<{ iapId: string; title: string; station: string }> {
  const errors: FieldErrors = {};
  const value = validateCaseFields(raw, errors);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value };
}

/** First message, for surfacing a single-line failure. */
export function firstError(errors: FieldErrors): string {
  return Object.values(errors)[0] ?? "Data tidak valid.";
}
