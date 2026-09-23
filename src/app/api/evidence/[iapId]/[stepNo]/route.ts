import { sameOrigin } from "@/lib/security";
import { limitedFormData, UploadBodyTooLarge } from "@/lib/upload-body";
import { matchesEvidenceSignature } from "@/domain/evidence-file";
import { MAX_EVIDENCE_BYTES } from "@/drive/evidence";
import { revalidatePath } from "next/cache";
import {
  readItems,
  appendEvidenceLinks,
} from "@/data/tracker-repository";
import { todayInJakarta } from "@/domain/dates";
import {
  deleteEvidenceFile,
  evidenceUploadStatus,
  type EvidenceKind,
  uploadEvidenceFile,
  validateEvidenceFile,
} from "@/drive/evidence";
import { canAccessCase } from "@/lib/case-access";
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

  // The env vars belong to whoever runs the server, not to the person attaching a
  // document, so the reply says what they can do about it and the detail goes to
  // the server log where an operator will find it.
  const driveStatus = evidenceUploadStatus();
  if (!driveStatus.ready) {
    console.error(
      `Evidence upload is not configured on this deployment. Missing: ${driveStatus.missing.join(", ")}`,
    );
    return Response.json(
      {
        error:
          "Upload file belum aktif di server ini karena koneksi Google Drive belum dikonfigurasi. Gunakan pilihan Link Evidence untuk sementara, dan minta admin melengkapi konfigurasi Google Drive.",
      },
      { status: 503 },
    );
  }

  const { iapId, stepNo: rawStepNo } = await params;
  const stepNo = Number(rawStepNo);
  if (!iapId.trim() || !Number.isInteger(stepNo) || stepNo < 1) {
    return Response.json({ error: "Identitas item evidence tidak valid." }, { status: 400 });
  }
  // Uploading writes a link into the case's rows, so it needs the same branch check
  // the editing dialog behind it went through.
  // Read at most once: by the access check for a branch user, or below otherwise.
  let read: ReturnType<typeof readItems> | undefined;
  const trackerItems = () => (read ??= readItems());
  if (!(await canAccessCase(iapId, trackerItems))) {
    return Response.json(
      { error: "Anda tidak memiliki akses ke kasus ini." },
      { status: 403 },
    );
  }

  try {
    const form = await limitedFormData(request, MAX_EVIDENCE_BYTES + 128 * 1024);
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

    const extension = file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase();
    // Read the body once. The signature check and the Drive upload both need the
    // bytes, and a second `arrayBuffer()` would hold a second copy of a 4 MB file.
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!matchesEvidenceSignature(new Uint8Array(bytes), extension)) {
      return Response.json({ error: "Isi file tidak sesuai dengan format evidence." }, { status: 400 });
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
    const items = await trackerItems();
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
    const uploaded = await uploadEvidenceFile(
      file,
      primaryKey,
      {
        station: primaryItem.station,
        date: primaryItem.targetDate || todayInJakarta(),
      },
      bytes,
    );
    const saved = await appendEvidenceLinks(keys, uploaded.webViewLink);
    if (!saved.ok) {
      // A reused file belongs to an earlier upload that already succeeded and is
      // linked from a row; deleting it here would break that row's evidence.
      if (!uploaded.reused) {
        try {
          await deleteEvidenceFile(uploaded.fileId);
        } catch (rollbackError) {
          // The ID is the only way an operator can find and remove the orphan.
          console.error(
            `Failed to roll back orphaned evidence file ${uploaded.fileId}`,
            rollbackError,
          );
        }
      }
      return Response.json(
        { error: Object.values(saved.errors)[0] ?? "Gagal menyimpan link evidence." },
        { status: 404 },
      );
    }

    revalidatePath("/");
    return Response.json({
      url: uploaded.webViewLink,
      name: file.name,
      stepNos: requestedStepNos,
    });
  } catch (error) {
    if (error instanceof UploadBodyTooLarge) {
      return Response.json({ error: "Ukuran upload terlalu besar. Maksimal file 4 MB." }, { status: 413 });
    }
    console.error("Evidence upload failed");
    return Response.json(
      { error: "Gagal mengunggah evidence. Silakan coba lagi atau hubungi admin." },
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
