import { transportKind } from "@/sheets";

export const dynamic = "force-dynamic";

/**
 * Liveness only — it reports which transport is bound but never touches the
 * spreadsheet, so polling it costs no Sheets API quota. The end-to-end suite waits
 * on this rather than on a test-only endpoint, so a misconfigured run reaches the
 * global setup and gets an explanation instead of a readiness timeout.
 */
export function GET() {
  return Response.json({ ok: true, transport: transportKind() });
}
