"use client";

import { useEffect, useRef } from "react";

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  testId?: string;
  /** Narrow dialogs (confirmations) read better than full-width ones. */
  width?: "narrow" | "wide";
}

/**
 * Full-screen on phones, centred sheet on larger screens. Escape and the backdrop
 * both close it; focus moves inside on open so keyboard users are not stranded.
 */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  testId,
  width = "wide",
}: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/35 p-0 sm:items-start sm:overflow-y-auto sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
        className={`flex max-h-full w-full flex-col overflow-hidden bg-surface outline-none sm:my-auto sm:rounded-[10px] sm:border sm:border-line ${
          width === "narrow" ? "sm:max-w-[460px]" : "sm:max-w-[720px]"
        }`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[15px] font-bold text-ink-strong">{title}</h2>
            {subtitle ? (
              <p className="mt-1 text-[12px] text-faint">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            data-testid="modal-close"
            className="-mr-1 -mt-1 cursor-pointer rounded px-2 py-1 text-[18px] leading-none text-faint hover:bg-head"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
