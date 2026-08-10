"use client";

import { useState, useTransition } from "react";
import { createCaseAction, updateCaseAction } from "@/app/actions";
import type { FieldErrors } from "@/domain/validate";
import { Modal } from "./Modal";
import { EMPTY_STEP, StepFields, type StepFormState } from "./StepFields";
import { runAction } from "./run-action";

interface CaseModalProps {
  /** Editing an existing case means its ID and steps are fixed; only metadata moves. */
  existing: { iapId: string; title: string; station: string; rowCount: number } | null;
  onClose: () => void;
  onSaved: () => void;
}

export function CaseModal({ existing, onClose, onSaved }: CaseModalProps) {
  const isNew = existing === null;
  const [iapId, setIapId] = useState(existing?.iapId ?? "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [station, setStation] = useState(existing?.station ?? "");
  const [steps, setSteps] = useState<StepFormState[]>([{ ...EMPTY_STEP }]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();

  const updateStep = (index: number, next: StepFormState) => {
    setSteps((current) => current.map((s, i) => (i === index ? next : s)));
  };

  const submit = () => {
    setErrors({});
    startTransition(async () => {
      const result = await runAction(() =>
        isNew
          ? createCaseAction({ iapId, title, station, steps })
          : updateCaseAction({ iapId: existing.iapId, title, station }),
      );

      if (result.ok) onSaved();
      else setErrors(result.errors);
    });
  };

  return (
    <Modal
      title={isNew ? "Kasus IAP Baru" : `Ubah Kasus ${existing.iapId}`}
      subtitle={
        isNew
          ? "Metadata kasus diisi sekali dan diterapkan ke seluruh langkahnya."
          : `Perubahan judul dan stasiun akan diterapkan ke ${existing.rowCount} baris kasus ini.`
      }
      onClose={onClose}
      testId="case-modal"
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
            data-testid="case-save"
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
          data-testid="case-error"
        >
          {errors.form}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">ID IAP</span>
          <input
            className="field font-mono"
            data-testid="case-field-id"
            value={iapId}
            disabled={!isNew}
            onChange={(e) => setIapId(e.target.value)}
          />
          {errors.iapId ? (
            <span
              className="mt-1 block text-[11.5px] text-late-ink"
              role="alert"
              data-testid="case-error-id"
            >
              {errors.iapId}
            </span>
          ) : null}
        </label>

        <label className="block">
          <span className="label">Stasiun / Pihak Terkait</span>
          <input
            className="field"
            data-testid="case-field-station"
            value={station}
            onChange={(e) => setStation(e.target.value)}
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="label">Judul IAP / Kasus</span>
          <input
            className="field"
            data-testid="case-field-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          {errors.title ? (
            <span className="mt-1 block text-[11.5px] text-late-ink" role="alert">
              {errors.title}
            </span>
          ) : null}
        </label>
      </div>

      {isNew ? (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-ink-strong">
              Langkah Perbaikan
            </h3>
            <button
              type="button"
              className="btn"
              onClick={() => setSteps((current) => [...current, { ...EMPTY_STEP }])}
              data-testid="case-add-step"
            >
              + Tambah Langkah
            </button>
          </div>

          {errors.steps ? (
            <p className="mb-2 text-[11.5px] text-late-ink" role="alert">
              {errors.steps}
            </p>
          ) : null}

          <div className="space-y-4">
            {steps.map((step, index) => (
              <fieldset
                key={index}
                className="rounded-[7px] border border-line p-3"
                data-testid={`case-step-${index}`}
              >
                <legend className="flex items-center gap-3 px-1 text-[12px] font-semibold text-ink-mid">
                  {/* Numbering follows position, so it stays consistent within the case. */}
                  Langkah {index + 1}
                  {steps.length > 1 ? (
                    <button
                      type="button"
                      className="cursor-pointer text-[11.5px] font-semibold text-late-ink hover:underline"
                      onClick={() =>
                        setSteps((current) =>
                          current.filter((_, i) => i !== index),
                        )
                      }
                      data-testid={`case-remove-step-${index}`}
                    >
                      Hapus
                    </button>
                  ) : null}
                </legend>
                <StepFields
                  value={step}
                  onChange={(next) => updateStep(index, next)}
                  errors={errors}
                  prefix={`steps.${index}.`}
                />
              </fieldset>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-[11.5px] text-faint">
          Langkah-langkah kasus ini diubah satu per satu dari tabel tracker.
        </p>
      )}
    </Modal>
  );
}
