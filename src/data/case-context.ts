import "server-only";
import { cache } from "react";
import { database, databaseKind } from "@/supabase/database";
import { contextsFromCells, emptyContext, type CaseContext } from "@/domain/context";
import { todayInJakarta } from "@/domain/dates";
import { readDatabaseRows } from "./tracker-repository";
import * as offline from "./sheet-case-context";

export const readContexts = cache(async (): Promise<Record<string, CaseContext>> => {
  if (databaseKind() === "memory") return offline.readContexts();
  return contextsFromCells((await readDatabaseRows()).map((row) => row.cells));
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
