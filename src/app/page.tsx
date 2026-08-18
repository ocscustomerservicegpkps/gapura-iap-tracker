import { Dashboard } from "@/components/Dashboard";
import { readContexts } from "@/data/case-context";
import { readItems } from "@/data/tracker-repository";
import { todayInJakarta } from "@/domain/dates";
import { deriveItems } from "@/domain/overdue";

/**
 * Rendered per request so "today" is always current and so the Sheets reads
 * underneath run again each time. That keeps the dashboard honest about a
 * spreadsheet someone edited by hand, at the cost of one read per page view.
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  const today = todayInJakarta();
  const [rows, caseContext] = await Promise.all([readItems(), readContexts()]);

  return (
    <Dashboard
      items={deriveItems(rows, today)}
      today={today}
      caseContext={caseContext}
    />
  );
}
