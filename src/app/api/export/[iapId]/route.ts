import { readContexts } from "@/data/case-context";
import { readItems } from "@/data/tracker-repository";
import { DOCX_CONTENT_TYPE, renderDocx } from "@/export/docx";
import { buildIapDocument } from "@/export/iap-document";
import { renderPrintHtml } from "@/export/print-html";

export const dynamic = "force-dynamic";

/**
 * One IAP case as the printed document.
 *
 * `?format=docx` downloads a Word file; anything else returns the print page, which
 * opens the browser's print dialog so the reader can save it as PDF. Both render the
 * same content, laid out like the station's existing IAP document.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ iapId: string }> },
) {
  const { iapId } = await params;
  const search = new URL(request.url).searchParams;
  const rawStep = search.get("step");
  const requestedStep = parseStep(rawStep);
  if (rawStep !== null && requestedStep === null) {
    return new Response("Nomor langkah tidak valid.", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const [items, contexts] = await Promise.all([readItems(), readContexts()]);
  const caseRows = items.filter((item) => item.iapId === iapId);
  const rows = requestedStep !== null
    ? caseRows.filter((item) => item.stepNo === requestedStep)
    : caseRows;

  if (caseRows.length === 0 || rows.length === 0) {
    const target = requestedStep
      ? `Kasus IAP "${iapId}" langkah ${requestedStep}`
      : `Kasus IAP "${iapId}"`;
    return new Response(`${target} tidak ditemukan.`, {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const doc = buildIapDocument(rows, contexts[iapId] ?? null);

  if (search.get("format") === "docx") {
    // A filename header is bytes, not text: anything outside ASCII is dropped rather
    // than sent raw, and IAP ids are alphanumeric anyway.
    const suffix = requestedStep ? `-Langkah-${requestedStep}` : "";
    const name = `IAP-${iapId.replace(/[^A-Za-z0-9._-]/g, "_")}${suffix}.docx`;
    return new Response(new Uint8Array(renderDocx(doc)), {
      headers: {
        "Content-Type": DOCX_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${name}"`,
      },
    });
  }

  return new Response(renderPrintHtml(doc), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function parseStep(raw: string | null): number | null {
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}
