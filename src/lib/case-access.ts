import "server-only";

import { readItems } from "@/data/tracker-repository";
import type { ActionItem } from "@/domain/types";
import { coversCase, canAssignStation, hasGlobalAccess } from "@/domain/access";
import { currentProfile } from "@/lib/auth";

/**
 * Whether the signed-in user may read or change this case.
 *
 * The page already hides other branches' rows, but a server action and a route
 * handler are public endpoints that take an IAP id straight from the caller — so
 * the same question has to be asked again here, on the server, before anything is
 * read out or written back.
 *
 * Kept out of `lib/auth.ts` so the login screen does not pull the Sheets client in
 * with it. `loadItems` must return every tracker row, unfiltered; a route that needs
 * the rows afterwards passes a memoised loader so the sheet is read at most once, and
 * still only after the profile check has passed.
 */
export async function canAccessCase(
  iapId: string,
  loadItems: () => Promise<readonly ActionItem[]> = readItems,
): Promise<boolean> {
  const profile = await currentProfile();
  if (!profile || profile.status !== "active") return false;
  if (hasGlobalAccess(profile)) return true;

  const caseRows = (await loadItems()).filter((item) => item.iapId === iapId);
  // An unknown case is refused rather than allowed: answering "not found" only for
  // ids that exist elsewhere would leak which cases other branches are running.
  if (caseRows.length === 0) return false;

  return coversCase(profile, caseRows.map(item => item.station));
}

/** Whether the user may file a brand-new case against this station. */
export async function canAccessStation(station: string): Promise<boolean> {
  const profile = await currentProfile();
  if (!profile || profile.status !== "active") return false;
  return canAssignStation(profile, station);
}
