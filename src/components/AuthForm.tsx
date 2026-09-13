"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthState } from "@/app/auth/actions";
import { Logo } from "./Logo";

interface AuthFormProps {
  title: string;
  intro: string;
  action: (prev: AuthState, form: FormData) => Promise<AuthState>;
  submitLabel: string;
  pendingLabel: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Shown above the form on first paint, e.g. after a redirect carrying `?notice=`. */
  initialNotice?: string;
}

/**
 * The one form shell behind login, registration, and both halves of password
 * recovery. Each page supplies its own fields and its own server action; everything
 * else — the card, the busy state, where errors appear — is the same everywhere.
 */
export function AuthForm({
  title,
  intro,
  action,
  submitLabel,
  pendingLabel,
  children,
  footer,
  initialNotice,
}: AuthFormProps) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    {},
  );
  const notice = state.notice ?? (state.error ? undefined : initialNotice);

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-canvas px-4 py-10">
      {/* A single soft wash in the brand green, so the card sits on something with
          depth rather than on flat grey. Decorative only, and cheap: one gradient,
          no image, nothing to load. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[380px] bg-[radial-gradient(ellipse_70%_100%_at_50%_0%,oklch(95%_0.035_160)_0%,transparent_72%)]"
      />

      <div className="relative w-full max-w-[420px]">
        <div className="mb-7 flex flex-col items-center">
          <Logo height={58} priority />
          <h1 className="mt-4 text-[13px] font-semibold tracking-[0.14em] text-muted uppercase">
            Dasbor Monitoring IAP
          </h1>
        </div>

        <div className="card px-6 py-7 shadow-[0_1px_2px_oklch(0%_0_0_/_0.04),0_12px_32px_-12px_oklch(0%_0_0_/_0.12)]">
          <h2 className="text-[17px] font-bold text-ink-strong">{title}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">{intro}</p>

          {state.error ? (
            <p
              role="alert"
              data-testid="auth-error"
              className="mt-5 rounded-[7px] border border-late/25 bg-late-soft px-3 py-2.5 text-[13px] leading-snug text-late-ink"
            >
              {state.error}
            </p>
          ) : null}

          {notice ? (
            <p
              role="status"
              data-testid="auth-notice"
              className="mt-5 rounded-[7px] border border-accent/25 bg-plan-soft px-3 py-2.5 text-[13px] leading-snug text-plan-ink"
            >
              {notice}
            </p>
          ) : null}

          <form action={formAction} className="mt-6 space-y-4">
            {children}
            <button
              type="submit"
              disabled={pending}
              className="btn btn-primary mt-1 w-full justify-center py-2.5"
            >
              {pending ? pendingLabel : submitLabel}
            </button>
          </form>
        </div>

        {footer ? (
          <div className="mt-6 space-y-1.5 text-center text-[13px] text-muted">
            {footer}
          </div>
        ) : null}
      </div>
    </main>
  );
}

/** A labelled input, so the four auth pages do not each re-spell the same markup. */
export function AuthField({
  name,
  label,
  type = "text",
  autoComplete,
  required = true,
}: {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        className="field w-full"
      />
    </div>
  );
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium text-accent underline underline-offset-2">
      {children}
    </Link>
  );
}
