"use client";

import { countsByStatus, dueOutlook, type DueBucket } from "@/domain/aggregate";
import {
  STATUSES,
  type CaseSummary,
  type DerivedActionItem,
  type Status,
  type Totals,
} from "@/domain/types";
import { LATE_COLOR, STATUS_COLOR, STATUS_LABEL } from "./status-styles";

interface ChartsProps {
  items: readonly DerivedActionItem[];
  byCase: readonly CaseSummary[];
  totals: Totals;
}

/**
 * Hand-rolled SVG rather than a charting library: three simple shapes, the same
 * oklch tokens as the cards, and no extra bytes on a page people open from a phone.
 */
export function Charts({ items, byCase, totals }: ChartsProps) {
  return (
    <section
      className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3"
      data-testid="charts"
    >
      <Panel title="Komposisi Status">
        <StatusDonut counts={countsByStatus(totals)} total={totals.total} />
      </Panel>
      <Panel title="Status per Kasus IAP">
        <CaseBars byCase={byCase} />
      </Panel>
      <Panel title="Jatuh Tempo Item Terbuka">
        <DueChart buckets={dueOutlook(items)} />
      </Panel>
    </section>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card px-5 py-4">
      <h3 className="mb-3 text-[13px] font-semibold text-ink-strong">
        {title}
      </h3>
      {children}
    </div>
  );
}

function StatusDonut({
  counts,
  total,
}: {
  counts: Record<Status, number>;
  total: number;
}) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 140 140" className="h-[132px] w-[132px] shrink-0">
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="oklch(93% 0.004 250)"
          strokeWidth="18"
        />
        {STATUSES.map((status) => {
          const value = counts[status];
          const length = total ? (value / total) * circumference : 0;
          const dash = (
            <circle
              key={status}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={STATUS_COLOR[status]}
              strokeWidth="18"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
            >
              <title>{`${STATUS_LABEL[status]}: ${value}`}</title>
            </circle>
          );
          offset += length;
          return dash;
        })}
        <text
          x="70"
          y="66"
          textAnchor="middle"
          className="fill-[oklch(20%_0.01_250)] text-[22px] font-bold"
        >
          {total}
        </text>
        <text
          x="70"
          y="84"
          textAnchor="middle"
          className="fill-[oklch(55%_0.01_250)] text-[10px]"
        >
          item aksi
        </text>
      </svg>

      <ul className="space-y-2 text-[12px]">
        {STATUSES.map((status) => (
          <li key={status} className="flex items-center gap-2">
            <span
              className="inline-block h-[10px] w-[10px] rounded-[3px]"
              style={{ background: STATUS_COLOR[status] }}
            />
            <span className="text-muted">{STATUS_LABEL[status]}</span>
            <span className="font-semibold text-ink">{counts[status]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Each bar fills the full track so the status *mix* is comparable across cases of
 * different sizes; the raw total sits at the right for the absolute figure.
 */
function CaseBars({ byCase }: { byCase: readonly CaseSummary[] }) {
  return (
    <>
      <ul className="space-y-2">
        {byCase.map((summary) => (
          <li key={summary.iapId} className="flex items-center gap-3">
            <span className="w-[104px] shrink-0 truncate font-mono text-[11px] text-ink-mid">
              {summary.iapId}
            </span>
            <span
              className="flex h-[16px] flex-1 overflow-hidden rounded-[4px] bg-idle-soft"
              title={`${summary.iapId}: ${summary.closed} completed, ${summary.inProgress} ongoing, ${summary.open} not started`}
            >
              {STATUSES.map((status) => {
                const value = countsByStatus(summary)[status];
                if (value === 0) return null;
                return (
                  <span
                    key={status}
                    className="flex items-center justify-center overflow-hidden text-[10px] font-semibold text-white"
                    style={{
                      background: STATUS_COLOR[status],
                      width: `${(value / summary.total) * 100}%`,
                    }}
                  >
                    {value}
                  </span>
                );
              })}
            </span>
            <span className="w-[26px] shrink-0 text-right text-[11.5px] text-faint">
              {summary.total}
            </span>
          </li>
        ))}
      </ul>
      <Legend
        items={STATUSES.map((status) => ({
          label: STATUS_LABEL[status],
          color: STATUS_COLOR[status],
        }))}
      />
    </>
  );
}

function Legend({
  items,
}: {
  items: readonly { label: string; color: string }[];
}) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-line-soft pt-2.5 text-[11px] text-muted">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            className="inline-block h-[9px] w-[9px] rounded-[2px]"
            style={{ background: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function DueChart({ buckets }: { buckets: readonly DueBucket[] }) {
  const tallest = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <>
      <ul className="space-y-2">
        {buckets.map((bucket) => (
          <li
            key={bucket.label}
            className="flex items-center gap-3 text-[12px]"
          >
            <span className="w-[88px] shrink-0 text-muted">{bucket.label}</span>
            <span className="flex h-[16px] flex-1 items-center">
              <span
                className="flex h-full items-center justify-end rounded-[4px] pr-1.5 text-[10px] font-semibold text-white"
                style={{
                  // ponytail: min-width so the label still fits inside a tiny bar
                  minWidth: bucket.count ? "24px" : 0,
                  width: `${(bucket.count / tallest) * 100}%`,
                  background: bucket.late ? LATE_COLOR : "oklch(45% 0.1 160)",
                }}
              >
                {bucket.count || null}
              </span>
              {bucket.count ? null : (
                <span className="text-[11px] text-faint">0</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <Legend
        items={[
          { label: "Overdue", color: LATE_COLOR },
          { label: "Not Yet Due", color: "oklch(45% 0.1 160)" },
        ]}
      />
    </>
  );
}
