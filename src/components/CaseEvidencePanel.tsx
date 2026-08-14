"use client";

import { useMemo, useState, useTransition } from "react";
import type { DerivedActionItem } from "@/domain/types";

type EvidenceMode = "link" | "photo" | "document";
type TargetMode = "all" | "selected";

export interface PendingCaseEvidenceLink {
  stepNos: number[];
  link: string;
}

export function CaseEvidencePanel({
  iapId,
  steps,
  onStored,
  onLinkDraftChange,
  onBusyChange,
}: {
  iapId: string;
  steps: readonly DerivedActionItem[];
  onStored: () => void;
  onLinkDraftChange: (draft: PendingCaseEvidenceLink | null) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const ordered = useMemo(
    () => [...steps].sort((a, b) => a.stepNo - b.stepNo),
    [steps],
  );
  const [mode, setMode] = useState<EvidenceMode>("document");
  const [targetMode, setTargetMode] = useState<TargetMode>("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [fileInputVersion, setFileInputVersion] = useState(0);

  const targets =
    targetMode === "all"
      ? ordered.map((step) => step.stepNo)
      : ordered.filter((step) => selected.has(step.stepNo)).map((step) => step.stepNo);

  const chooseMode = (next: EvidenceMode) => {
    setMode(next);
    setLink("");
    onLinkDraftChange(null);
    setError(null);
    setSuccess(null);
    setFileInputVersion((current) => current + 1);
  };

  const chooseTargetMode = (next: TargetMode) => {
    setTargetMode(next);
    if (mode === "link" && link.trim()) {
      const nextTargets =
        next === "all"
          ? ordered.map((step) => step.stepNo)
          : ordered.filter((step) => selected.has(step.stepNo)).map((step) => step.stepNo);
      onLinkDraftChange({ stepNos: nextTargets, link });
    }
  };

  const uploadFile = (fileToUpload: File) => {
    setError(null);
    setSuccess(null);
    if (targets.length === 0) {
      setError("Pilih minimal satu langkah perbaikan.");
      return;
    }

    startTransition(async () => {
      onBusyChange(true);
      try {
        const body = new FormData();
        body.set("kind", mode);
        body.set("file", fileToUpload);
        body.set("stepNos", JSON.stringify(targets));
        const response = await fetch(
          `/api/evidence/${encodeURIComponent(iapId)}/${targets[0]}`,
          { method: "POST", body },
        );
        const result = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(result.error ?? "Upload evidence gagal.");
        }

        setSuccess(
          `Evidence ditambahkan ke ${targets.length} langkah dan disimpan di bawah link sebelumnya.`,
        );
        onStored();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setFileInputVersion((current) => current + 1);
        onBusyChange(false);
      }
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
        <div className="flex flex-wrap gap-2" data-testid="case-evidence-modes">
          <Choice checked={mode === "document"} label="Upload Dokumen" name="case-evidence-kind" testId="case-evidence-mode-document" onChange={() => chooseMode("document")} />
          <Choice checked={mode === "photo"} label="Upload Foto" name="case-evidence-kind" testId="case-evidence-mode-photo" onChange={() => chooseMode("photo")} />
          <Choice checked={mode === "link"} label="Link Evidence" name="case-evidence-kind" testId="case-evidence-mode-link" onChange={() => chooseMode("link")} />
        </div>
      </fieldset>

      <fieldset className="mb-3">
        <legend className="label">Masukkan Evidence ke</legend>
        <div className="flex flex-wrap gap-2">
          <Choice checked={targetMode === "all"} label="Semua Langkah Perbaikan" name="case-evidence-target" testId="case-evidence-target-all" onChange={() => chooseTargetMode("all")} />
          <Choice checked={targetMode === "selected"} label="Pilih Langkah Tertentu" name="case-evidence-target" testId="case-evidence-target-selected" onChange={() => chooseTargetMode("selected")} />
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
                      if (mode === "link" && link.trim()) {
                        const nextTargets = ordered
                          .filter((candidate) => next.has(candidate.stepNo))
                          .map((candidate) => candidate.stepNo);
                        onLinkDraftChange({ stepNos: nextTargets, link });
                      }
                      return next;
                    });
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
          key="case-evidence-link"
          type="url"
          className="field"
          placeholder="https://drive.google.com/…"
          value={link}
          data-testid="case-evidence-link"
          onChange={(event) => {
            const nextLink = event.target.value;
            setLink(nextLink);
            onLinkDraftChange(
              nextLink.trim() ? { stepNos: targets, link: nextLink } : null,
            );
          }}
        />
      ) : (
        <input
          key={`case-evidence-file-${mode}-${fileInputVersion}`}
          type="file"
          className="field file:mr-3 file:rounded file:border-0 file:bg-head file:px-2 file:py-1"
          accept={mode === "photo" ? "image/jpeg,image/png,image/webp,image/heic,image/heif" : ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
          data-testid="case-evidence-file"
          disabled={pending}
          onChange={(event) => {
            const selectedFile = event.target.files?.[0] ?? null;
            if (selectedFile) uploadFile(selectedFile);
          }}
        />
      )}

      {error ? <p className="mt-2 text-[11.5px] text-late-ink" role="alert" data-testid="case-evidence-error">{error}</p> : null}
      {success ? <p className="mt-2 text-[11.5px] text-done" role="status" data-testid="case-evidence-success">{success}</p> : null}
      <p className="mt-2 text-[11px] text-faint">
        {mode === "link"
          ? "Link akan ditambahkan ke kolom Q saat Anda klik Simpan."
          : "File langsung diunggah setelah dipilih. Satu file Drive dipakai untuk semua langkah tujuan."}
      </p>
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
