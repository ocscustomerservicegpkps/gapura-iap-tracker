"use client";

import { useRef, useState, useTransition } from "react";
import { createCaseAction, updateCaseAction } from "@/app/actions";
import {
  CONTEXT_FIELD_COUNT,
  emptyContext,
  joinKpis,
  type CaseContext,
} from "@/domain/context";
import type { FieldErrors } from "@/domain/validate";
import type { DerivedActionItem } from "@/domain/types";
import { CaseEvidencePanel } from "./CaseEvidencePanel";
import { Modal } from "./Modal";
import {
  EMPTY_STEP,
  NO_SUGGESTIONS,
  StepFields,
  type StepFormState,
  type DeferredEvidenceSelection,
  type Suggestions,
} from "./StepFields";
import { runAction } from "./run-action";
import { useErrorFocus } from "./use-error-focus";

/** The context block as the form holds it: KPIs are one textarea, one per line. */
type ContextFormState = Omit<CaseContext, "iapId" | "kpis"> & { kpis: string };

function toContextForm(context: CaseContext | null): ContextFormState {
  // `iapId` is dropped deliberately: it lives on the identity field, and leaving it in
  // would make it a seventh entry in a six-field count.
  const { iapId: _iapId, kpis, ...rest } = context ?? emptyContext();
  return { ...rest, kpis: joinKpis(kpis) };
}

function filledCount(form: ContextFormState): number {
  return Object.values(form).filter((value) => value.trim() !== "").length;
}

/** Creating a case walks these three, in order. */
const WIZARD = [
  { title: "Identitas Kasus", hint: "Siapa dan kasus apa." },
  { title: "Konteks Kasus", hint: "Enam bidang standar dokumen IAP." },
  { title: "Langkah Perbaikan", hint: "Matriks rencana perbaikan." },
] as const;

/**
 * Which wizard step owns a failed field, so a rejected save lands on the page that can
 * fix it instead of leaving the user on the last one wondering what went wrong.
 */
function stepOfError(errors: FieldErrors): number | null {
  const keys = Object.keys(errors);
  if (keys.some((k) => k === "iapId" || k === "title" || k === "station")) return 0;
  if (keys.some((k) => k === "steps" || k.startsWith("steps."))) return 2;
  return null;
}

interface CaseModalProps {
  /** Editing an existing case means its ID and steps are fixed; only metadata moves. */
  existing: {
    iapId: string;
    title: string;
    station: string;
    rowCount: number;
  } | null;
  context: CaseContext | null;
  /** Opens the context section straight away, for "Ubah Konteks". */
  focusContext?: boolean;
  suggestions?: Suggestions;
  onClose: () => void;
  onSaved: () => void;
  caseSteps?: readonly DerivedActionItem[];
  onEvidenceStored?: () => void;
}

export function CaseModal({
  existing,
  context,
  focusContext = false,
  suggestions = NO_SUGGESTIONS,
  onClose,
  onSaved,
  caseSteps = [],
  onEvidenceStored = () => {},
}: CaseModalProps) {
  const isNew = existing === null;
  const [iapId, setIapId] = useState(existing?.iapId ?? "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [station, setStation] = useState(existing?.station ?? "");
  const [ctx, setCtx] = useState<ContextFormState>(() => toContextForm(context));
  const [steps, setSteps] = useState<StepFormState[]>([{ ...EMPTY_STEP }]);
  const [pendingEvidence, setPendingEvidence] = useState<
    Array<DeferredEvidenceSelection | null>
  >([null]);
  const [caseCreated, setCaseCreated] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState(0);
  /** How far the user has been; earlier steps stay clickable, later ones do not. */
  const [reached, setReached] = useState(0);
  // Frozen at open: a live `open` prop would slam the section shut the moment the
  // last context field is cleared, mid-edit. Only the edit layout uses it.
  const [contextOpen] = useState(
    () => focusContext || filledCount(toContextForm(context)) > 0,
  );

  // The whole form as it stood when the dialog opened. A three-page wizard is the
  // most expensive thing in the app to lose to a stray Escape.
  const opened = useRef(
    JSON.stringify({ iapId, title, station, ctx, steps }),
  );
  const dirty =
    JSON.stringify({ iapId, title, station, ctx, steps }) !== opened.current ||
    pendingEvidence.some(Boolean);

  useErrorFocus(errors);

  const setField = <K extends keyof ContextFormState>(
    key: K,
    next: ContextFormState[K],
  ) => setCtx((current) => ({ ...current, [key]: next }));

  const updateStep = (index: number, next: StepFormState) => {
    setSteps((cur) => cur.map((s, i) => (i === index ? next : s)));
  };

  /** Reordering matters: step numbers are assigned from position on save. */
  const moveStep = (index: number, delta: number) => {
    setSteps((cur) => {
      const target = index + delta;
      if (target < 0 || target >= cur.length) return cur;
      const next = [...cur];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
    setPendingEvidence((cur) => {
      const target = index + delta;
      if (target < 0 || target >= cur.length) return cur;
      const next = [...cur];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  };

  const goTo = (index: number) => {
    setCurrent(index);
    setReached((r) => Math.max(r, index));
  };

  /**
   * The identity page is the only one that gates progress, and it repeats the two
   * rules the Server Action enforces rather than inventing new ones — catching them
   * here just saves a round trip and two page turns.
   */
  const next = () => {
    if (current === 0) {
      const blocking: FieldErrors = {};
      if (!iapId.trim()) blocking.iapId = "ID IAP wajib diisi.";
      if (!title.trim()) blocking.title = "Judul IAP / Kasus wajib diisi.";
      setErrors(blocking);
      if (Object.keys(blocking).length > 0) return;
    }
    goTo(Math.min(current + 1, WIZARD.length - 1));
  };

  const submit = () => {
    setErrors({});
    startTransition(async () => {
      const result = caseCreated
        ? { ok: true as const }
        : await runAction(() =>
            isNew
              ? createCaseAction({ iapId, title, station, steps, context: ctx })
              : updateCaseAction({
                  iapId: existing.iapId,
                  title,
                  station,
                  context: ctx,
                }),
          );

      if (result.ok) {
        if (isNew) {
          setCaseCreated(true);
          const uploadError = await uploadPendingEvidence();
          if (uploadError) {
            setErrors({ form: uploadError });
            return;
          }
        }
        onSaved();
        return;
      }
      setErrors(result.errors);
      if (isNew) {
        const target = stepOfError(result.errors);
        if (target !== null) setCurrent(target);
      }
    });
  };

  const uploadPendingEvidence = async (): Promise<string | null> => {
    for (const [index, selection] of pendingEvidence.entries()) {
      if (!selection) continue;
      try {
        const body = new FormData();
        body.set("kind", selection.kind);
        body.set("file", selection.file);
        const response = await fetch(
          `/api/evidence/${encodeURIComponent(iapId.trim())}/${index + 1}`,
          { method: "POST", body },
        );
        const result = (await response.json()) as { url?: string; error?: string };
        if (!response.ok || !result.url) {
          throw new Error(result.error || "Upload evidence gagal.");
        }
        setSteps((current) =>
          current.map((step, stepIndex) =>
            stepIndex === index ? { ...step, evidenceLink: result.url! } : step,
          ),
        );
        setPendingEvidence((current) =>
          current.map((entry, stepIndex) => (stepIndex === index ? null : entry)),
        );
      } catch (cause) {
        return `Kasus sudah tersimpan, tetapi evidence langkah ${index + 1} gagal diunggah: ${
          cause instanceof Error ? cause.message : String(cause)
        }. Klik Simpan untuk mencoba ulang file yang belum berhasil.`;
      }
    }
    return null;
  };

  const filled = filledCount(ctx);
  const last = current === WIZARD.length - 1;

  const identity = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="block">
        <label className="label" htmlFor="iapId">
          Number Flight / ID IAP
        </label>
        <input
          id="iapId"
          className="field font-mono"
          data-testid="case-field-id"
          value={iapId}
          disabled={!isNew}
          placeholder="IP810"
          aria-invalid={errors.iapId ? true : undefined}
          aria-describedby="iapId-note"
          onChange={(e) => setIapId(e.target.value)}
        />
        <FieldNote id="iapId-note" error={errors.iapId} testId="case-error-id">
          {isNew
            ? "Nomor penerbangan atau kode kasus. Tidak dapat diubah setelah disimpan."
            : "ID kasus tidak dapat diubah."}
        </FieldNote>
      </div>

      <div className="block">
        <label className="label" htmlFor="station">
          Stasiun / Pihak Terkait
        </label>
        <input
          id="station"
          className="field"
          data-testid="case-field-station"
          value={station}
          placeholder="PT Pelita Air Service — Stasiun CGK"
          onChange={(e) => setStation(e.target.value)}
        />
      </div>

      <div className="block sm:col-span-2">
        <label className="label" htmlFor="title">
          Judul IAP / Kasus
        </label>
        <input
          id="title"
          className="field"
          data-testid="case-field-title"
          value={title}
          placeholder="IP810 — Pelanggaran Prosedur Penanganan Bagasi Tercatat (CGK–KDI)"
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? "title-note" : undefined}
          onChange={(e) => setTitle(e.target.value)}
        />
        <FieldNote id="title-note" error={errors.title} />
      </div>
    </div>
  );

  const contextFields = (
    <>
      <p className="mb-3 text-[11.5px] text-faint">
        Enam bidang standar dokumen IAP. Semuanya opsional — isi yang ada,
        kosongkan sisanya.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Text
          label="Kasus / Insiden"
          testId="context-field-incident"
          value={ctx.incident}
          onChange={(v) => setField("incident", v)}
          area
          wide
          placeholder="IP810 CGK–KDI (27 Jul 2026) — penerbitan label bagasi tanpa bagasi fisik."
        />
        <Text
          label="Pihak Terkait"
          testId="context-field-parties"
          value={ctx.parties}
          onChange={(v) => setField("parties", v)}
        />
        <Text
          label="Tujuan Dokumen"
          testId="context-field-purpose"
          value={ctx.purpose}
          onChange={(v) => setField("purpose", v)}
          placeholder="GM & Manajemen PT Gapura Angkasa Stasiun CGK"
        />
        <Text
          label="Tanggal Efektif"
          testId="context-field-effective-date"
          value={ctx.effectiveDate}
          onChange={(v) => setField("effectiveDate", v)}
          placeholder="12 Agustus 2026"
        />
        <Text
          label="Latar Belakang & Analisis Akar Masalah"
          hint="Termasuk referensi surat peringatan dan komitmen manajemen bila ada."
          testId="context-field-root-cause"
          value={ctx.rootCause}
          onChange={(v) => setField("rootCause", v)}
          area
          wide
          rows="min-h-[140px]"
        />
        <Text
          label="Parameter Keberhasilan (KPI)"
          hint="Satu KPI per baris."
          testId="context-field-kpis"
          value={ctx.kpis}
          onChange={(v) => setField("kpis", v)}
          area
          wide
          rows="min-h-[120px]"
          placeholder={
            "Zero Repeat Unofficial Payment: …\nIntegrity Briefing Compliance: …"
          }
        />
      </div>
    </>
  );

  const stepsBuilder = (
    <>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[11.5px] text-faint">
          {steps.length} langkah. Nomor langkah mengikuti urutan di bawah.
        </p>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setSteps((cur) => [...cur, { ...EMPTY_STEP }]);
            setPendingEvidence((cur) => [...cur, null]);
          }}
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

      <div className="space-y-3">
        {steps.map((step, index) => (
          <fieldset
            key={index}
            className="rounded-[7px] border border-line p-3"
            data-testid={`case-step-${index}`}
          >
            <legend className="flex items-center gap-2 px-1 text-[12px] font-semibold text-ink-mid">
              Langkah {index + 1}
              <Nudge
                label="Naikkan"
                symbol="↑"
                disabled={index === 0}
                onClick={() => moveStep(index, -1)}
                testId={`case-move-up-${index}`}
              />
              <Nudge
                label="Turunkan"
                symbol="↓"
                disabled={index === steps.length - 1}
                onClick={() => moveStep(index, 1)}
                testId={`case-move-down-${index}`}
              />
              {steps.length > 1 ? (
                <button
                  type="button"
                  className="cursor-pointer text-[11.5px] font-semibold text-late-ink hover:underline"
                  onClick={() => {
                    setSteps((cur) => cur.filter((_, i) => i !== index));
                    setPendingEvidence((cur) =>
                      cur.filter((_, i) => i !== index),
                    );
                  }}
                  data-testid={`case-remove-step-${index}`}
                >
                  Hapus
                </button>
              ) : null}
            </legend>
            <StepFields
              value={step}
              onChange={(nextStep) => updateStep(index, nextStep)}
              errors={errors}
              prefix={`steps.${index}.`}
              variant="compact"
              suggestions={suggestions}
              deferredEvidence={{
                fileName: pendingEvidence[index]?.file.name,
                onSelected: (selection) =>
                  setPendingEvidence((current) =>
                    current.map((entry, stepIndex) =>
                      stepIndex === index ? selection : entry,
                    ),
                  ),
              }}
            />
          </fieldset>
        ))}
      </div>

      <p className="mt-2 text-[11px] text-faint">
        Langkah baru selalu tersimpan sebagai <b>Not Started</b> dengan progres 0%.
        Link evidence dapat ditambahkan sekarang; status, progres, dan catatan bukti
        dapat dilengkapi kemudian dari tabel tracker.
      </p>
    </>
  );

  const pages = [identity, contextFields, stepsBuilder];

  return (
    <Modal
      title={isNew ? "Kasus IAP Baru" : `Ubah Kasus ${existing.iapId}`}
      subtitle={
        isNew
          ? `Langkah ${current + 1} dari ${WIZARD.length} — ${WIZARD[current]!.title}: ${WIZARD[current]!.hint}`
          : `Judul, stasiun, dan konteks diterapkan ke ${existing.rowCount} baris kasus ini di tab Tracker.`
      }
      onClose={onClose}
      dirty={dirty}
      testId="case-modal"
      footer={
        <>
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={pending}
          >
            Batal
          </button>
          {isNew && current > 0 ? (
            <button
              type="button"
              className="btn"
              onClick={() => setCurrent(current - 1)}
              disabled={pending}
              data-testid="case-back"
            >
              ← Kembali
            </button>
          ) : null}
          {isNew && !last ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={next}
              data-testid="case-next"
            >
              Lanjut →
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={submit}
              disabled={pending}
              data-testid="case-save"
            >
              {pending ? "Menyimpan…" : "Simpan"}
            </button>
          )}
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

      {isNew ? (
        <>
          <ol
            className="mb-5 flex flex-wrap items-center gap-1.5"
            data-testid="case-stepper"
          >
            {WIZARD.map((page, index) => (
              <li key={page.title} className="flex items-center gap-1.5">
                {index > 0 ? (
                  <span aria-hidden className="text-[11px] text-faint">
                    ─
                  </span>
                ) : null}
                <button
                  type="button"
                  // Only ground already covered is reachable by click; forward
                  // movement goes through the identity check on "Lanjut".
                  disabled={index > reached}
                  aria-current={index === current ? "step" : undefined}
                  onClick={() => setCurrent(index)}
                  data-testid={`case-stepper-${index}`}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold disabled:cursor-default ${
                    index === current
                      ? "border-accent text-accent"
                      : index < reached || index < current
                        ? "border-line text-ink-mid hover:bg-head"
                        : "border-line-soft text-faint"
                  }`}
                >
                  <span
                    className={`flex h-[17px] w-[17px] items-center justify-center rounded-full text-[10px] ${
                      index === current
                        ? "bg-accent text-white"
                        : "bg-head text-label"
                    }`}
                  >
                    {index + 1}
                  </span>
                  {page.title}
                  {index === 1 && filled > 0 ? (
                    <span className="text-[10.5px] font-normal">
                      ({filled}/{CONTEXT_FIELD_COUNT})
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ol>

          <div data-testid={`case-page-${current}`}>{pages[current]}</div>
        </>
      ) : (
        <>
          <Section title="Identitas Kasus" open>
            {identity}
          </Section>
          <Section
            title="Konteks Kasus"
            badge={`${filled}/${CONTEXT_FIELD_COUNT} terisi`}
            open={contextOpen}
            testId="case-context-section"
          >
            {contextFields}
          </Section>
          <p className="mt-4 text-[11.5px] text-faint">
            Langkah-langkah kasus ini diubah satu per satu dari tabel tracker, atau
            ditambah lewat tombol <b>+ Item</b> pada ringkasan kasus.
          </p>
          <Section title="Upload Evidence" open testId="case-evidence-section">
            <CaseEvidencePanel
              iapId={existing.iapId}
              steps={caseSteps}
              onStored={onEvidenceStored}
            />
          </Section>
        </>
      )}
    </Modal>
  );
}

/** Native disclosure — no state, no library, and it survives a re-render. */
function Section({
  title,
  badge,
  open = false,
  testId,
  children,
}: {
  title: string;
  badge?: string;
  open?: boolean;
  testId?: string;
  children: React.ReactNode;
}) {
  return (
    <details
      open={open}
      data-testid={testId}
      className="mb-3 rounded-[8px] border border-line-soft [&[open]>summary]:border-b [&[open]>summary]:border-line-soft [&[open]_.disclosure]:rotate-90"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 text-[13px] font-bold text-ink-strong">
        <span className="flex items-center gap-2">
          <span className="disclosure inline-block text-faint transition-transform">
            ▸
          </span>
          {title}
          {badge ? (
            <span className="rounded-full bg-head px-2 py-0.5 text-[10.5px] font-semibold text-label">
              {badge}
            </span>
          ) : null}
        </span>
      </summary>
      <div className="px-3.5 pt-3 pb-3.5">{children}</div>
    </details>
  );
}

function Text({
  label,
  hint,
  testId,
  value,
  onChange,
  area = false,
  wide = false,
  mono = false,
  rows = "min-h-[70px]",
  placeholder,
}: {
  label: string;
  hint?: string;
  testId: string;
  value: string;
  onChange: (next: string) => void;
  area?: boolean;
  wide?: boolean;
  mono?: boolean;
  rows?: string;
  placeholder?: string;
}) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="label">{label}</span>
      {area ? (
        <textarea
          className={`field ${rows}`}
          data-testid={testId}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className={`field ${mono ? "font-mono" : ""}`}
          data-testid={testId}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {hint ? (
        <span className="mt-1 block text-[11px] text-faint">{hint}</span>
      ) : null}
    </label>
  );
}

function FieldNote({
  id,
  error,
  testId,
  children,
}: {
  id?: string;
  error?: string;
  testId?: string;
  children?: React.ReactNode;
}) {
  if (error) {
    return (
      <span
        id={id}
        className="mt-1 block text-[11.5px] text-late-ink"
        role="alert"
        data-testid={testId}
      >
        {error}
      </span>
    );
  }
  if (!children) return null;
  return (
    <span id={id} className="mt-1 block text-[11px] text-faint">
      {children}
    </span>
  );
}

function Nudge({
  label,
  symbol,
  disabled,
  onClick,
  testId,
}: {
  label: string;
  symbol: string;
  disabled: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
      className="cursor-pointer rounded border border-line px-1.5 text-[11px] leading-[18px] text-ink-mid hover:bg-head disabled:cursor-default disabled:opacity-35"
    >
      {symbol}
    </button>
  );
}
