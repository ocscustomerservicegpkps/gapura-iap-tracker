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
  const credentials = googleCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: credentials.clientEmail,
      private_key: credentials.privateKey.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  const drive = google.drive({ version: "v3", auth });
  const fileName = evidenceFileName(file.name, key, identity);
  const bytes = Buffer.from(await file.arrayBuffer());
  const uploaded = await drive.files.create({
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
  const credentials = googleCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: credentials.clientEmail,
      private_key: credentials.privateKey.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  await google.drive({ version: "v3", auth }).files.delete({
    fileId,
    supportsAllDrives: true,
  });
}
