import { updatePasswordAction } from "@/app/auth/actions";
import { AuthForm, AuthLink } from "@/components/AuthForm";
import { PasswordField } from "@/components/PasswordField";

/**
 * Reached only through the recovery link, which `/auth/callback` has already traded
 * for a session. Without that session the action refuses and says to request a new
 * link, so a stale bookmark cannot change anybody's password.
 */
export default function ResetPasswordPage() {
  return (
    <AuthForm
      title="Atur ulang kata sandi"
      intro="Masukkan kata sandi baru untuk akun Anda."
      action={updatePasswordAction}
      submitLabel="Simpan kata sandi"
      pendingLabel="Menyimpan…"
      footer={
        <p>
          Tautan bermasalah?{" "}
          <AuthLink href="/forgot-password">Minta tautan baru</AuthLink>
        </p>
      }
    >
      <PasswordField
        name="password"
        label="Kata sandi baru"
        autoComplete="new-password"
      />
      <PasswordField
        name="confirmPassword"
        label="Konfirmasi kata sandi baru"
        autoComplete="new-password"
      />
    </AuthForm>
  );
}
