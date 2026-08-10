import { Dashboard } from "@/components/Dashboard";
import { CASE_CONTEXT } from "@/data/case-context";
import { readItems } from "@/data/tracker-repository";
import { todayInJakarta } from "@/domain/dates";
import { deriveItems } from "@/domain/overdue";

/**
 * Rendered per request so "today" is always current; the Sheets read underneath is
 * what carries the 60-second cache, keeping API usage flat no matter the traffic.
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  const today = todayInJakarta();
  const items = deriveItems(await readItems(), today);

  return <Dashboard items={items} today={today} caseContext={CASE_CONTEXT} />;
}
