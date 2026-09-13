"use server";

import { applicationOrigin } from "@/lib/security";
import { redirect } from "next/navigation";
import { isBranchCode } from "@/domain/branches";
import { supabaseServer } from "@/lib/supabase/server";

export interface AuthState {
  error?: string;
  notice?: string;
}

const text = (form: FormData, name: string): string =>
  String(form.get(name) ?? "").trim();

export async function signInAction(
  _prev: AuthState,
  form: FormData,
): Promise<AuthState> {
  const email = text(form, "email");
  const password = String(form.get("password") ?? "");
  if (email.length > 254 || password.length > 128) return { error: "Email atau kata sandi tidak valid." };
  if (!email || !password) return { error: "Email dan kata sandi wajib diisi." };

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      error:
        error.message === "Invalid login credentials"
          ? "Email atau kata sandi salah."
          : error.message === "Email not confirmed"
            ? "Email belum dikonfirmasi. Buka tautan konfirmasi yang dikirim ke email Anda."
            : "Tidak dapat masuk saat ini. Silakan coba lagi.",
    };
  }

  // The account exists, but it is the admin's approval that decides whether it may
  // be used. Signing a pending or deactivated user straight back out keeps them from
  // holding a usable session.
  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", data.user.id)
    .single();

  if (profile?.status !== "active") {
    await supabase.auth.signOut();
    return {
      error:
        profile?.status === "inactive"
          ? "Akun Anda dinonaktifkan. Hubungi admin."
          : "Akun Anda belum disetujui admin. Silakan tunggu persetujuan.",
    };
  }

  redirect("/");
}

export async function signUpAction(
  _prev: AuthState,
  form: FormData,
): Promise<AuthState> {
  const email = text(form, "email");
  const fullName = text(form, "fullName");
  const branchCode = text(form, "branchCode");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirmPassword") ?? "");

  if (fullName.length > 200 || email.length > 254 || password.length > 128) return { error: "Data pendaftaran terlalu panjang." };
  if (!fullName) return { error: "Nama lengkap wajib diisi." };
  if (!email || email.length > 254) return { error: "Email wajib diisi dan maksimal 254 karakter." };
  // Validated here as well as in the dropdown, because a form post can carry
  // anything at all — this is the boundary the branch restriction rests on.
  if (!isBranchCode(branchCode)) return { error: "Pilih cabang yang valid." };
  if (password.length > 128) return { error: "Kata sandi maksimal 128 karakter." };
  if (password.length < 8) return { error: "Kata sandi minimal 8 karakter." };
  if (password !== confirm) return { error: "Konfirmasi kata sandi tidak cocok." };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${applicationOrigin()}/auth/callback`,
      // Role and status are ignored by the database trigger on purpose; a new
      // account is always created pending and non-admin.
      data: { full_name: fullName, branch_code: branchCode },
    },
  });
  if (error) return { error: "Permintaan tidak dapat diproses. Silakan coba lagi atau hubungi admin." };

  return {
    notice:
      "Pendaftaran diterima. Konfirmasi email Anda bila diminta, lalu tunggu persetujuan admin sebelum dapat masuk.",
  };
}

export async function forgotPasswordAction(
  _prev: AuthState,
  form: FormData,
): Promise<AuthState> {
  const email = text(form, "email");
  if (!email || email.length > 254) return { error: "Email wajib diisi dan maksimal 254 karakter." };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${applicationOrigin()}/auth/callback?next=/reset-password`,
  });
  if (error) console.error("Password recovery request failed");

  // Deliberately the same answer whether or not the address is registered, so this
  // form cannot be used to find out who has an account.
  return {
    notice:
      "Jika email tersebut terdaftar, tautan untuk mengatur ulang kata sandi telah dikirim.",
  };
}

export async function updatePasswordAction(
  _prev: AuthState,
  form: FormData,
): Promise<AuthState> {
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirmPassword") ?? "");
  if (password.length > 128) return { error: "Kata sandi maksimal 128 karakter." };
  if (password.length < 8) return { error: "Kata sandi minimal 8 karakter." };
  if (password !== confirm) return { error: "Konfirmasi kata sandi tidak cocok." };

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Tautan sudah tidak berlaku. Minta tautan baru dari halaman lupa kata sandi." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Permintaan tidak dapat diproses. Silakan coba lagi atau hubungi admin." };

  await supabase.auth.signOut();
  redirect("/login?notice=password-updated");
}

export async function signOutAction(): Promise<void> {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
