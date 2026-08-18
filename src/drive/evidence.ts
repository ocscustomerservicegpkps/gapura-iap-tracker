import "server-only";

import { Readable } from "node:stream";
import { google, type drive_v3 } from "googleapis";
import {
  evidenceFileName,
  viewOnlyLink,
  type EvidenceFileIdentity,
} from "@/domain/evidence";
import type { ItemKey } from "@/domain/types";
import {
  evidenceDriveFolderId,
  googleCredentials,
} from "@/sheets/config";

export type EvidenceKind = "photo" | "document";

export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

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
}

/**
 * A service account can edit Sheets, but it has no personal Drive storage quota.
 * Uploads to a normal My Drive folder therefore use the folder owner's OAuth
 * credentials when configured. Shared Drive folders may continue using the service
 * account fallback because their files consume the shared drive's storage.
 */
function evidenceAuth() {
  const clientId = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN?.trim();
  const oauthValues = [clientId, clientSecret, refreshToken];
  const configuredValues = oauthValues.filter(Boolean).length;

  if (oauthValues.some((value) => value && /^(ISI_|your_|change_me|xxx)/i.test(value))) {
    throw new Error(
      "Konfigurasi OAuth Google Drive masih berisi placeholder. Gunakan Client ID, Client Secret, dan Refresh Token yang asli.",
    );
  }

  if (configuredValues > 0 && configuredValues < oauthValues.length) {
    throw new Error(
      "Konfigurasi OAuth Google Drive belum lengkap. Isi GOOGLE_DRIVE_OAUTH_CLIENT_ID, GOOGLE_DRIVE_OAUTH_CLIENT_SECRET, dan GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN.",
    );
  }

  if (clientId && clientSecret && refreshToken) {
    const auth = new google.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });
    return auth;
  }

  const credentials = googleCredentials();
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: credentials.clientEmail,
      private_key: credentials.privateKey.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
}

export function validateEvidenceFile(
  file: File,
  kind: EvidenceKind,
): string | null {
  if (file.size === 0) return "File evidence kosong.";
  // The whole file is buffered in memory before it reaches Drive, so the ceiling is
  // checked here against the actual body rather than against a Content-Length header
  // — that header counts the multipart envelope too and was rejecting valid files.
  if (file.size > MAX_EVIDENCE_BYTES) {
    return "Ukuran file evidence maksimal 10 MB.";
  }
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

export async function uploadEvidenceFile(
  file: File,
  key: ItemKey,
  identity: EvidenceFileIdentity,
): Promise<UploadedEvidence> {
  const drive = google.drive({ version: "v3", auth: evidenceAuth() });
  const fileName = evidenceFileName(file.name, key, identity);
  const mimeType = evidenceMimeType(file);
  const bytes = Buffer.from(await file.arrayBuffer());
  let uploaded;
  try {
    uploaded = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: fileName,
        mimeType,
        parents: [evidenceDriveFolderId()],
      },
      media: {
        mimeType,
        body: Readable.from(bytes),
      },
      fields: "id,webViewLink",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/storage quota|storageQuotaExceeded/i.test(message)) {
      throw new Error(
        "Service account tidak memiliki kuota Google Drive. Konfigurasikan OAuth akun pemilik folder melalui GOOGLE_DRIVE_OAUTH_CLIENT_ID, GOOGLE_DRIVE_OAUTH_CLIENT_SECRET, dan GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN.",
      );
    }
    throw error;
  }

  const fileId = uploaded.data.id;
  if (!fileId) throw new Error("Google Drive tidak mengembalikan ID file.");

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
  };
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

/** Best-effort rollback when the sheet write fails after Drive accepted the file. */
export async function deleteEvidenceFile(fileId: string): Promise<void> {
  await google.drive({ version: "v3", auth: evidenceAuth() }).files.delete({
    fileId,
    supportsAllDrives: true,
  });
}
