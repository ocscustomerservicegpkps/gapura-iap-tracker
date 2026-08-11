"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import {
  CONTEXT_TAG,
  deleteContext,
  saveContext,
} from "@/data/case-context";
import {
  createCase,
  createStep,
  deleteCase,
  deleteStep,
  updateCaseMeta,
  updateStep,
  TRACKER_TAG,
  type MutationResult,
} from "@/data/tracker-repository";
import type { ItemKey } from "@/domain/types";
import {
  validateCaseInput,
  validateCaseMetaInput,
  validateStepInput,
  type FieldErrors,
} from "@/domain/validate";

/**
 * Busts the read cache so the author sees their own change straight away. Every
 * mutation goes through here; nothing else revalidates.
 */
function refresh(): void {
  revalidateTag(TRACKER_TAG);
  revalidateTag(CONTEXT_TAG);
  revalidatePath("/");
}

async function run(
  mutate: () => Promise<MutationResult>,
): Promise<MutationResult> {
  try {
    const result = await mutate();
    if (result.ok) refresh();
    return result;
  } catch (error) {
    // A failed save must say so rather than let the user walk away believing it landed.
    console.error("Sheet mutation failed", error);
    return {
      ok: false,
      errors: {
        form: `Gagal menyimpan ke spreadsheet: ${messageOf(error)}`,
      } satisfies FieldErrors,
    };
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function saveItemAction(
  key: ItemKey,
  raw: Record<string, unknown>,
): Promise<MutationResult> {
  const parsed = validateStepInput(raw);
  if (!parsed.ok) return parsed;
  return run(() => updateStep(key, parsed.value));
}

export async function createItemAction(
  iapId: string,
  raw: Record<string, unknown>,
): Promise<MutationResult> {
  const parsed = validateStepInput(raw);
  if (!parsed.ok) return parsed;
  return run(() => createStep(iapId, parsed.value));
}

export async function deleteItemAction(key: ItemKey): Promise<MutationResult> {
  return run(() => deleteStep(key));
}

/**
 * A case is its tracker rows plus its context row. The tracker write goes first:
 * if it fails there is nothing to undo, and a context row for a case that does not
 * exist would be the harder mess to explain.
 */
export async function createCaseAction(
  raw: Record<string, unknown>,
): Promise<MutationResult> {
  const parsed = validateCaseInput(raw);
  if (!parsed.ok) return parsed;
  return run(async () => {
    const created = await createCase(parsed.value);
    if (!created.ok) return created;
    await saveContext(parsed.value.context);
    return created;
  });
}

export async function updateCaseAction(
  raw: Record<string, unknown>,
): Promise<MutationResult> {
  const parsed = validateCaseMetaInput(raw);
  if (!parsed.ok) return parsed;
  const { iapId, title, station, context } = parsed.value;
  return run(async () => {
    const updated = await updateCaseMeta(iapId, title, station);
    if (!updated.ok) return updated;
    await saveContext(context);
    return updated;
  });
}

export async function deleteCaseAction(iapId: string): Promise<MutationResult> {
  return run(async () => {
    const deleted = await deleteCase(iapId);
    if (!deleted.ok) return deleted;
    await deleteContext(iapId);
    return deleted;
  });
}
