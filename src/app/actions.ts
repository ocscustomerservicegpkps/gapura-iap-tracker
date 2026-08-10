"use server";

import { revalidatePath, revalidateTag } from "next/cache";
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

export async function createCaseAction(
  raw: Record<string, unknown>,
): Promise<MutationResult> {
  const parsed = validateCaseInput(raw);
  if (!parsed.ok) return parsed;
  return run(() => createCase(parsed.value));
}

export async function updateCaseAction(
  raw: Record<string, unknown>,
): Promise<MutationResult> {
  const parsed = validateCaseMetaInput(raw);
  if (!parsed.ok) return parsed;
  const { iapId, title, station } = parsed.value;
  return run(() => updateCaseMeta(iapId, title, station));
}

export async function deleteCaseAction(iapId: string): Promise<MutationResult> {
  return run(() => deleteCase(iapId));
}
