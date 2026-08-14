import "server-only";

import { Readable } from "node:stream";
import { google } from "googleapis";
import {
  evidenceFileName,
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

const DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

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
  if (file.size > MAX_EVIDENCE_BYTES) {
    return "Ukuran file evidence maksimal 10 MB.";
  }

  const allowed = kind === "photo" ? PHOTO_TYPES : DOCUMENT_TYPES;
  if (!allowed.has(file.type.toLowerCase())) {
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
  const bytes = Buffer.from(await file.arrayBuffer());
  let uploaded;
  try {
    uploaded = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: fileName,
        mimeType: file.type,
        parents: [evidenceDriveFolderId()],
      },
      media: {
        mimeType: file.type,
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
  return {
    fileId,
    webViewLink:
      uploaded.data.webViewLink ??
      `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`,
  };
}

/** Best-effort rollback when the sheet write fails after Drive accepted the file. */
export async function deleteEvidenceFile(fileId: string): Promise<void> {
  await google.drive({ version: "v3", auth: evidenceAuth() }).files.delete({
    fileId,
    supportsAllDrives: true,
  });
}
