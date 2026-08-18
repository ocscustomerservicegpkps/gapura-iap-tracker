import { revalidatePath } from "next/cache";
import { isMemoryTransport, resetMemoryTransport } from "@/sheets";

export const dynamic = "force-dynamic";

/**
 * Restores the offline sheet to the 66-row fixture between end-to-end tests.
 * Only reachable when the in-memory transport is bound, so it cannot exist on a
 * deployment that talks to a real spreadsheet.
 */
export async function POST() {
  if (!isMemoryTransport()) {
    return new Response("Not found", { status: 404 });
  }
  resetMemoryTransport();
  revalidatePath("/");
  return Response.json({ ok: true });
}
