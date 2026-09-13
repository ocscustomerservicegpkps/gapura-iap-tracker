"use client";

import { useId, useState } from "react";

/**
 * A password box that can be read back.
 *
 * Typing a password you cannot see is the single most common cause of a failed
 * sign-in, and it is worse here than usual: the branch accounts are shared and the
 * passwords get retyped often. The toggle flips the input's `type`, so the browser's
 * own password manager still recognises the field while it is hidden.
 */
export function PasswordField({
  name,
  label,
  autoComplete,
  required = true,
}: {
  name: string;
  label: string;
  autoComplete?: string;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const hintId = useId();

  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <div className="relative">
        <input
          id={name}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          aria-describedby={hintId}
          className="field w-full pr-[52px]"
        />
        <button
          type="button"
          onClick={() => setVisible((shown) => !shown)}
          // Announced rather than shown, so the control stays a single icon-free
          // word and the label still says what pressing it will do.
          aria-pressed={visible}
          aria-controls={name}
          id={hintId}
          data-testid={`toggle-${name}`}
          className="absolute inset-y-0 right-0 flex items-center rounded-r-[7px] px-3 text-[11.5px] font-semibold text-muted hover:text-ink"
        >
          {visible ? "Sembunyikan" : "Lihat"}
        </button>
      </div>
    </div>
  );
}
