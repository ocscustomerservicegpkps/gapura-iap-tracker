import { request, type FullConfig } from "@playwright/test";

/**
 * Fail fast, and clearly, when the suite is pointed somewhere it cannot run.
 *
 * Every spec resets the sheet to the 66-row fixture first and several read the stored
 * grid back; both go through `/api/test/*`, which exists only when the in-memory
 * transport is bound. Without this check, pointing the suite at a real spreadsheet
 * produces 52 identical 404s instead of one sentence explaining why.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) throw new Error("No baseURL configured");

  const context = await request.newContext({ baseURL });
  try {
    const response = await context.post("/api/test/reset");
    if (!response.ok()) {
      throw new Error(
        [
          "",
          "The end-to-end suite needs the in-memory transport.",
          "",
          `POST ${baseURL}/api/test/reset returned ${response.status()}, which means the`,
          "server is bound to a real spreadsheet. That endpoint is deliberately absent",
          "there so a deployment can never expose a reset button.",
          "",
          "Run the suite with SHEETS_TRANSPORT=memory (the default).",
          "",
          "Running against the throwaway Google Sheet — the configuration the spec calls",
          "the reference — additionally needs that sheet to exist and the specs that read",
          "/api/test/snapshot to assert through the Sheets API instead. See README.md.",
          "",
        ].join("\n"),
      );
    }
  } finally {
    await context.dispose();
  }
}
