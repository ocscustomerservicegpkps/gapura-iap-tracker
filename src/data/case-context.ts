import "server-only";
import { cache } from "react";
import { database, databaseKind } from "@/supabase/database";
import { emptyContext, rowToContext, hasContext, type CaseContext } from "@/domain/context";
import { todayInJakarta } from "@/domain/dates";
import { readDatabaseRows } from "./tracker-repository";
import * as offline from "./sheet-case-context";

export const readContexts = cache(async (): Promise<Record<string, CaseContext>> => {
  if (databaseKind() === "memory") return offline.readContexts();
  const result: Record<string, CaseContext> = {};
  for (const { cells } of await readDatabaseRows()) {
    const context = rowToContext([cells[1], ...cells.slice(17, 23)]);
    if (hasContext(context)) result[context.iapId] = context;
  }
  return result;
});
export async function saveContext(context: CaseContext): Promise<void> {
  if (databaseKind() === "memory") return offline.saveContext(context);
  await database().rpc("iap_mutate", { p_operation: "context",
    p_payload: { iapId: context.iapId, context }, p_today: todayInJakarta() });
}
export async function deleteContext(iapId: string): Promise<void> {
  if (databaseKind() === "memory") return offline.deleteContext(iapId);
  await saveContext(emptyContext(iapId));
}
