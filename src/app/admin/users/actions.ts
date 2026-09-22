"use server";

import { revalidatePath } from "next/cache";
import type { MutationResult } from "@/data/tracker-repository";
import { isBranchCode } from "@/domain/branches";
import { requireAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export interface UserInput {
  fullName: string;
  branchCode: string;
  role: string;
  status: string;
}

const ROLES = ["admin", "user"] as const;
const STATUSES = ["pending", "active", "inactive"] as const;

const failure = (field: string, message: string): MutationResult => ({
  ok: false,
  errors: { [field]: message },
});

/**
 * Save one user's account settings.
 *
 * `requireAdmin` runs first on every action here, and row level security refuses
 * the write a second time if it somehow got past — a server action is a public
 * endpoint, so neither check is redundant.
 */
export async function saveUserAction(
  id: string,
  input: UserInput,
): Promise<MutationResult> {
  const admin = await requireAdmin();
  const fullName = input.fullName.trim();
  const branchCode = input.branchCode.trim();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return failure("form", "Pengguna tidak ditemukan.");
  if (!fullName || fullName.length > 200) return failure("fullName", "Nama wajib diisi dan maksimal 200 karakter.");
  if (!isBranchCode(branchCode)) return failure("branchCode", "Cabang tidak valid.");
  if (!ROLES.includes(input.role as (typeof ROLES)[number])) {
    return failure("role", "Peran tidak valid.");
  }
  if (!STATUSES.includes(input.status as (typeof STATUSES)[number])) {
    return failure("status", "Status tidak valid.");
  }
  // Losing the last admin would leave nobody able to approve anyone, and the person
  // doing it would lock themselves out mid-click.
  if (id === admin.id && (input.role !== "admin" || input.status !== "active")) {
    return failure("role", "Anda tidak dapat mencabut akses admin Anda sendiri.");
  }

  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      branch_code: branchCode,
      role: input.role,
      status: input.status,
    })
    .eq("id", id);
  if (error) return failure("form", "Gagal memperbarui pengguna. Silakan coba lagi atau hubungi admin.");

  revalidatePath("/admin/users");
  return { ok: true };
}

/** Approve a pending registration. The one-click path for the common case. */
export async function approveUserAction(id: string): Promise<MutationResult> {
  await requireAdmin();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return failure("form", "Pengguna tidak ditemukan.");

  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("profiles")
    .update({ status: "active" })
    .eq("id", id);
  if (error) return failure("form", "Gagal memperbarui pengguna. Silakan coba lagi atau hubungi admin.");

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function deleteUserAction(id: string): Promise<MutationResult> {
  const admin = await requireAdmin();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return failure("form", "Pengguna tidak ditemukan.");
  if (id === admin.id) return failure("form", "Anda tidak dapat menghapus akun sendiri.");

  // A trigger on `profiles` deletes the login too, so the address can register again
  // later. Row level security re-checks that the caller is an admin deleting someone
  // else; a refused delete matches no row rather than raising, hence the count.
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("profiles").delete().eq("id", id).select("id");
  if (error || data?.length !== 1) return failure("form", "Gagal memperbarui pengguna. Silakan coba lagi atau hubungi admin.");

  revalidatePath("/admin/users");
  return { ok: true };
}
