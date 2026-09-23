const REQUIRED_EVIDENCE_ENV = [
  "GOOGLE_DRIVE_EVIDENCE_FOLDER_ID",
  "GOOGLE_DRIVE_OAUTH_CLIENT_ID",
  "GOOGLE_DRIVE_OAUTH_CLIENT_SECRET",
  "GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN",
] as const;

/** Whether this deployment has everything required to accept an evidence file. */
export function evidenceUploadStatus(): { ready: boolean; missing: string[] } {
  const missing = REQUIRED_EVIDENCE_ENV.filter(
    (name) => !process.env[name]?.trim(),
  );
  return { ready: missing.length === 0, missing };
}
