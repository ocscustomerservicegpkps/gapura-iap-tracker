"use server";

import { revalidatePath } from "next/cache";
import { saveContext } from "@/data/case-context";
import { databaseKind } from "@/supabase/database";
import { canAccessCase, canAccessStation } from "@/lib/case-access";
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
 * database reads themselves are not cached across requests. Every mutation goes
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
    console.error("Database mutation failed");
    return {
      ok: false,
      errors: {
        form: "Gagal menyimpan data. Silakan coba lagi atau hubungi admin.",
      } satisfies FieldErrors,
    };
  }
}

const FORBIDDEN: MutationResult = {
  ok: false,
  errors: { form: "Anda tidak memiliki akses ke kasus ini." },
};

/**
 * Refuse the mutation unless the caller's branch covers this case.
 *
 * Every action below starts here. A server action is a public endpoint, so the
 * dashboard having hidden a row is not what keeps it from being edited — this is.
 */
async function guardCase(iapId: string): Promise<MutationResult | null> {
  if (typeof iapId !== "string" || !iapId.trim() || iapId.length > 100) return FORBIDDEN;
  return (await canAccessCase(iapId)) ? null : FORBIDDEN;
}

export async function saveItemAction(
  key: ItemKey,
  raw: Record<string, unknown>,
): Promise<MutationResult> {
  if (!key || typeof key.iapId !== "string" || !Number.isSafeInteger(key.stepNo) || key.stepNo < 1) return FORBIDDEN;
  const denied = await guardCase(key.iapId);
  if (denied) return denied;
  const parsed = validateStepInput(raw);
  if (!parsed.ok) return parsed;
  return run(() => updateStep(key, parsed.value));
}

export async function createItemAction(
  iapId: string,
  raw: Record<string, unknown>,
): Promise<MutationResult> {
  const denied = await guardCase(iapId);
  if (denied) return denied;
  const parsed = validateStepInput(raw);
  if (!parsed.ok) return parsed;
  return run(() => createStep(iapId, parsed.value));
}

export async function deleteItemAction(key: ItemKey): Promise<MutationResult> {
  if (!key || typeof key.iapId !== "string" || !Number.isSafeInteger(key.stepNo) || key.stepNo < 1) return FORBIDDEN;
  const denied = await guardCase(key.iapId);
  if (denied) return denied;
  return run(() => deleteStep(key));
}

/**
 * Supabase stores case rows and context atomically; offline fixtures use their original path.
 */
export async function createCaseAction(
  raw: Record<string, unknown>,
): Promise<MutationResult> {
  const parsed = validateCaseInput(raw);
  if (!parsed.ok) return parsed;
  // The case does not exist yet, so there are no rows to check against: the station
  // typed into the form is what decides whether this user may file it.
  if (!(await canAccessStation(parsed.value.station))) {
    return {
      ok: false,
      errors: { station: "Anda hanya dapat membuat kasus untuk cabang Anda sendiri." },
    };
  }
  return run(async () => {
    const created = await createCase(parsed.value);
    if (!created.ok) return created;
    if (databaseKind() === "memory") await saveContext(parsed.value.context);
    return created;
  });
}

export async function updateCaseAction(
  raw: Record<string, unknown>,
): Promise<MutationResult> {
  const parsed = validateCaseMetaInput(raw);
  if (!parsed.ok) return parsed;
  const { iapId, title, station, context } = parsed.value;
  const denied = await guardCase(iapId);
  if (denied) return denied;
  // Restationing a case out of your own branch would be a way to hand it away, or
  // to grab one; the destination has to be yours too.
  if (!(await canAccessStation(station))) {
    return {
      ok: false,
      errors: { station: "Anda hanya dapat memindahkan kasus ke cabang Anda sendiri." },
    };
  }
  return run(async () => {
    const updated = await updateCaseMeta(iapId, title, station, context);
    if (!updated.ok) return updated;
    if (databaseKind() === "memory") await saveContext(context);
    return updated;
  });
}

export async function deleteCaseAction(iapId: string): Promise<MutationResult> {
  const denied = await guardCase(iapId);
  if (denied) return denied;
  return run(() => deleteCase(iapId));
}

export async function appendCaseEvidenceAction(
  iapId: string,
  stepNumbers: readonly number[],
  evidenceLink: string,
): Promise<MutationResult> {
  if (typeof iapId !== "string" || !Array.isArray(stepNumbers) || stepNumbers.length > 100 || typeof evidenceLink !== "string" || evidenceLink.length > 20000) return FORBIDDEN;
  const cleanIapId = iapId.trim();
  const cleanSteps = [...new Set(stepNumbers)]
    .filter((step) => Number.isInteger(step) && step > 0)
    .map((stepNo) => ({ iapId: cleanIapId, stepNo }));
  if (!cleanIapId) return { ok: false, errors: { iapId: "ID IAP wajib diisi." } };
  const denied = await guardCase(cleanIapId);
  if (denied) return denied;
  return run(() => appendEvidenceLinks(cleanSteps, evidenceLink));
}
