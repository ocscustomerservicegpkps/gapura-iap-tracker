import { getTransport, isMemoryTransport, TRACKER_TAB } from "@/sheets";

export const dynamic = "force-dynamic";

/**
 * Writes a cell straight into the offline sheet, behind the app's back, so a test
 * can act out someone editing the spreadsheet by hand. Deliberately does not
 * revalidate anything: the point is to prove the dashboard notices on its own.
 *
 * Only reachable when the in-memory transport is bound, so it cannot exist on a
 * deployment that talks to a real spreadsheet.
 */
export async function POST(request: Request) {
  if (!isMemoryTransport()) {
    return new Response("Not found", { status: 404 });
  }

  const { range, value } = (await request.json()) as {
    range?: string;
    value?: string;
  };
  if (typeof range !== "string" || !range.startsWith(`${TRACKER_TAB}!`)) {
    return Response.json({ error: "range must target the Tracker tab." }, { status: 400 });
  }

  await getTransport().writeRanges([{ range, values: [[value ?? ""]] }]);
  return Response.json({ ok: true });
}
