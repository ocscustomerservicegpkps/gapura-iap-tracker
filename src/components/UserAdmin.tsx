"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveUserAction,
  deleteUserAction,
  saveUserAction,
} from "@/app/admin/users/actions";
import type { MutationResult } from "@/data/tracker-repository";
import { isBranchCode } from "@/domain/branches";
import { firstError, type FieldErrors } from "@/domain/validate";
import { BranchSelect } from "./BranchSelect";
import { ConfirmDialog } from "./ConfirmDialog";
import { Modal } from "./Modal";
import { runAction } from "./run-action";
import { useErrorFocus } from "./use-error-focus";

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  branchCode: string;
  role: "admin" | "user";
  status: "pending" | "active" | "inactive";
  /** Preformatted on the server, so the table cannot hydrate to a different date. */
  createdAt: string;
}

type Dialog =
  | { kind: "none" }
  | { kind: "edit"; user: AdminUser }
  | { kind: "delete"; user: AdminUser };

const STATUS_LABEL: Record<AdminUser["status"], string> = {
  pending: "Menunggu",
  active: "Aktif",
  inactive: "Nonaktif",
};

const STATUS_PILL: Record<AdminUser["status"], string> = {
  pending: "bg-running-soft text-running-ink",
  active: "bg-done-soft text-done-ink",
  inactive: "bg-idle-soft text-idle-ink",
};

const ROLE_LABEL: Record<AdminUser["role"], string> = {
  admin: "Admin",
  user: "Pengguna cabang",
};

/** Matches the tracker tables: a branch nobody set reads as a gap, not as a code. */
function branchText(user: AdminUser): string {
  return isBranchCode(user.branchCode) ? user.branchCode : "Belum ditentukan";
}

export function UserAdmin({
  users,
  currentUserId,
}: {
  users: readonly AdminUser[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>({ kind: "none" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();
  /** Which row is mid-request, so only that row's buttons go quiet. */
  const [busyId, setBusyId] = useState<string | null>(null);

  const waitingForApproval = users.filter((user) => user.status === "pending");

  function run(id: string, action: () => Promise<MutationResult>) {
    setBusyId(id);
    setErrors({});
    startTransition(async () => {
      const result = await runAction(action);
      setBusyId(null);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      setDialog({ kind: "none" });
      router.refresh();
    });
  }

  const rowProps = (user: AdminUser, prefix: string) => ({
    user,
    prefix,
    isSelf: user.id === currentUserId,
    busy: pending && busyId === user.id,
    disabled: pending,
    onApprove: () => run(user.id, () => approveUserAction(user.id)),
    onEdit: () => {
      setErrors({});
      setDialog({ kind: "edit", user });
    },
    onDelete: () => {
      setErrors({});
      setDialog({ kind: "delete", user });
    },
  });

  const formError = dialog.kind === "none" ? errors.form : undefined;

  return (
    <>
      {formError ? (
        <p
          role="alert"
          className="card mb-4 border-late/30 bg-late-soft px-3.5 py-2.5 text-[13px] text-late-ink"
          data-testid="user-admin-error"
        >
          {formError}
        </p>
      ) : null}

      {/* Approving is the job this page exists for, so anything waiting is lifted
          out of the roll and shown first rather than found by scanning statuses. */}
      <section className="card mb-6 px-4 py-4 sm:px-[22px] sm:py-5">
        <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[14px] font-semibold text-ink">
            Menunggu Persetujuan
          </h2>
          <span className="text-[13px] text-idle" data-testid="pending-count">
            {waitingForApproval.length} pendaftaran
          </span>
        </div>

        {waitingForApproval.length === 0 ? (
          <p className="text-[13px] text-faint">
            Tidak ada pendaftaran yang menunggu persetujuan.
          </p>
        ) : (
          <UserTable
            users={waitingForApproval}
            rowProps={rowProps}
            testId="pending-users"
            caption="Pendaftaran yang menunggu persetujuan admin."
          />
        )}
      </section>

      <section className="card px-4 py-4 sm:px-[22px] sm:py-5">
        <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[14px] font-semibold text-ink">Seluruh Pengguna</h2>
          <span className="text-[13px] text-idle" data-testid="user-count">
            {users.length} akun
          </span>
        </div>

        {users.length === 0 ? (
          <p className="text-[13px] text-faint">Belum ada akun terdaftar.</p>
        ) : (
          <UserTable
            users={users}
            rowProps={rowProps}
            testId="all-users"
            caption="Seluruh akun: nama, email, cabang, peran, status dan tanggal daftar."
          />
        )}
      </section>

      {dialog.kind === "edit" ? (
        <EditUserModal
          user={dialog.user}
          isSelf={dialog.user.id === currentUserId}
          errors={errors}
          busy={pending}
          onCancel={() => setDialog({ kind: "none" })}
          onSave={(input) => run(dialog.user.id, () => saveUserAction(dialog.user.id, input))}
        />
      ) : null}

      {dialog.kind === "delete" ? (
        <ConfirmDialog
          title="Hapus akun"
          message={`Hapus akun ${dialog.user.email}?`}
          detail="Akun login ikut terhapus dan tindakan ini tidak dapat dibatalkan. Alamat email tersebut dapat mendaftar kembali nanti."
          confirmLabel="Hapus akun"
          busy={pending}
          error={errors.form ?? null}
          onConfirm={() => run(dialog.user.id, () => deleteUserAction(dialog.user.id))}
          onCancel={() => setDialog({ kind: "none" })}
        />
      ) : null}
    </>
  );
}

interface RowProps {
  user: AdminUser;
  /**
   * Distinguishes the phone card's controls from the table row's. Both layouts are
   * in the DOM at every width — one is merely hidden — so without this they would
   * publish the same `data-testid` twice and a test could target the hidden one.
   */
  prefix: string;
  isSelf: boolean;
  busy: boolean;
  disabled: boolean;
  onApprove: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function UserTable({
  users,
  rowProps,
  testId,
  caption,
}: {
  users: readonly AdminUser[];
  rowProps: (user: AdminUser, prefix: string) => RowProps;
  testId: string;
  caption: string;
}) {
  return (
    <>
      {/* Phones get one card per account, the same way the tracker tables do —
          six columns behind a sideways scroll is not a roll anyone can read. */}
      <ul className="space-y-3 md:hidden" data-testid={`${testId}-cards`}>
        {users.map((user) => (
          <UserCard key={user.id} {...rowProps(user, `${testId}-card`)} />
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-[13px]" data-testid={testId}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-line">
              <Th>Pengguna</Th>
              <Th>Cabang</Th>
              <Th>Peran</Th>
              <Th center>Status</Th>
              <Th>Terdaftar</Th>
              <Th right>Aksi</Th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <UserRow key={user.id} {...rowProps(user, testId)} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function UserRow({
  user,
  prefix,
  isSelf,
  busy,
  disabled,
  onApprove,
  onEdit,
  onDelete,
}: RowProps) {
  return (
    <tr
      className="border-b border-line-soft transition-colors hover:bg-head/60"
      data-testid={`${prefix}-row-${user.email}`}
    >
      <th scope="row" className="max-w-[300px] px-2.5 py-2.5 text-left font-normal">
        <span className="font-semibold text-ink">
          {user.fullName || "(tanpa nama)"}
          {isSelf ? (
            <span className="ml-1.5 font-normal text-[11px] text-faint">(Anda)</span>
          ) : null}
        </span>
        <span className="mt-0.5 block font-mono text-[11px] text-faint">
          {user.email}
        </span>
      </th>
      <td className="px-2.5 py-2.5">
        {isBranchCode(user.branchCode) ? (
          <span className="font-mono text-[12px] font-semibold text-ink-mid">
            {user.branchCode}
          </span>
        ) : (
          <span className="text-[12px] text-late-ink">{branchText(user)}</span>
        )}
      </td>
      <td className="px-2.5 py-2.5 text-ink-mid">{ROLE_LABEL[user.role]}</td>
      <td className="px-2.5 py-2.5 text-center">
        <span className={`pill ${STATUS_PILL[user.status]}`}>
          {STATUS_LABEL[user.status]}
        </span>
      </td>
      <td className="px-2.5 py-2.5 whitespace-nowrap text-faint">{user.createdAt}</td>
      <td className="px-2.5 py-2.5">
        <div className="flex flex-wrap justify-end gap-2">
          <RowActions
            user={user}
            prefix={prefix}
            isSelf={isSelf}
            busy={busy}
            disabled={disabled}
            onApprove={onApprove}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      </td>
    </tr>
  );
}

function UserCard({
  user,
  prefix,
  isSelf,
  busy,
  disabled,
  onApprove,
  onEdit,
  onDelete,
}: RowProps) {
  return (
    <li
      className="rounded-[8px] border border-line-soft px-3.5 py-3"
      data-testid={`${prefix}-${user.email}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-ink">
            {user.fullName || "(tanpa nama)"}
            {isSelf ? (
              <span className="ml-1.5 text-[11px] font-normal text-faint">(Anda)</span>
            ) : null}
          </div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-faint">
            {user.email}
          </div>
        </div>
        <span className={`pill shrink-0 ${STATUS_PILL[user.status]}`}>
          {STATUS_LABEL[user.status]}
        </span>
      </div>

      <dl className="mt-2.5 grid grid-cols-3 gap-2 text-[11.5px]">
        <div>
          <dt className="font-semibold text-label">Cabang</dt>
          <dd className="font-mono text-[12px] font-semibold text-ink-mid">
            {branchText(user)}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-label">Peran</dt>
          <dd className="text-[12px] text-ink-mid">{ROLE_LABEL[user.role]}</dd>
        </div>
        <div>
          <dt className="font-semibold text-label">Terdaftar</dt>
          <dd className="text-[12px] text-ink-mid">{user.createdAt}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap gap-2">
        <RowActions
          user={user}
          prefix={prefix}
          isSelf={isSelf}
          busy={busy}
          disabled={disabled}
          onApprove={onApprove}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    </li>
  );
}

function RowActions({
  user,
  prefix,
  isSelf,
  busy,
  disabled,
  onApprove,
  onEdit,
  onDelete,
}: RowProps) {
  return (
    <>
      {user.status === "pending" ? (
        <LinkButton
          onClick={onApprove}
          disabled={disabled}
          testId={`${prefix}-approve-${user.email}`}
          accent
        >
          {busy ? "Memproses…" : "Setujui"}
        </LinkButton>
      ) : null}
      <LinkButton onClick={onEdit} disabled={disabled} testId={`${prefix}-edit-${user.email}`}>
        Ubah
      </LinkButton>
      {/* Removing your own admin access mid-click would lock you out, so the row
          that is you simply does not offer it. */}
      {isSelf ? null : (
        <LinkButton
          onClick={onDelete}
          disabled={disabled}
          testId={`${prefix}-delete-${user.email}`}
          danger
        >
          Hapus
        </LinkButton>
      )}
    </>
  );
}

function EditUserModal({
  user,
  isSelf,
  errors,
  busy,
  onCancel,
  onSave,
}: {
  user: AdminUser;
  isSelf: boolean;
  errors: FieldErrors;
  busy: boolean;
  onCancel: () => void;
  onSave: (input: {
    fullName: string;
    branchCode: string;
    role: string;
    status: string;
  }) => void;
}) {
  const [fullName, setFullName] = useState(user.fullName);
  const [branchCode, setBranchCode] = useState(user.branchCode);
  const [role, setRole] = useState<string>(user.role);
  const [status, setStatus] = useState<string>(user.status);
  useErrorFocus(errors);

  const dirty =
    fullName !== user.fullName ||
    branchCode !== user.branchCode ||
    role !== user.role ||
    status !== user.status;

  return (
    <Modal
      title="Ubah pengguna"
      subtitle={user.email}
      width="narrow"
      testId="edit-user-modal"
      dirty={dirty}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            Batal
          </button>
          <button
            type="submit"
            form="edit-user-form"
            className="btn btn-primary"
            disabled={busy || !dirty}
            data-testid="save-user"
          >
            {busy ? "Menyimpan…" : "Simpan perubahan"}
          </button>
        </>
      }
    >
      <form
        id="edit-user-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ fullName, branchCode, role, status });
        }}
        className="space-y-4"
      >
        {/* `firstError` falls back to a generic sentence, so it is only asked once
            there is genuinely something to report. */}
        {Object.keys(errors).length > 0 ? (
          <p role="alert" className="text-[13px] text-late-ink" data-testid="edit-user-error">
            {firstError(errors)}
          </p>
        ) : null}

        <div>
          <label className="label" htmlFor="fullName">
            Nama lengkap
          </label>
          <input
            id="fullName"
            className="field w-full"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="branchCode">
            Cabang
          </label>
          {/* An account whose branch was never set carries a code matching no
              station, so it sees nothing until an admin picks one here. */}
          <BranchSelect
            id="branchCode"
            name="branchCode"
            defaultValue={branchCode}
            onChange={setBranchCode}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="role">
              Peran
            </label>
            <select
              id="role"
              className="field w-full"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              disabled={isSelf}
            >
              <option value="user">Pengguna cabang</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div>
            <label className="label" htmlFor="status">
              Status
            </label>
            <select
              id="status"
              className="field w-full"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              disabled={isSelf}
            >
              <option value="pending">Menunggu persetujuan</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </div>
        </div>

        {isSelf ? (
          <p className="text-[11.5px] text-faint">
            Peran dan status akun Anda sendiri terkunci, agar Anda tidak mengunci
            diri sendiri di luar aplikasi.
          </p>
        ) : null}
      </form>
    </Modal>
  );
}

function Th({
  children,
  center = false,
  right = false,
}: {
  children: React.ReactNode;
  center?: boolean;
  right?: boolean;
}) {
  const align = center ? "text-center" : right ? "text-right" : "text-left";
  return (
    <th
      scope="col"
      className={`px-2.5 py-2 font-semibold whitespace-nowrap text-idle ${align}`}
    >
      {children}
    </th>
  );
}

const LINK_CLASS =
  "flex min-h-[28px] cursor-pointer items-center rounded-[5px] border border-line px-2.5 py-1 text-[11.5px] font-semibold hover:bg-head disabled:cursor-not-allowed disabled:opacity-55";

function LinkButton({
  children,
  onClick,
  testId,
  disabled = false,
  danger = false,
  accent = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  testId: string;
  disabled?: boolean;
  danger?: boolean;
  accent?: boolean;
}) {
  const tone = danger
    ? "text-late-ink"
    : accent
      ? "border-accent/40 bg-plan-soft text-plan-ink"
      : "text-ink-mid";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={`${LINK_CLASS} ${tone}`}
    >
      {children}
    </button>
  );
}
