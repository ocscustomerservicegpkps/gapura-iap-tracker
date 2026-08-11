"use client";

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
};

interface StepFieldsProps {
  value: StepFormState;
  onChange: (next: StepFormState) => void;
  errors: FieldErrors;
  /** Prefixes both error keys and test ids when several steps share a form. */
  prefix?: string;
}

export function StepFields({
  value,
  onChange,
  errors,
  prefix = "",
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

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field
        label="Langkah Perbaikan"
        error={error("step")}
        className="sm:col-span-2"
      >
        <input
          className="field"
          data-testid={id("field-step")}
          value={value.step}
          onChange={(e) => set("step", e.target.value)}
        />
      </Field>

      <Field
        label="Detail Tindakan"
        error={error("action")}
        className="sm:col-span-2"
      >
        <textarea
          className="field min-h-[76px]"
          data-testid={id("field-action")}
          value={value.action}
          onChange={(e) => set("action", e.target.value)}
        />
      </Field>

      <Field label="PIC (Pemilik)" error={error("pic")}>
        <input
          className="field"
          data-testid={id("field-pic")}
          value={value.pic}
          onChange={(e) => set("pic", e.target.value)}
        />
      </Field>

      <Field label="Linimasa (Target)" error={error("timeline")}>
        <input
          className="field"
          data-testid={id("field-timeline")}
          value={value.timeline}
          onChange={(e) => set("timeline", e.target.value)}
        />
      </Field>

      <Field label="Tanggal Target" error={error("targetDate")}>
        <input
          type="date"
          className="field"
          data-testid={id("field-target-date")}
          value={value.targetDate}
          onChange={(e) => set("targetDate", e.target.value)}
        />
      </Field>

      <Field label="Status" error={error("status")}>
        <select
          className="field"
          data-testid={id("field-status")}
          value={value.status}
          onChange={(e) => setStatus(e.target.value as Status)}
        >
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="% Progres" error={error("progress")}>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            className="flex-1 accent-[oklch(45%_0.1_160)]"
            aria-label="% Progres"
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
          />
        </div>
      </Field>

      <Field label="Tanggal Selesai Aktual" error={error("actualDate")}>
        <input
          type="date"
          className="field"
          data-testid={id("field-actual-date")}
          value={value.actualDate}
          onChange={(e) => set("actualDate", e.target.value)}
        />
      </Field>

      <Field
        label="Bukti / Catatan"
        error={error("evidence")}
        className="sm:col-span-2"
      >
        <textarea
          className="field min-h-[64px]"
          data-testid={id("field-evidence")}
          value={value.evidence}
          onChange={(e) => set("evidence", e.target.value)}
        />
      </Field>
    </div>
  );
}

function Field({
  label,
  error,
  className = "",
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-[11.5px] text-late-ink" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}
