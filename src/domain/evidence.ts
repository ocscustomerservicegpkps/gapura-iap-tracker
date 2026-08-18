import type { ItemKey } from "./types";

/** Google editors reached through Drive: `/edit` on any of these opens in edit mode. */
const GOOGLE_EDITORS = ["document", "spreadsheets", "presentation", "drawings"];

/**
 * Column Q is the evidence trail, so what it holds has to open read-only. Drive
 * hands back an `/edit` URL even for a plain uploaded `.docx`, and anyone who does
 * have write access following that link lands in an editor over the evidence.
 *
 * Rewrite Google's own URLs to their viewer and leave everything else alone — a
 * link to some other system is not ours to rewrite. Sharing is a separate control:
 * uploads are granted reader-by-link, which this cannot and does not replace.
 */
export function viewOnlyLink(rawLink: string): string {
  let url: URL;
  try {
    url = new URL(rawLink.trim());
  } catch {
    return rawLink;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return rawLink;

  const segments = url.pathname.split("/").filter(Boolean);

  // https://docs.google.com/document/d/{id}/edit?usp=drivesdk → .../{id}/preview
  if (url.hostname === "docs.google.com") {
    const [kind, marker, id] = segments;
    if (kind && GOOGLE_EDITORS.includes(kind) && marker === "d" && id) {
      return `https://docs.google.com/${kind}/d/${id}/preview`;
    }
    return rawLink;
  }

  // https://drive.google.com/file/d/{id}/view?usp=drivesdk → the same, without the
  // query string Drive appends. `/view` is already the read-only viewer.
  if (url.hostname === "drive.google.com") {
    const [kind, marker, id] = segments;
    if (kind === "file" && marker === "d" && id) {
      return `https://drive.google.com/file/d/${id}/view`;
    }
    return rawLink;
  }

  return rawLink;
}

export interface EvidenceFileIdentity {
  station: string;
  date: string;
}

/** A readable, Drive-safe filename tied to the Tracker row that owns the file. */
export function evidenceFileName(
  original: string,
  key: ItemKey,
  identity: EvidenceFileIdentity,
): string {
  const safeOriginal = fileNamePart(original, "evidence", 100, true);
  const safeIap = fileNamePart(key.iapId, "Tanpa-ID", 50);
  const safeDate = fileNamePart(identity.date, "Tanpa-Tanggal", 30);
  const safeStation = fileNamePart(identity.station, "Tanpa-Stasiun", 80);
  return `${safeIap}_${safeDate}_${safeStation}_Langkah-${key.stepNo}_${safeOriginal}`;
}

function fileNamePart(
  value: string,
  fallback: string,
  maxLength: number,
  keepTail = false,
): string {
  const safe = value
    .normalize("NFKC")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const shortened = keepTail ? safe.slice(-maxLength) : safe.slice(0, maxLength);
  return shortened || fallback;
}
