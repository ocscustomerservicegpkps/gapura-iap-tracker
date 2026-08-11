"use client";

import { useState, useTransition } from "react";
import { createItemAction, saveItemAction } from "@/app/actions";
import { formatTrackerDate } from "@/domain/dates";
import { deriveOverdue } from "@/domain/overdue";
import type { DerivedActionItem } from "@/domain/types";
import type { FieldErrors } from "@/domain/validate";
import { Modal } from "./Modal";
import { OVERDUE_LABEL, OVERDUE_PILL } from "./status-styles";
import { EMPTY_STEP, StepFields, type StepFormState } from "./StepFields";
import { runAction } from "./run-action";

interface ItemModalProps {
  /** The row being edited, or null when adding a step to `iapId`. */
  item: DerivedActionItem | null;
  iapId: string;
  caseTitle: string;
  caseStation: string;
  today: string;
  onClose: () => void;
  onSaved: () => void;
}

function toFormState(item: DerivedActionItem): StepFormState {
  return {
    step: item.step,
    action: item.action,
    pic: item.pic,
    timeline: item.timeline,
    targetDate: item.targetIso ?? "",
    status: item.status,
    progress: item.progress,
    actualDate: item.actualIso ?? "",
    evidence: item.evidence,
  };
}

export function ItemModal({
  item,
  iapId,
  caseTitle,
  caseStation,
  today,
  onClose,
  onSaved,
}: ItemModalProps) {
  const [form, setForm] = useState<StepFormState>(
    item ? toFormState(item) : EMPTY_STEP,
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();

  const isNew = item === null;
  // Column N is derived, so the modal can show what the save will store.
  const overdue = deriveOverdue(
    { status: form.status, targetDate: form.targetDate },
    today,
  );

  const submit = () => {
    setErrors({});
    startTransition(async () => {
      const payload = { ...form };
      const result = await runAction(() =>
        isNew
          ? createItemAction(iapId, payload)
          : saveItemAction({ iapId, stepNo: item.stepNo }, payload),
      );

      if (result.ok) onSaved();
      else setErrors(result.errors);
    });
  };

  return (
    <Modal
      title={isNew ? "Tambah Item Aksi" : `Ubah Langkah ${item.stepNo}`}
      subtitle={`${iapId} — ${caseTitle}`}
      onClose={onClose}
      testId="item-modal"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={pending}>
            Batal
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={submit}
            disabled={pending}
            data-testid="item-save"
          >
            {pending ? "Menyimpan…" : "Simpan"}
          </button>
        </>
      }
    >
      {errors.form ? (
        <p
          className="mb-3 rounded-[7px] bg-late-soft px-3 py-2 text-[12px] text-late-ink"
          role="alert"
          data-testid="item-error"
        >
          {errors.form}
        </p>
      ) : null}

      <dl className="mb-4 grid grid-cols-2 gap-3 rounded-[7px] bg-head px-3 py-3 text-[11.5px] sm:grid-cols-4">
        <Readout label="Number Flight / ID IAP" value={iapId} mono />
        <Readout
          label="No Langkah"
          value={isNew ? "otomatis" : String(item.stepNo)}
        />
        <Readout label="Stasiun / Pihak Terkait" value={caseStation || "—"} />
        <div>
          <dt className="font-semibold text-label">Overdue Status</dt>
          <dd className="mt-1">
            <span
              className={`pill ${OVERDUE_PILL[overdue]}`}
              data-testid="item-overdue-preview"
            >
              {OVERDUE_LABEL[overdue]}
            </span>
          </dd>
        </div>
      </dl>

      <StepFields value={form} onChange={setForm} errors={errors} />

      <p className="mt-3 text-[11px] text-faint">
        Tanggal disimpan ke spreadsheet dalam format Indonesia
        {form.targetDate ? ` (contoh: ${formatTrackerDate(form.targetDate)})` : ""}.
        Kolom Overdue Status dihitung otomatis dan ikut diperbarui saat menyimpan.
      </p>
    </Modal>
  );
}

function Readout({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="font-semibold text-label">{label}</dt>
      <dd className={`mt-1 text-ink ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
