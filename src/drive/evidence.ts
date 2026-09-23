import "server-only";

import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { auth, drive as driveApi, type drive_v3 } from "@googleapis/drive";
import {
  evidenceFileName,
  viewOnlyLink,
  type EvidenceFileIdentity,
} from "@/domain/evidence";
import {
  evidenceFileSizeError,
  MAX_EVIDENCE_BYTES,
} from "@/domain/evidence-file";
import type { ItemKey } from "@/domain/types";
import { evidenceDriveFolderId } from "@/sheets/config";

export { evidenceUploadStatus } from "@/drive/evidence-config";

export type EvidenceKind = "photo" | "document";

export { MAX_EVIDENCE_BYTES } from "@/domain/evidence-file";
const PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const PHOTO_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);

const DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const DOCUMENT_EXTENSIONS = new Set(["pdf", "doc", "docx"]);

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export interface UploadedEvidence {
  fileId: string;
  webViewLink: string;
  /**
   * True when this call did not create the file — an identical upload for the same
   * row gotten there first. The caller must not delete a reused file on rollback:
   * it is the file an earlier, already-committed row is linked to.
   */
  reused: boolean;
}

/**
 * Hangs are the failure mode that produces duplicates: the browser gives up, the
 * person picks the file again, and the first request is still on its way to Drive.
 * Failing the call outright keeps the retry a retry rather than a second upload
 * racing the first.
 */
const DRIVE_TIMEOUT_MS = 60_000;

/** Applied per request rather than per client, so each call gets its own budget. */
const driveTimeout = { timeout: DRIVE_TIMEOUT_MS };

/**
 * Marks every uploaded file with a fingerprint of its bytes plus the row it was
 * attached to, so a repeat of the same upload is recognisable in Drive itself. No
 * extra table is involved, which matters because the duplicate has to be detected
 * across serverless invocations that share nothing.
 */
const EVIDENCE_HASH_PROPERTY = "iapEvidenceHash";

function evidenceFingerprint(
  bytes: Buffer,
  key: ItemKey,
  fileName: string,
): string {
  return createHash("sha256")
    .update(`${key.iapId}\0${key.stepNo}\0${fileName}\0`)
    .update(bytes)
    .digest("hex");
}

/** My Drive uploads run as the folder owner so files use that account's quota. */
function evidenceAuth() {
  const clientId = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN?.trim();
  const values = [clientId, clientSecret, refreshToken];

  if (values.some((value) => value && /^(ISI_|your_|change_me|xxx)/i.test(value))) {
    throw new Error(
      "Konfigurasi OAuth Google Drive masih berisi placeholder. Gunakan Client ID, Client Secret, dan Refresh Token yang asli.",
    );
  }
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Konfigurasi OAuth Google Drive belum lengkap. Isi GOOGLE_DRIVE_OAUTH_CLIENT_ID, GOOGLE_DRIVE_OAUTH_CLIENT_SECRET, dan GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN.",
    );
  }

  const client = new auth.OAuth2(clientId, clientSecret);
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

export function validateEvidenceFile(
  file: File,
  kind: EvidenceKind,
): string | null {
  if (file.size === 0) return "File evidence kosong.";
  // The whole file is buffered in memory before it reaches Drive, so the ceiling is
  // checked here against the actual body rather than against a Content-Length header
  // — that header counts the multipart envelope too and was rejecting valid files.
  const sizeError = evidenceFileSizeError(file);
  if (sizeError) return sizeError;
  const allowedTypes = kind === "photo" ? PHOTO_TYPES : DOCUMENT_TYPES;
  const allowedExtensions =
    kind === "photo" ? PHOTO_EXTENSIONS : DOCUMENT_EXTENSIONS;
  const mimeType = file.type.trim().toLowerCase();
  const extension = fileExtension(file.name);

  // Windows and a number of browsers report DOC/DOCX/HEIC files with an empty
  // MIME type or application/octet-stream. The file picker already filters by
  // extension, so the server accepts the same explicit extension list instead of
  // rejecting a valid selection before it can ever reach Drive or column Q.
  if (!allowedTypes.has(mimeType) && !allowedExtensions.has(extension)) {
    return kind === "photo"
      ? "Foto harus berformat JPG, PNG, WEBP, HEIC, atau HEIF."
      : "Dokumen harus berformat PDF, DOC, atau DOCX.";
  }
  return null;
}

/**
 * `bytes` is the body the caller has already read. A `File` can only be drained
 * once cheaply, and the route reads it to check the format signature, so passing
 * the buffer through avoids holding a second copy of a 4 MB upload in memory.
 */
export async function uploadEvidenceFile(
  file: File,
  key: ItemKey,
  identity: EvidenceFileIdentity,
  bytes?: Buffer,
): Promise<UploadedEvidence> {
  const drive = driveApi({ version: "v3", auth: evidenceAuth() });
  const fileName = evidenceFileName(file.name, key, identity);
  const mimeType = evidenceMimeType(file);
  const body = bytes ?? Buffer.from(await file.arrayBuffer());
  const fingerprint = evidenceFingerprint(body, key, fileName);

  // A double-click, an impatient re-pick after a slow upload, or a retry of a
  // request that actually reached Drive all arrive here as the same bytes for the
  // same row. Adopting the file that is already there keeps one file per upload
  // instead of a folder of indistinguishable copies under the same generated name.
  const alreadyThere = await findByFingerprint(drive, fingerprint);
  if (alreadyThere) return { ...alreadyThere, reused: true };

  let uploaded;
  try {
    uploaded = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: fileName,
        mimeType,
        parents: [evidenceDriveFolderId()],
        appProperties: { [EVIDENCE_HASH_PROPERTY]: fingerprint },
      },
      media: {
        mimeType,
        body: Readable.from(body),
      },
      fields: "id,webViewLink",
    }, driveTimeout);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = (error as { code?: string | number }).code;
    if (
      code === "ETIMEDOUT" ||
      code === "ECONNRESET" ||
      /timeout of \d+ms exceeded|aborted/i.test(message)
    ) {
      throw new Error(
        "Google Drive tidak merespons sampai batas waktu. File kemungkinan belum tersimpan — coba unggah ulang file yang sama; sistem tidak akan membuat salinan ganda.",
      );
    }
    if (/invalid_grant/i.test(message)) {
      throw new Error(
        "Otorisasi Google Drive sudah tidak berlaku. Admin perlu membuat GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN baru dengan Client ID dan Client Secret yang sama, memperbarui environment Production, lalu melakukan redeploy.",
      );
    }
    if (/storage quota|storageQuotaExceeded/i.test(message)) {
      throw new Error(
        "Kuota penyimpanan akun pemilik folder Google Drive tidak mencukupi.",
      );
    }
    throw error;
  }

  const fileId = uploaded.data.id;
  if (!fileId) throw new Error("Google Drive tidak mengembalikan ID file.");

  // Two requests that both looked before either had created anything each hold a
  // file now. Drive has no conditional create to prevent that, so settle it after
  // the fact: both racers rank the candidates identically and the loser removes
  // the copy it just made, leaving the same single file for both callers.
  const winner = await settleDuplicates(drive, fingerprint, fileId);
  if (winner && winner.fileId !== fileId) return { ...winner, reused: true };

  await shareByLink(drive, fileId);

  // Drive answers with an `/edit` URL even for a plain uploaded .docx. Hand back
  // the read-only form, so what the dialog reports and what reaches column Q are
  // the same link and neither of them opens an editor.
  return {
    fileId,
    webViewLink: viewOnlyLink(
      uploaded.data.webViewLink ??
        `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`,
    ),
    reused: false,
  };
}

/** Files carrying this fingerprint, oldest first, with ID as a stable tiebreak. */
async function fingerprintMatches(
  drive: drive_v3.Drive,
  fingerprint: string,
): Promise<{ fileId: string; webViewLink: string }[]> {
  const listed = await drive.files.list({
    q: `appProperties has { key='${EVIDENCE_HASH_PROPERTY}' and value='${fingerprint}' } and '${evidenceDriveFolderId()}' in parents and trashed = false`,
    fields: "files(id,webViewLink,createdTime)",
    pageSize: 10,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  }, driveTimeout);
  return (listed.data.files ?? [])
    .filter((found): found is drive_v3.Schema$File & { id: string } => !!found.id)
    .sort(
      (a, b) =>
        (a.createdTime ?? "").localeCompare(b.createdTime ?? "") ||
        a.id.localeCompare(b.id),
    )
    .map((found) => ({
      fileId: found.id,
      webViewLink: viewOnlyLink(
        found.webViewLink ??
          `https://drive.google.com/file/d/${encodeURIComponent(found.id)}/view`,
      ),
    }));
}

/**
 * A lookup failure must never block an upload — the worst case of not finding the
 * earlier copy is the duplicate we have today, while failing here would reject a
 * file the user can legitimately attach.
 */
async function findByFingerprint(
  drive: drive_v3.Drive,
  fingerprint: string,
): Promise<{ fileId: string; webViewLink: string } | null> {
  try {
    return (await fingerprintMatches(drive, fingerprint))[0] ?? null;
  } catch (error) {
    console.error("Evidence duplicate lookup failed; continuing with a fresh upload.", error);
    return null;
  }
}

async function settleDuplicates(
  drive: drive_v3.Drive,
  fingerprint: string,
  ownFileId: string,
): Promise<{ fileId: string; webViewLink: string } | null> {
  try {
    const matches = await fingerprintMatches(drive, fingerprint);
    const winner = matches[0];
    if (!winner || winner.fileId === ownFileId) return null;
    // Only ever delete the file this call created. Drive's list is not immediately
    // consistent, so the other racer may still be deciding; it reaches the same
    // ranking and will keep the winner.
    await drive.files.delete({
      fileId: ownFileId,
      supportsAllDrives: true,
    }, driveTimeout);
    return winner;
  } catch (error) {
    console.error(
      `Could not settle duplicate evidence uploads for ${ownFileId}; the file was kept.`,
      error,
    );
    return null;
  }
}

function fileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot < 0 ? "" : fileName.slice(lastDot + 1).trim().toLowerCase();
}

function evidenceMimeType(file: File): string {
  const supplied = file.type.trim().toLowerCase();
  if (supplied && supplied !== "application/octet-stream") return supplied;
  return MIME_BY_EXTENSION[fileExtension(file.name)] ?? "application/octet-stream";
}

/**
 * A freshly uploaded file is private to whichever account the upload credentials
 * belong to. The share link then lands in column Q looking perfectly normal while
 * everybody else — including the person who just uploaded it from a different Google
 * account — sees "You need access", and the Evidence IAP folder looks empty to them.
 *
 * Grant reader-by-link so the stored URL is actually openable. A Workspace policy can
 * forbid `anyone` links; that is not a reason to fail an upload that already
 * succeeded, so the failure is logged and the file stays owner-only.
 */
async function shareByLink(
  drive: drive_v3.Drive,
  fileId: string,
): Promise<void> {
  try {
    await drive.permissions.create({
      fileId,
      supportsAllDrives: true,
      requestBody: { role: "reader", type: "anyone" },
    });
  } catch (error) {
    console.error(
      `Evidence file ${fileId} tidak bisa dibagikan lewat link. Link di kolom Q hanya bisa dibuka oleh pemilik file.`,
      error,
    );
  }
}

/**
 * Best-effort rollback when the row write fails after Drive accepted the file.
 * Retried once because a single transient 5xx here is the difference between a
 * clean folder and an orphan nobody will ever be able to trace back to a row, and
 * a file that is already gone counts as rolled back.
 */
export async function deleteEvidenceFile(fileId: string): Promise<void> {
  const drive = driveApi({ version: "v3", auth: evidenceAuth() });
  for (let attempt = 0; ; attempt++) {
    try {
      await drive.files.delete({
        fileId,
        supportsAllDrives: true,
      }, driveTimeout);
      return;
    } catch (error) {
      const status = (error as { status?: number; code?: number }).status
        ?? (error as { code?: number }).code;
      if (status === 404) return;
      if (attempt >= 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}
