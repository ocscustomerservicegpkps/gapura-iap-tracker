import { CONTEXT_TAB, isMemoryTransport, memorySnapshot, TRACKER_TAB } from "@/sheets";

export const dynamic = "force-dynamic";

/** Only the tabs the app owns, so the endpoint cannot be used to probe the file. */
const READABLE = [TRACKER_TAB, CONTEXT_TAB];

/**
 * The offline sheet's raw grid, so tests can assert on what actually landed in the
 * spreadsheet rather than on what the page happens to show.
 */
export async function GET(request: Request) {
  if (!isMemoryTransport()) {
    return new Response("Not found", { status: 404 });
  }
  const tab = new URL(request.url).searchParams.get("tab") ?? TRACKER_TAB;
  if (!READABLE.includes(tab)) {
    return new Response("Not found", { status: 404 });
  }
  return Response.json({ rows: memorySnapshot(tab) });
}
