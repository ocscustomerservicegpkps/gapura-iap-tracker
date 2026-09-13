import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { isOfflineAuth } from "@/lib/offline";
import { supabaseServer } from "@/lib/supabase/server";
import { PUSAT, isBranchCode } from "@/domain/branches";

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  branchCode: string;
  role: "admin" | "user";
  status: "pending" | "active" | "inactive";
}

/** Stands in for a signed-in head-office admin when there is no real project behind the app. */
const OFFLINE_PROFILE: Profile = {
  id: "offline",
  email: "offline@local",
  fullName: "Mode Offline",
  branchCode: PUSAT,
  role: "admin",
  status: "active",
};

/**
 * The signed-in user's profile, or null when nobody is signed in.
 *
 * Memoised per render so a page and its layout do not each pay for the lookup.
 * `getUser` is used rather than `getSession` because it verifies the token with
 * Supabase instead of trusting a cookie the browser supplied.
 */
export const currentProfile = cache(async (): Promise<Profile | null> => {
  if (isOfflineAuth()) return OFFLINE_PROFILE;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, branch_code, role, status")
    .eq("id", user.id)
    .single();
  if (!data || !isBranchCode(data.branch_code) ||
      !["admin", "user"].includes(data.role) ||
      !["pending", "active", "inactive"].includes(data.status)) return null;

  return {
    id: data.id,
    email: data.email,
    fullName: data.full_name,
    branchCode: data.branch_code,
    role: data.role,
    status: data.status,
  };
});

/**
 * Gate for every page that shows tracker data. An account that exists but has not
 * been approved — or has been deactivated — is bounced to the login screen with a
 * reason rather than shown an empty dashboard.
 */
export async function requireActiveProfile(): Promise<Profile> {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (profile.status === "pending") redirect("/login?notice=pending");
  if (profile.status === "inactive") redirect("/login?notice=inactive");
  if (profile.status !== "active") redirect("/login");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireActiveProfile();
  if (profile.role !== "admin") redirect("/");
  return profile;
}
