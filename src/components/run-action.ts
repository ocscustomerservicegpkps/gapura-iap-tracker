import type { MutationResult } from "@/data/tracker-repository";
import type { FieldErrors } from "@/domain/validate";

/**
 * Run a Server Action and always come back with something to show.
 *
 * The action itself already turns spreadsheet failures into `{ ok: false }`, but the
 * call can still reject outright — the browser is offline, the deployment is down,
 * the response never arrives. Without this the promise rejects unhandled and the
 * modal just sits there, which is exactly the "walked away believing it saved" case
 * the tracker cannot afford.
 */
export async function runAction(
  action: () => Promise<MutationResult>,
): Promise<MutationResult> {
  try {
    return await action();
  } catch (error) {
    return {
      ok: false,
      errors: {
        form: `Gagal menghubungi server, perubahan belum tersimpan: ${
          error instanceof Error ? error.message : String(error)
        }`,
      } satisfies FieldErrors,
    };
  }
}
