import { redirect } from "next/navigation";
import { signInAction } from "@/app/auth/actions";
import { AuthField, AuthForm, AuthLink } from "@/components/AuthForm";
import { PasswordField } from "@/components/PasswordField";
import { verifiedProfile } from "@/lib/auth";

/** Reasons another page may have sent someone back here. */
const NOTICES: Record<string, string> = {
  pending: "Akun Anda belum disetujui admin. Silakan tunggu persetujuan.",
  inactive: "Akun Anda dinonaktifkan. Hubungi admin.",
  "password-updated": "Kata sandi berhasil diperbarui. Silakan masuk kembali.",
  "link-invalid": "Tautan sudah tidak berlaku atau sudah pernah dipakai.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  // Verified with Supabase, not just locally: if the middleware refused this session
  // (it lets /login through regardless), sending it to / would bounce straight back.
  const profile = await verifiedProfile();
  if (profile?.status === "active") redirect("/");

  const { notice } = await searchParams;

  return (
    <AuthForm
      title="Masuk"
      intro="Gunakan akun yang telah disetujui admin."
      action={signInAction}
      submitLabel="Masuk"
      pendingLabel="Memeriksa…"
      initialNotice={notice ? NOTICES[notice] : undefined}
      footer={
        <>
          <p>
            Belum punya akun? <AuthLink href="/register">Daftar</AuthLink>
          </p>
          <p className="mt-1">
            <AuthLink href="/forgot-password">Lupa kata sandi?</AuthLink>
          </p>
        </>
      }
    >
      <AuthField name="email" label="Email" type="email" autoComplete="email" />
      <PasswordField
        name="password"
        label="Kata sandi"
        autoComplete="current-password"
      />
    </AuthForm>
  );
}
