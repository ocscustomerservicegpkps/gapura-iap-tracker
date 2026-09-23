import { EVIDENCE_FILE_TOO_LARGE_MESSAGE } from "@/domain/evidence-file";

/** Infrastructure errors can be plain text even though app responses are JSON. */
export async function readUploadResponse<T>(response: Response): Promise<T> {
  const body = await response.text();
  try {
    return JSON.parse(body) as T;
  } catch {
    if (
      response.status === 413 ||
      /request entity too large|payload too large|function_payload_too_large/i.test(body)
    ) {
      throw new Error(EVIDENCE_FILE_TOO_LARGE_MESSAGE);
    }
    throw new Error(
      response.ok
        ? "Respons server upload tidak valid. Silakan coba lagi."
        : "Server tidak dapat memproses upload evidence. Silakan coba lagi atau hubungi admin.",
    );
  }
}
