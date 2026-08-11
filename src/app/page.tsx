import { Dashboard } from "@/components/Dashboard";
import { readContexts } from "@/data/case-context";
import { readItems } from "@/data/tracker-repository";
import { todayInJakarta } from "@/domain/dates";
import { deriveItems } from "@/domain/overdue";

/**
 * Rendered per request so "today" is always current; the Sheets reads underneath are
 * what carry the 60-second cache, keeping API usage flat no matter the traffic.
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
