import { branchesOf, canSeeStation, PUSAT } from "./branches";

interface AccessProfile { branchCode: string; role: string; status: string }

export function hasGlobalAccess(profile: AccessProfile): boolean {
  return profile.status === "active" && (profile.role === "admin" || profile.branchCode === PUSAT);
}

/** Whole-case operations require access to every row they will read or modify. */
export function coversCase(profile: AccessProfile, stations: readonly string[]): boolean {
  if (profile.status !== "active" || stations.length === 0) return false;
  return hasGlobalAccess(profile) || stations.every(station => canSeeStation(profile.branchCode, station));
}

/** Branch users cannot create or restation rows into another branch's scope. */
export function canAssignStation(profile: AccessProfile, station: string): boolean {
  if (profile.status !== "active") return false;
  if (hasGlobalAccess(profile)) return true;
  const branches = branchesOf(station);
  return branches.length === 1 && branches[0] === profile.branchCode;
}
