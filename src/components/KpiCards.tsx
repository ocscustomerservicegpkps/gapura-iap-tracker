"use client";

import type { Totals } from "@/domain/types";

const CARDS = [
  { key: "total", label: "Total Item Aksi", tone: "text-[oklch(20%_0.01_250)]" },
  { key: "closed", label: "Completed", tone: "text-done" },
  { key: "inProgress", label: "Ongoing", tone: "text-running" },
  { key: "open", label: "Not Started", tone: "text-idle" },
  { key: "overdue", label: "Overdue", tone: "text-late" },
] as const;

/** Two-up on phones, five-up on desktop — the numbers never shrink to unreadable. */
export function KpiCards({ totals }: { totals: Totals }) {
  return (
    <section
      className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-[14px]"
      data-testid="kpi-cards"
    >
      {CARDS.map((card) => (
        <div key={card.key} className="card px-5 py-4">
          <div className="text-[12px] font-medium text-label">{card.label}</div>
          <div
            className={`mt-1.5 text-[30px] font-bold ${card.tone}`}
            data-testid={`kpi-${card.key}`}
          >
            {totals[card.key]}
          </div>
        </div>
      ))}
    </section>
  );
}
