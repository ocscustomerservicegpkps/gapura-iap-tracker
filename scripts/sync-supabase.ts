import { loadEnvConfig } from "@next/env";
import { database } from "../src/supabase/database";
import { GoogleSheetsTransport } from "../src/sheets/google-transport";
import { googleCredentials, TRACKER_TAB } from "../src/sheets/config";
import { normalize, indexRows } from "../src/sync/reconcile";
import { syncOnce } from "../src/sync/worker";
loadEnvConfig(process.cwd());
const sheet = new GoogleSheetsTransport(googleCredentials());
async function main() {
 if (process.argv.includes("--preview")) {
  const rows = (await sheet.readRange(`'${TRACKER_TAB.replace(/'/g, "''")}'!A2:W`))
   .filter(r => String(r[1] ?? "").trim()).map(normalize);
  indexRows(rows);
  console.log(JSON.stringify({ validRows: rows.length, cases: new Set(rows.map(r => r[1])).size }));
  return;
 }
 if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const response = await fetch(process.env.SUPABASE_URL + "/functions/v1/iap-google-mirror", {
   method: "POST", headers: { "x-iap-sync-token": process.env.IAP_SYNC_TOKEN ?? "" },
   signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error("Remote mirror failed (" + response.status + ")");
  console.log(JSON.stringify(await response.json()));
 } else console.log(JSON.stringify(await syncOnce(database(), sheet, TRACKER_TAB)));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
