import { revalidatePath, revalidateTag } from "next/cache";
import {
  readItems,
  updateEvidenceLink,
  TRACKER_TAG,
} from "@/data/tracker-repository";
import { todayInJakarta } from "@/domain/dates";
import {
  deleteEvidenceFile,
  MAX_EVIDENCE_BYTES,
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

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_EVIDENCE_BYTES + 64_000) {
    return Response.json(
      { error: "Ukuran file evidence maksimal 10 MB." },
      { status: 413 },
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

    const key = { iapId, stepNo };
    const item = (await readItems()).find(
      (candidate) =>
        candidate.iapId === key.iapId && candidate.stepNo === key.stepNo,
    );
    if (!item) {
      return Response.json(
        { error: `Item ${key.iapId} langkah ${key.stepNo} tidak ditemukan.` },
        { status: 404 },
      );
    }

    const uploaded = await uploadEvidenceFile(file, key, {
      station: item.station,
      date: item.targetDate || todayInJakarta(),
    });
    const saved = await updateEvidenceLink(key, uploaded.webViewLink);
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
    return Response.json({ url: uploaded.webViewLink, name: file.name });
  } catch (error) {
    console.error("Evidence upload failed", error);
    return Response.json(
      { error: `Gagal mengunggah evidence: ${messageOf(error)}` },
      { status: 500 },
    );
  }
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
