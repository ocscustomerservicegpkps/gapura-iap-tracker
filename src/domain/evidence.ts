import type { ItemKey } from "./types";

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
