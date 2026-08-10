"use client";

import { Modal } from "./Modal";

interface ConfirmDialogProps {
  title: string;
  /** States exactly what will be removed, so the blast radius is clear up front. */
  message: string;
  detail?: string;
  confirmLabel: string;
  busy: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  detail,
  confirmLabel,
  busy,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      width="narrow"
      testId="confirm-dialog"
      footer={
        <>
          <button
            type="button"
            className="btn"
            onClick={onCancel}
            disabled={busy}
            data-testid="confirm-cancel"
          >
            Batal
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={busy}
            data-testid="confirm-delete"
          >
            {busy ? "Menghapus…" : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-ink" data-testid="confirm-message">
        {message}
      </p>
      {detail ? (
        <p className="mt-3 rounded-[7px] bg-late-soft px-3 py-2 text-[12px] leading-relaxed text-late-ink">
          {detail}
        </p>
      ) : null}
      <p className="mt-3 text-[11.5px] text-faint">
        Tindakan ini tidak dapat dibatalkan dari aplikasi. Pemulihan hanya melalui
        riwayat versi Google Sheets.
      </p>
      {error ? (
        <p
          className="mt-3 rounded-[7px] bg-late-soft px-3 py-2 text-[12px] text-late-ink"
          role="alert"
          data-testid="confirm-error"
        >
          {error}
        </p>
      ) : null}
    </Modal>
  );
}
