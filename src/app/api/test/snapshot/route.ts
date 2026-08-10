import { isMemoryTransport, memorySnapshot } from "@/sheets";

export const dynamic = "force-dynamic";

/**
 * The offline sheet's raw grid, so tests can assert on what actually landed in the
 * spreadsheet rather than on what the page happens to show.
 */
export async function GET() {
  if (!isMemoryTransport()) {
    return new Response("Not found", { status: 404 });
  }
  return Response.json({ rows: memorySnapshot() });
}
