import { forgotPasswordAction } from "@/app/auth/actions";
import { AuthField, AuthForm, AuthLink } from "@/components/AuthForm";

export default function ForgotPasswordPage() {
  return (
    <AuthForm
      title="Lupa kata sandi"
      intro="Masukkan email akun Anda. Tautan untuk mengatur ulang kata sandi akan dikirim ke email tersebut."
      action={forgotPasswordAction}
      submitLabel="Kirim tautan"
      pendingLabel="Mengirim…"
      footer={
        <p>
          Ingat kata sandi Anda? <AuthLink href="/login">Masuk</AuthLink>
        </p>
      }
    >
      <AuthField name="email" label="Email" type="email" autoComplete="email" />
    </AuthForm>
  );
}
