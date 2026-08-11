"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  testId?: string;
  /** Narrow dialogs (confirmations) read better than full-width ones. */
  width?: "narrow" | "wide";
  /**
   * Unsaved work is in the form. Escape and the backdrop then ask before
   * discarding it; the explicit Batal button in the footer still closes at once,
   * because pressing it is already the answer.
   */
  dirty?: boolean;
}

/** Everything tabbable inside the panel, in document order. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/**
 * Full-screen on phones, centred sheet on larger screens. Escape and the backdrop
 * both close it; focus moves inside on open, cycles within the panel while it is
 * there, and returns to whatever opened it on close.
 */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  testId,
  width = "wide",
  dirty = false,
}: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);

  /**
   * Read during the first render, not in the effect: by the time effects run the
   * page behind has already been marked inert, which blurs the button that opened
   * this and leaves `document.activeElement` on the body.
   */
  const opener = useRef<HTMLElement | null>(null);
  if (opener.current === null) {
    opener.current =
      typeof document === "undefined"
        ? null
        : (document.activeElement as HTMLElement | null);
  }

  // Read through a ref inside the key handler so toggling dirty does not tear the
  // listener down and rebuild it on every keystroke.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  /** Closing by Escape or backdrop: cheap when there is nothing to lose. */
  const requestClose = useCallback(() => {
    if (dirtyRef.current) setConfirmingClose(true);
    else onClose();
  }, [onClose]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== "Tab") return;

      // Focus trap: the panel is the whole tab cycle for as long as it is open.
      const nodes = [...(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter(
        (node) => node.offsetParent !== null || node === panel.current,
      );
      if (nodes.length === 0) {
        event.preventDefault();
        panel.current?.focus();
        return;
      }
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      const active = document.activeElement;

      if (!panel.current?.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
      // Back to the button that opened this, so the keyboard picks up where it
      // left. Deferred a frame: the page behind is still inert this tick.
      const target = opener.current;
      if (target?.isConnected) {
        requestAnimationFrame(() => {
          if (target.isConnected) target.focus();
        });
      }
    };
  }, [requestClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/35 p-0 sm:items-start sm:overflow-y-auto sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
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
            onClick={requestClose}
            aria-label="Tutup"
            data-testid="modal-close"
            className="-mr-1 -mt-1 flex h-[28px] w-[28px] cursor-pointer items-center justify-center rounded text-[18px] leading-none text-faint hover:bg-head"
          >
            ×
          </button>
        </div>

        {confirmingClose ? (
          <DiscardBar
            onKeepEditing={() => setConfirmingClose(false)}
            onDiscard={onClose}
          />
        ) : null}

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

/**
 * Sits between the title and the form rather than stacking a second dialog on the
 * first: the work it is protecting stays visible behind the question.
 */
function DiscardBar({
  onKeepEditing,
  onDiscard,
}: {
  onKeepEditing: () => void;
  onDiscard: () => void;
}) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);

  return (
    <div
      role="alertdialog"
      aria-label="Buang perubahan?"
      data-testid="modal-discard"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-late-soft px-5 py-3"
    >
      <p className="text-[12px] text-late-ink">
        Ada isian yang belum disimpan. Tutup formulir dan buang isian itu?
      </p>
      <div className="flex gap-2">
        <button
          ref={first}
          type="button"
          className="btn"
          onClick={onKeepEditing}
          data-testid="modal-keep-editing"
        >
          Lanjut mengisi
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={onDiscard}
          data-testid="modal-discard-confirm"
        >
          Buang isian
        </button>
      </div>
    </div>
  );
}
