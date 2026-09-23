# Service Account Authentication for Evidence Drive

## Goal

Use the configured Google service account exclusively for evidence operations in the Shared Drive. Evidence uploads must no longer depend on a user's OAuth refresh token.

## Scope

- Make Drive evidence list, upload, permission, and delete operations authenticate with the existing service-account credentials.
- Treat the evidence upload configuration as ready only when the Shared Drive folder ID, service-account email, and private key are present.
- Remove active OAuth environment variables and instructions from the application configuration documentation.
- Preserve evidence validation, duplicate detection, file naming, permission creation, tracker-link persistence, and rollback behavior.

## Design

`src/drive/evidence.ts` will construct a Google `GoogleAuth` client from `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PRIVATE_KEY` for every Drive operation. It will not inspect or prefer the `GOOGLE_DRIVE_OAUTH_*` variables.

`evidenceUploadStatus()` will report the exact missing service-account configuration. `GOOGLE_DRIVE_EVIDENCE_FOLDER_ID` remains required and is assumed to identify a folder inside the Shared Drive where the service account is already a member.

The OAuth-specific `invalid_grant` guidance will be removed from the upload path because OAuth will no longer participate in evidence authentication. Other Drive errors will retain their existing handling.

The OAuth authorization helper, its package command, and its active documentation will be removed because evidence upload is the only documented consumer and the project will no longer support that authentication path.

## Deployment

Production must contain:

- `GOOGLE_DRIVE_EVIDENCE_FOLDER_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`

The three `GOOGLE_DRIVE_OAUTH_*` variables should be removed from the deployment environment after the code change. Their presence will no longer affect runtime behavior.

## Verification

1. Run TypeScript type checking.
2. Run relevant automated tests.
3. Perform a read-only `files.list` request against the configured Shared Drive folder with the service account.
4. Confirm the probe succeeds without reading or using any OAuth environment variable.
5. Confirm the working tree contains no unintended changes and no secrets are printed or committed.

## Success Criteria

- The service account can list the configured Shared Drive folder.
- Evidence operations use only service-account authentication.
- An expired or invalid OAuth refresh token cannot break evidence uploads.
- Existing evidence behavior outside authentication remains unchanged.
