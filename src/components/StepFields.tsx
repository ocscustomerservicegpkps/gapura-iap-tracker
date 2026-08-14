"use client";

import { useState } from "react";
import { STATUSES, type Status } from "@/domain/types";
import type { FieldErrors, StepInput } from "@/domain/validate";
import { STATUS_LABEL } from "./status-styles";

/**
 * One step as the form holds it — the same shape the validator accepts, so what the
 * form produces is exactly what the Server Action is documented to take.
 */
export type StepFormState = StepInput;

export const EMPTY_STEP: StepFormState = {
  step: "",
  action: "",
  pic: "",
  timeline: "",
  targetDate: "",
  status: "Belum Dimulai",
  progress: 0,
  actualDate: "",
  evidence: "",
  evidenceLink: "",
};

/** Values offered by the PIC and Linimasa datalists, gathered from the sheet. */
export interface Suggestions {
  pic: readonly string[];
  timeline: readonly string[];
}

export const NO_SUGGESTIONS: Suggestions = { pic: [], timeline: [] };

interface StepFieldsProps {
  value: StepFormState;
  onChange: (next: StepFormState) => void;
  errors: FieldErrors;
  /** Prefixes both error keys and test ids when several steps share a form. */
  prefix?: string;
  /**
   * `compact` shows only the five columns the source IAP documents' improvement
   * matrix has — Langkah, Rincian, PIC, Timeline, Tanggal Target. A step being
   * planned has no progress to report yet, so the case builder does not ask.
   */
  variant?: "full" | "compact";
  suggestions?: Suggestions;
  evidenceUpload?: EvidenceUploadTarget;
  deferredEvidence?: DeferredEvidenceTarget;
}

export interface EvidenceUploadTarget {
  iapId: string;
  stepNo: number;
  onUploaded: (url: string) => void;
}

export interface DeferredEvidenceTarget {
  fileName?: string;
  onSelected: (selection: DeferredEvidenceSelection | null) => void;
}

export interface DeferredEvidenceSelection {
  kind: "photo" | "document";
  file: File;
}

export function StepFields({
  value,
  onChange,
  errors,
  prefix = "",
  variant = "full",
  suggestions = NO_SUGGESTIONS,
  evidenceUpload,
  deferredEvidence,
}: StepFieldsProps) {
  const set = <K extends keyof StepFormState>(
    key: K,
    next: StepFormState[K],
  ) => {
    onChange({ ...value, [key]: next });
  };

  /** Closing an item pins progress at 100 — a closed step is never partial. */
  const setStatus = (status: Status) => {
    onChange({
      ...value,
      status,
      progress: status === "Selesai" ? 100 : value.progress,
    });
  };

  const id = (name: string) => `${prefix}${name}`;
  const error = (name: string) => errors[`${prefix}${name}`];
  const picListId = `${prefix}pic-options`;
  const timelineListId = `${prefix}timeline-options`;

  /**
   * Wires a control to its label and to whichever note sits under it, so the
   * rejection message is announced as a description rather than swallowed into
   * the field's own name.
   */
  const wire = (name: string, hasNote: boolean) => ({
    id: id(name),
    "aria-invalid": error(name) ? true : undefined,
    "aria-describedby": hasNote || error(name) ? `${id(name)}-note` : undefined,
  });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field
        htmlFor={id("step")}
        label="Langkah Perbaikan"
        hint="Judul langkah, mis. “Penguatan Kontrol & Kewenangan”"
        error={error("step")}
        className="sm:col-span-2"
      >
        <input
          className="field"
          data-testid={id("field-step")}
          value={value.step}
          onChange={(e) => set("step", e.target.value)}
          {...wire("step", true)}
        />
      </Field>

      <Field
        htmlFor={id("action")}
        label="Detail Tindakan"
        hint="Tindakan konkret yang dikerjakan. Satu baris per poin bila lebih dari satu."
        error={error("action")}
        className="sm:col-span-2"
      >
        <textarea
          className="field min-h-[76px]"
          data-testid={id("field-action")}
          value={value.action}
          onChange={(e) => set("action", e.target.value)}
          {...wire("action", true)}
        />
      </Field>

      <Field htmlFor={id("pic")} label="PIC (Pemilik)" error={error("pic")}>
        <input
          className="field"
          list={suggestions.pic.length ? picListId : undefined}
          data-testid={id("field-pic")}
          value={value.pic}
          onChange={(e) => set("pic", e.target.value)}
          {...wire("pic", false)}
        />
        <Options id={picListId} values={suggestions.pic} />
      </Field>

      <Field
        htmlFor={id("timeline")}
        label="Linimasa (Target)"
        hint="Teks bebas, mis. “7–30 hari”, “Rutin Harian”, “90 hari (Berlanjut)”."
        error={error("timeline")}
      >
        <input
          className="field"
          list={suggestions.timeline.length ? timelineListId : undefined}
          data-testid={id("field-timeline")}
          value={value.timeline}
          onChange={(e) => set("timeline", e.target.value)}
          {...wire("timeline", true)}
        />
        <Options id={timelineListId} values={suggestions.timeline} />
      </Field>

      <Field
        htmlFor={id("targetDate")}
        label="Tanggal Target"
        error={error("targetDate")}
        className={variant === "compact" ? "sm:col-span-2" : ""}
      >
        <input
          type="date"
          className="field"
          data-testid={id("field-target-date")}
          value={value.targetDate}
          onChange={(e) => set("targetDate", e.target.value)}
          {...wire("targetDate", false)}
        />
      </Field>

      {variant === "full" ? (
        <>
          <Field htmlFor={id("status")} label="Status" error={error("status")}>
            <select
              className="field"
              data-testid={id("field-status")}
              value={value.status}
              onChange={(e) => setStatus(e.target.value as Status)}
              {...wire("status", false)}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </Field>

          {/* Two controls, one value: a group rather than a label, since a label
              can only ever point at the first of them. */}
          <Field
            as="group"
            label="% Progres"
            error={error("progress")}
            htmlFor={id("progress")}
          >
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                className="flex-1 accent-accent"
                aria-label="% Progres (geser)"
                data-testid={id("field-progress-range")}
                value={value.progress}
                onChange={(e) => set("progress", Number(e.target.value))}
              />
              <input
                type="number"
                min={0}
                max={100}
                className="field w-[76px]"
                aria-label="% Progres (angka)"
                data-testid={id("field-progress")}
                value={value.progress}
                onChange={(e) => set("progress", Number(e.target.value))}
                {...wire("progress", false)}
              />
            </div>
          </Field>

          <Field
            htmlFor={id("actualDate")}
            label="Tanggal Selesai Aktual"
            error={error("actualDate")}
          >
            <input
              type="date"
              className="field"
              data-testid={id("field-actual-date")}
              value={value.actualDate}
              onChange={(e) => set("actualDate", e.target.value)}
              {...wire("actualDate", false)}
            />
          </Field>

          <Field
            htmlFor={id("evidence")}
            label="Bukti / Catatan"
            hint="Apa buktinya dan di mana. Lampirkan tautannya di bawah."
            error={error("evidence")}
            className="sm:col-span-2"
          >
            <textarea
              className="field min-h-[64px]"
              data-testid={id("field-evidence")}
              value={value.evidence}
              onChange={(e) => set("evidence", e.target.value)}
              {...wire("evidence", true)}
            />
          </Field>

          <EvidenceAttachmentField
            id={id}
            error={error("evidenceLink")}
            link={value.evidenceLink}
            onLinkChange={(link) => set("evidenceLink", link)}
            uploadTarget={evidenceUpload}
            deferredTarget={deferredEvidence}
          />
        </>
      ) : null}

      {variant === "compact" ? (
        <EvidenceAttachmentField
          id={id}
          error={error("evidenceLink")}
          link={value.evidenceLink}
          onLinkChange={(link) => set("evidenceLink", link)}
          deferredTarget={deferredEvidence}
        />
      ) : null}
    </div>
  );
}

type EvidenceMode = "link" | "photo" | "document";

function EvidenceAttachmentField({
  id,
  error,
  link,
  onLinkChange,
  uploadTarget,
  deferredTarget,
}: {
  id: (name: string) => string;
  error?: string;
  link: string;
  onLinkChange: (link: string) => void;
  uploadTarget?: EvidenceUploadTarget;
  deferredTarget?: DeferredEvidenceTarget;
}) {
  const [mode, setMode] = useState<EvidenceMode>("document");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const isDeferred = !uploadTarget && !!deferredTarget;

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (deferredTarget && !uploadTarget) {
      onLinkChange("");
      deferredTarget.onSelected({ kind: mode as "photo" | "document", file });
      setUploadError(null);
      setUploadedName(file.name);
      return;
    }
    if (!uploadTarget) return;
    setUploading(true);
    setUploadError(null);
    setUploadedName(null);
    try {
      const body = new FormData();
      body.set("kind", mode);
      body.set("file", file);
      const response = await fetch(
        `/api/evidence/${encodeURIComponent(uploadTarget.iapId)}/${uploadTarget.stepNo}`,
        { method: "POST", body },
      );
      const result = (await response.json()) as {
        url?: string;
        name?: string;
        error?: string;
      };
      if (!response.ok || !result.url) {
        throw new Error(result.error || "Upload evidence gagal.");
      }
      // Keep the new URL in the form payload as well. The API has already appended
      // it to Q, and the repository's de-duplicating merge makes the later Save safe.
      // It remains hidden while file mode is active, so existing links are not editable.
      onLinkChange(result.url);
      uploadTarget.onUploaded(result.url);
      setUploadedName(result.name || file.name);
    } catch (cause) {
      setUploadError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setUploading(false);
    }
  };

  const inputId = id("evidenceLink");
  const selectMode = (next: EvidenceMode) => {
    const changed = next !== mode;
    setMode(next);
    setUploadError(null);
    if (changed) {
      onLinkChange("");
      setUploadedName(null);
      deferredTarget?.onSelected(null);
    }
  };
  return (
    <div className="sm:col-span-2">
      <fieldset>
        <legend className="label">Evidence</legend>
        <div className="mb-2 flex flex-wrap gap-2" data-testid={id("evidence-modes")}>
          <EvidenceModeChoice
            checked={mode === "document"}
            label="Upload Dokumen"
            testId={id("evidence-mode-document")}
            groupName={id("evidence-mode")}
            onChange={() => selectMode("document")}
          />
          <EvidenceModeChoice
            checked={mode === "photo"}
            label="Upload Foto"
            testId={id("evidence-mode-photo")}
            groupName={id("evidence-mode")}
            onChange={() => selectMode("photo")}
          />
          <EvidenceModeChoice
            checked={mode === "link"}
            label="Link Evidence"
            testId={id("evidence-mode-link")}
            groupName={id("evidence-mode")}
            onChange={() => selectMode("link")}
          />
        </div>
      </fieldset>

      {mode === "link" ? (
        <textarea
          id={inputId}
          placeholder="https://drive.google.com/…"
          className="field min-h-[72px]"
          data-testid={id("field-evidence-link")}
          value={link}
          onChange={(event) => onLinkChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${inputId}-note`}
        />
      ) : (
        <div>
          <input
            id={inputId}
            type="file"
            accept={
              mode === "photo"
                ? "image/jpeg,image/png,image/webp,image/heic,image/heif"
                : ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            }
            className="field file:mr-3 file:rounded file:border-0 file:bg-head file:px-2 file:py-1"
            data-testid={id("field-evidence-file")}
            disabled={(!uploadTarget && !deferredTarget) || uploading}
            onChange={(event) => void upload(event.target.files?.[0])}
            aria-describedby={`${inputId}-note`}
          />
          {!uploadTarget && !deferredTarget ? (
            <p className="mt-1 text-[11px] text-running-ink">
              Simpan item terlebih dahulu, lalu buka Ubah untuk mengunggah file.
            </p>
          ) : null}
        </div>
      )}

      <span id={`${inputId}-note`} className="mt-1 block text-[11px] text-faint">
        {mode === "link"
          ? "Masukkan satu URL lengkap per baris. Tambahkan link baru di bawah link sebelumnya."
          : isDeferred
            ? "File akan diunggah setelah kasus berhasil dibuat."
            : "File disimpan ke Google Drive dan link-nya otomatis ditulis ke kolom Q."}
      </span>
      {uploading ? (
        <p className="mt-1 text-[11.5px] text-accent" role="status">
          Mengunggah ke Google Drive…
        </p>
      ) : null}
      {uploadedName ? (
        <p className="mt-1 text-[11.5px] text-done" role="status" data-testid={id("evidence-uploaded")}>
          {isDeferred
            ? `${uploadedName} siap diunggah saat kasus disimpan.`
            : `${uploadedName} berhasil diunggah dan link tersimpan.`}
        </p>
      ) : null}
      {uploadError || error ? (
        <p className="mt-1 text-[11.5px] text-late-ink" role="alert" data-testid={id("evidence-upload-error")}>
          {uploadError || error}
        </p>
      ) : null}
    </div>
  );
}

function EvidenceModeChoice({
  checked,
  label,
  testId,
  groupName,
  onChange,
}: {
  checked: boolean;
  label: string;
  testId: string;
  groupName: string;
  onChange: () => void;
}) {
  return (
    <label className={`flex cursor-pointer items-center gap-1.5 rounded-[6px] border px-2.5 py-1.5 text-[11.5px] font-semibold ${checked ? "border-accent bg-done-soft text-accent" : "border-line text-ink-mid"}`}>
      <input
        type="radio"
        name={groupName}
        checked={checked}
        onChange={onChange}
        data-testid={testId}
        className="accent-accent"
      />
      {label}
    </label>
  );
}

/** Native autocomplete: type-ahead over what the sheet already uses, still free text. */
function Options({ id, values }: { id: string; values: readonly string[] }) {
  if (values.length === 0) return null;
  return (
    <datalist id={id}>
      {values.map((value) => (
        <option key={value} value={value} />
      ))}
    </datalist>
  );
}

function Field({
  htmlFor,
  label,
  hint,
  error,
  className = "",
  as = "label",
  children,
}: {
  htmlFor: string;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  /** `group` for the one field whose value is edited by two controls at once. */
  as?: "label" | "group";
  children: React.ReactNode;
}) {
  const note = error ? (
    <span
      id={`${htmlFor}-note`}
      className="mt-1 block text-[11.5px] text-late-ink"
      role="alert"
    >
      {error}
    </span>
  ) : hint ? (
    <span id={`${htmlFor}-note`} className="mt-1 block text-[11px] text-faint">
      {hint}
    </span>
  ) : null;

  if (as === "group") {
    return (
      <div className={`block ${className}`} role="group" aria-label={label}>
        <span className="label">{label}</span>
        {children}
        {note}
      </div>
    );
  }

  return (
    <div className={`block ${className}`}>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {note}
    </div>
  );
}
