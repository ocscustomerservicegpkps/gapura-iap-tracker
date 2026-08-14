import { revalidatePath, revalidateTag } from "next/cache";
import {
  readItems,
  appendEvidenceLinks,
  TRACKER_TAG,
} from "@/data/tracker-repository";
import { todayInJakarta } from "@/domain/dates";
import {
  deleteEvidenceFile,
  type EvidenceKind,
  uploadEvidenceFile,
  validateEvidenceFile,
} from "@/drive/evidence";
import { isMemoryTransport } from "@/sheets";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ iapId: string; stepNo: string }> },
) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "Permintaan upload tidak valid." }, { status: 403 });
  }
  if (isMemoryTransport()) {
    return Response.json(
      { error: "Upload Google Drive tidak tersedia pada mode data offline." },
      { status: 503 },
    );
  }

  const { iapId, stepNo: rawStepNo } = await params;
  const stepNo = Number(rawStepNo);
  if (!iapId.trim() || !Number.isInteger(stepNo) || stepNo < 1) {
    return Response.json({ error: "Identitas item evidence tidak valid." }, { status: 400 });
  }

  try {
    const form = await request.formData();
    const kind = form.get("kind");
    const file = form.get("file");
    if (kind !== "photo" && kind !== "document") {
      return Response.json({ error: "Jenis evidence tidak valid." }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return Response.json({ error: "Pilih file evidence terlebih dahulu." }, { status: 400 });
    }

    const validationError = validateEvidenceFile(file, kind as EvidenceKind);
    if (validationError) {
      return Response.json({ error: validationError }, { status: 400 });
    }

    const requestedStepNos = parseStepNos(form.get("stepNos"), stepNo);
    if (!requestedStepNos) {
      return Response.json(
        { error: "Daftar langkah tujuan evidence tidak valid." },
        { status: 400 },
      );
    }

    const keys = requestedStepNos.map((targetStepNo) => ({
      iapId,
      stepNo: targetStepNo,
    }));
    const items = await readItems();
    const targetItems = keys.map((key) =>
      items.find(
        (candidate) =>
          candidate.iapId === key.iapId && candidate.stepNo === key.stepNo,
      ),
    );
    const missingIndex = targetItems.findIndex((item) => !item);
    if (missingIndex >= 0) {
      const missing = keys[missingIndex]!;
      return Response.json(
        { error: `Item ${missing.iapId} langkah ${missing.stepNo} tidak ditemukan.` },
        { status: 404 },
      );
    }

    // Upload the binary once, then reuse its share link for every selected row.
    // This mirrors the IRRS flow and avoids duplicate Drive files when the user
    // selects "Semua Langkah Perbaikan".
    const primaryKey = keys[0]!;
    const primaryItem = targetItems[0]!;
    const uploaded = await uploadEvidenceFile(file, primaryKey, {
      station: primaryItem.station,
      date: primaryItem.targetDate || todayInJakarta(),
    });
    const saved = await appendEvidenceLinks(keys, uploaded.webViewLink);
    if (!saved.ok) {
      try {
        await deleteEvidenceFile(uploaded.fileId);
      } catch (rollbackError) {
        console.error("Failed to roll back orphaned evidence file", rollbackError);
      }
      return Response.json(
        { error: Object.values(saved.errors)[0] ?? "Gagal menyimpan link evidence." },
        { status: 404 },
      );
    }

    revalidateTag(TRACKER_TAG);
    revalidatePath("/");
    return Response.json({
      url: uploaded.webViewLink,
      name: file.name,
      stepNos: requestedStepNos,
    });
  } catch (error) {
    console.error("Evidence upload failed", error);
    return Response.json(
      { error: `Gagal mengunggah evidence: ${messageOf(error)}` },
      { status: 500 },
    );
  }
}

function parseStepNos(value: FormDataEntryValue | null, fallback: number): number[] | null {
  if (value === null) return [fallback];
  if (typeof value !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 100) {
      return null;
    }
    const unique = [...new Set(parsed)];
    if (
      unique.some(
        (candidate) =>
          typeof candidate !== "number" ||
          !Number.isInteger(candidate) ||
          candidate < 1,
      )
    ) {
      return null;
    }
    return unique as number[];
  } catch {
    return null;
  }
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const forwardedHost = request.headers
      .get("x-forwarded-host")
      ?.split(",")[0]
      ?.trim();
    const candidateHosts = [
      request.headers.get("host")?.trim(),
      forwardedHost,
      new URL(request.url).host,
    ].filter((host): host is string => Boolean(host));

    return candidateHosts.some(
      (candidate) =>
        candidate === originUrl.host ||
        sameLoopbackHost(candidate, originUrl.host),
    );
  } catch {
    return false;
  }
}

function sameLoopbackHost(left: string, right: string): boolean {
  const parse = (host: string) => {
    const url = new URL(`http://${host}`);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return { loopback, port: url.port || "80" };
  };
  const a = parse(left);
  const b = parse(right);
  return a.loopback && b.loopback && a.port === b.port;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
