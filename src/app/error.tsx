"use client";

import { useEffect } from "react";

/**
 * Database failures show a retry without exposing server details.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard render failed:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-[560px] flex-col justify-center px-4 py-16">
      <div className="card px-6 py-7">
        <h1 className="text-[20px] font-bold text-ink-strong">
          Data tracker tidak dapat dimuat
        </h1>
        <p className="mt-2.5 text-[13px] leading-relaxed text-ink-mid">
          Dasbor gagal memuat data tracker. Silakan coba muat ulang.
        </p>

        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-[12.5px] leading-relaxed text-muted">
          <li>Koneksi database sedang terputus atau lambat.</li>
          <li>
            Konfigurasi akses database belum lengkap atau tidak valid.
          </li>
          <li>Schema database belum dimigrasikan.</li>
        </ul>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary"
            onClick={reset}
            data-testid="error-retry"
          >
            Coba muat ulang
          </button>
        </div>

        {error.digest ? (
          <p className="mt-5 border-t border-line-soft pt-3 text-[11px] text-faint">
            Kode kejadian untuk administrator:{" "}
            <span className="font-mono text-ink-mid">{error.digest}</span>
          </p>
        ) : null}
      </div>
    </main>
  );
}
