"use server";

import { revalidatePath } from "next/cache";
import { saveContext } from "@/data/case-context";
import {
  createCase,
  createStep,
  appendEvidenceLinks,
  deleteCase,
  deleteStep,
  updateCaseMeta,
  updateStep,
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
 * Drops the rendered page so the author sees their own change straight away. The
 * sheet reads themselves are not cached across requests. Every mutation goes
 * through here; nothing else revalidates.
 */
function refresh(): void {
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
 * A case is stored entirely in Tracker. Action rows are created first, then their
 * context columns R–W are filled, so a failed row creation cannot leave orphan data.
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
  return run(() => deleteCase(iapId));
}

export async function appendCaseEvidenceAction(
  iapId: string,
  stepNumbers: readonly number[],
  evidenceLink: string,
): Promise<MutationResult> {
  const cleanIapId = String(iapId).trim();
  const cleanSteps = [...new Set(stepNumbers)]
    .filter((step) => Number.isInteger(step) && step > 0)
    .map((stepNo) => ({ iapId: cleanIapId, stepNo }));
  if (!cleanIapId) return { ok: false, errors: { iapId: "ID IAP wajib diisi." } };
  return run(() => appendEvidenceLinks(cleanSteps, evidenceLink));
}
