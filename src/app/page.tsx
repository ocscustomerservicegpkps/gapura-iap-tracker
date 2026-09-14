import { AppHeader } from "@/components/AppHeader";
import { Dashboard } from "@/components/Dashboard";
import { readContexts } from "@/data/case-context";
import { readItems } from "@/data/tracker-repository";
import { canSeeStation } from "@/domain/branches";
import { hasGlobalAccess } from "@/domain/access";
import { todayInJakarta } from "@/domain/dates";
import { deriveItems } from "@/domain/overdue";
import { requireActiveProfile } from "@/lib/auth";

/**
 * Rendered per request so the Jakarta date and database snapshot stay current.
 * Item and context repositories share one Supabase snapshot per render.
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  const profile = await requireActiveProfile();
  const today = todayInJakarta();
  const [rows, caseContext] = await Promise.all([readItems(), readContexts()]);

  /**
   * Branch users see only their own station's rows, and the filtering happens here
   * on the server — the rows of other branches are never sent to the browser at all,
   * so no client-side filter can be undone to reveal them.
   */
  const visibleRows =
    hasGlobalAccess(profile)
      ? rows
      : rows.filter((row) => canSeeStation(profile.branchCode, row.station));

  // Case context is keyed by IAP id, so it is narrowed to the cases that survived.
  const visibleCaseIds = new Set(visibleRows.map((row) => row.iapId));
  const visibleContext = Object.fromEntries(
    Object.entries(caseContext).filter(([iapId]) => visibleCaseIds.has(iapId)),
  );

  return (
    <>
      <AppHeader profile={profile} />
      <Dashboard
        items={deriveItems(visibleRows, today)}
        today={today}
        caseContext={visibleContext}
      />
    </>
  );
}
