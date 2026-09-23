export type EvidenceKind = "photo" | "document";

/** File bytes go directly to Drive, so Vercel only receives small JSON requests. */
export const MAX_EVIDENCE_BYTES = 100 * 1024 * 1024;
export const EVIDENCE_FILE_TOO_LARGE_MESSAGE =
  "Ukuran file terlalu besar untuk diunggah. Maksimal 100 MB.";

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

export function evidenceFileSizeError(file: { size: number }): string | null {
  return file.size > MAX_EVIDENCE_BYTES
    ? EVIDENCE_FILE_TOO_LARGE_MESSAGE
    : null;
}

export function evidenceFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot < 0 ? "" : fileName.slice(lastDot + 1).trim().toLowerCase();
}

export function evidenceMimeType(file: { name: string; type: string }): string {
  const supplied = file.type.trim().toLowerCase();
  if (supplied && supplied !== "application/octet-stream") return supplied;
  return MIME_BY_EXTENSION[evidenceFileExtension(file.name)] ?? "application/octet-stream";
}

export function validateEvidenceMetadata(
  file: { name: string; type: string; size: number },
  kind: EvidenceKind,
): string | null {
  if (file.size === 0) return "File evidence kosong.";
  const sizeError = evidenceFileSizeError(file);
  if (sizeError) return sizeError;
  const mimeType = file.type.trim().toLowerCase();
  const extension = evidenceFileExtension(file.name);
  const allowedTypes = kind === "photo" ? PHOTO_TYPES : DOCUMENT_TYPES;
  const allowedExtensions = kind === "photo" ? PHOTO_EXTENSIONS : DOCUMENT_EXTENSIONS;
  const hasAllowedExtension = allowedExtensions.has(extension);
  const hasAllowedMime =
    !mimeType || mimeType === "application/octet-stream" || allowedTypes.has(mimeType);
  if (!hasAllowedExtension || !hasAllowedMime) {
    return kind === "photo"
      ? "Foto harus berformat JPG, PNG, WEBP, HEIC, atau HEIF."
      : "Dokumen harus berformat PDF, DOC, atau DOCX.";
  }
  return null;
}

/** Reads at most 2 MB: format headers plus a DOCX central-directory tail. */
export async function matchesEvidenceFileSignature(file: File): Promise<boolean> {
  const extension = evidenceFileExtension(file.name);
  const sampleBytes = 1024 * 1024;
  const head = new Uint8Array(await file.slice(0, sampleBytes).arrayBuffer());
  if (extension !== "docx" || file.size <= sampleBytes) {
    return matchesEvidenceSignature(head, extension);
  }
  const tail = new Uint8Array(
    await file.slice(Math.max(sampleBytes, file.size - sampleBytes)).arrayBuffer(),
  );
  const combined = new Uint8Array(head.length + tail.length);
  combined.set(head);
  combined.set(tail, head.length);
  return matchesEvidenceSignature(combined, extension);
}

/** Header checks stop renamed HTML/scripts. They are not a malware scanner. */
export function matchesEvidenceSignature(bytes: Uint8Array, extension: string): boolean {
  const starts = (...prefix: number[]) => prefix.every((value, i) => bytes[i] === value);
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  switch (extension) {
    case "jpg": case "jpeg": return starts(0xff, 0xd8, 0xff);
    case "png": return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "webp": return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
    case "pdf": return ascii(0, 5) === "%PDF-";
    case "doc": return starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
    case "docx": {
      if (!starts(0x50, 0x4b, 0x03, 0x04)) return false;
      const text = new TextDecoder("latin1").decode(bytes);
      return text.includes("[Content_Types].xml") && text.includes("word/document.xml");
    }
    case "heic": case "heif":
      return ascii(4, 8) === "ftyp" && /^(heic|heix|hevc|hevx|mif1|msf1)$/.test(ascii(8, 12));
    default: return false;
  }
}
