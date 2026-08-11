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
  const [items, contexts] = await Promise.all([readItems(), readContexts()]);
  const rows = items.filter((item) => item.iapId === iapId);

  if (rows.length === 0) {
    return new Response(`Kasus IAP "${iapId}" tidak ditemukan.`, {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const doc = buildIapDocument(rows, contexts[iapId] ?? null);

  if (new URL(request.url).searchParams.get("format") === "docx") {
    // A filename header is bytes, not text: anything outside ASCII is dropped rather
    // than sent raw, and IAP ids are alphanumeric anyway.
    const name = `IAP-${iapId.replace(/[^A-Za-z0-9._-]/g, "_")}.docx`;
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
