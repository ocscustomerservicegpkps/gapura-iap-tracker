"use client";

import { useMemo, useState, useTransition } from "react";
import { appendCaseEvidenceAction } from "@/app/actions";
import type { DerivedActionItem } from "@/domain/types";
import { runAction } from "./run-action";

type EvidenceMode = "link" | "photo" | "document";
type TargetMode = "all" | "selected";

export function CaseEvidencePanel({
  iapId,
  steps,
  onStored,
}: {
  iapId: string;
  steps: readonly DerivedActionItem[];
  onStored: () => void;
}) {
  const ordered = useMemo(
    () => [...steps].sort((a, b) => a.stepNo - b.stepNo),
    [steps],
  );
  const [mode, setMode] = useState<EvidenceMode>("link");
  const [targetMode, setTargetMode] = useState<TargetMode>("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploadedTargets, setUploadedTargets] = useState<Set<number>>(new Set());

  const targets =
    targetMode === "all"
      ? ordered.map((step) => step.stepNo)
      : ordered.filter((step) => selected.has(step.stepNo)).map((step) => step.stepNo);

  const chooseMode = (next: EvidenceMode) => {
    setMode(next);
    setFile(null);
    setLink("");
    setError(null);
    setSuccess(null);
    setUploadedTargets(new Set());
  };

  const submit = () => {
    setError(null);
    setSuccess(null);
    if (targets.length === 0) {
      setError("Pilih minimal satu langkah perbaikan.");
      return;
    }
    if (mode === "link" && !link.trim()) {
      setError("Masukkan Link Evidence terlebih dahulu.");
      return;
    }
    if (mode !== "link" && !file) {
      setError("Pilih file evidence terlebih dahulu.");
      return;
    }

    startTransition(async () => {
      if (mode === "link") {
        const result = await runAction(() =>
          appendCaseEvidenceAction(iapId, targets, link),
        );
        if (!result.ok) {
          setError(Object.values(result.errors)[0] ?? "Gagal menyimpan evidence.");
          return;
        }
      } else {
        for (const stepNo of targets.filter((stepNo) => !uploadedTargets.has(stepNo))) {
          const body = new FormData();
          body.set("kind", mode);
          body.set("file", file!);
          const response = await fetch(
            `/api/evidence/${encodeURIComponent(iapId)}/${stepNo}`,
            { method: "POST", body },
          );
          const result = (await response.json()) as { error?: string };
          if (!response.ok) {
            setError(
              `Evidence langkah ${stepNo} gagal: ${result.error ?? "Upload gagal."}`,
            );
            onStored();
            return;
          }
          setUploadedTargets((current) => new Set(current).add(stepNo));
        }
      }

      setSuccess(
        `Evidence ditambahkan ke ${targets.length} langkah dan disimpan di bawah link sebelumnya.`,
      );
      setLink("");
      setFile(null);
      setUploadedTargets(new Set());
      onStored();
    });
  };

  return (
    <div data-testid="case-evidence-panel">
      <p className="mb-3 text-[11.5px] text-faint">
        Evidence baru ditambahkan pada baris berikutnya di kolom Q tanpa menghapus
        link yang sudah ada.
      </p>

      <fieldset className="mb-3">
        <legend className="label">Jenis Evidence</legend>
        <div className="flex flex-wrap gap-2">
          <Choice checked={mode === "link"} label="Link Evidence" name="case-evidence-kind" testId="case-evidence-mode-link" onChange={() => chooseMode("link")} />
          <Choice checked={mode === "photo"} label="Upload Foto" name="case-evidence-kind" testId="case-evidence-mode-photo" onChange={() => chooseMode("photo")} />
          <Choice checked={mode === "document"} label="Upload Dokumen" name="case-evidence-kind" testId="case-evidence-mode-document" onChange={() => chooseMode("document")} />
        </div>
      </fieldset>

      <fieldset className="mb-3">
        <legend className="label">Masukkan Evidence ke</legend>
        <div className="flex flex-wrap gap-2">
          <Choice checked={targetMode === "all"} label="Semua Langkah Perbaikan" name="case-evidence-target" testId="case-evidence-target-all" onChange={() => { setTargetMode("all"); setUploadedTargets(new Set()); }} />
          <Choice checked={targetMode === "selected"} label="Pilih Langkah Tertentu" name="case-evidence-target" testId="case-evidence-target-selected" onChange={() => { setTargetMode("selected"); setUploadedTargets(new Set()); }} />
        </div>
      </fieldset>

      {targetMode === "selected" ? (
        <fieldset className="mb-3 rounded-[7px] border border-line-soft p-3" data-testid="case-evidence-step-list">
          <legend className="px-1 text-[11.5px] font-semibold text-label">Pilih langkah</legend>
          <div className="space-y-2">
            {ordered.map((step) => (
              <label key={step.stepNo} className="flex cursor-pointer items-start gap-2 text-[11.5px] text-ink-mid">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-accent"
                  checked={selected.has(step.stepNo)}
                  data-testid={`case-evidence-step-${step.stepNo}`}
                  onChange={(event) => {
                    setSelected((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(step.stepNo);
                      else next.delete(step.stepNo);
                      return next;
                    });
                    setUploadedTargets(new Set());
                  }}
                />
                <span><b>Langkah {step.stepNo}:</b> {step.step}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {mode === "link" ? (
        <input
          type="url"
          className="field"
          placeholder="https://drive.google.com/…"
          value={link}
          data-testid="case-evidence-link"
          onChange={(event) => setLink(event.target.value)}
        />
      ) : (
        <input
          type="file"
          className="field file:mr-3 file:rounded file:border-0 file:bg-head file:px-2 file:py-1"
          accept={mode === "photo" ? "image/jpeg,image/png,image/webp,image/heic,image/heif" : ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
          data-testid="case-evidence-file"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      )}

      {error ? <p className="mt-2 text-[11.5px] text-late-ink" role="alert" data-testid="case-evidence-error">{error}</p> : null}
      {success ? <p className="mt-2 text-[11.5px] text-done" role="status" data-testid="case-evidence-success">{success}</p> : null}
      <button type="button" className="btn btn-primary mt-3" disabled={pending} onClick={submit} data-testid="case-evidence-upload">
        {pending ? "Menyimpan Evidence…" : "Tambahkan Evidence"}
      </button>
    </div>
  );
}

function Choice({ checked, label, name, testId, onChange }: { checked: boolean; label: string; name: string; testId: string; onChange: () => void }) {
  return (
    <label className={`flex cursor-pointer items-center gap-1.5 rounded-[6px] border px-2.5 py-1.5 text-[11.5px] font-semibold ${checked ? "border-accent bg-done-soft text-accent" : "border-line text-ink-mid"}`}>
      <input type="radio" name={name} checked={checked} onChange={onChange} data-testid={testId} className="accent-accent" />
      {label}
    </label>
  );
}
