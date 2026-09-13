import { signUpAction } from "@/app/auth/actions";
import { AuthField, AuthForm, AuthLink } from "@/components/AuthForm";
import { BranchSelect } from "@/components/BranchSelect";
import { PasswordField } from "@/components/PasswordField";

export default function RegisterPage() {
  return (
    <AuthForm
      title="Daftar akun"
      intro="Akun baru harus disetujui admin sebelum dapat digunakan."
      action={signUpAction}
      submitLabel="Daftar"
      pendingLabel="Mendaftarkan…"
      footer={
        <p>
          Sudah punya akun? <AuthLink href="/login">Masuk</AuthLink>
        </p>
      }
    >
      <AuthField name="fullName" label="Nama lengkap" autoComplete="name" />
      <AuthField name="email" label="Email" type="email" autoComplete="email" />

      <div>
        <label className="label" htmlFor="branchCode">
          Cabang
        </label>
        <BranchSelect name="branchCode" id="branchCode" required />
      </div>

      <PasswordField
        name="password"
        label="Kata sandi"
        autoComplete="new-password"
      />
      <PasswordField
        name="confirmPassword"
        label="Konfirmasi kata sandi"
        autoComplete="new-password"
      />
    </AuthForm>
  );
}
