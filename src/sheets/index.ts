import "server-only";

import contextFixture from "@/fixtures/context-fixture.json";
import fixture from "@/fixtures/tracker-fixture.json";
import type { CellValue } from "@/domain/rows";
import { CONTEXT_TAB, googleCredentials, TRACKER_TAB } from "./config";
import { GoogleSheetsTransport } from "./google-transport";
import { MemorySheetsTransport } from "./memory-transport";
import type { SheetsTransport } from "./transport";

/** The 66-row snapshot the offline transport starts from, header row included. */
export const TRACKER_FIXTURE = fixture as CellValue[][];

/** The nine documented cases' context, header row included. */
export const CONTEXT_FIXTURE = contextFixture as CellValue[][];

const OFFLINE_SHEET = {
  [TRACKER_TAB]: TRACKER_FIXTURE,
  [CONTEXT_TAB]: CONTEXT_FIXTURE,
};

type TransportKind = "google" | "memory";

export function transportKind(): TransportKind {
  const configured = process.env.SHEETS_TRANSPORT?.trim().toLowerCase();
  if (configured === "memory") return "memory";
  if (configured === "google") return "google";
  return process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? "google" : "memory";
}

export function isMemoryTransport(): boolean {
  return transportKind() === "memory";
}

// Held on globalThis so the fake's contents survive dev-server hot reloads.
const store = globalThis as typeof globalThis & {
  __iapTransport?: SheetsTransport;
};

function buildTransport(): SheetsTransport {
  return transportKind() === "memory"
    ? new MemorySheetsTransport(OFFLINE_SHEET)
    : new GoogleSheetsTransport(googleCredentials());
}

export function getTransport(): SheetsTransport {
  store.__iapTransport ??= buildTransport();
  return store.__iapTransport;
}

/** Restore the offline sheet to the 66-row fixture. Only valid for the fake. */
export function resetMemoryTransport(): void {
  memoryTransport().reset(OFFLINE_SHEET);
}

/** The offline sheet's raw grid, so tests can assert on stored cells. */
export function memorySnapshot(tab = TRACKER_TAB): string[][] {
  return memoryTransport().snapshot(tab);
}

function memoryTransport(): MemorySheetsTransport {
  const transport = getTransport();
  if (!(transport instanceof MemorySheetsTransport)) {
    throw new Error("This operation requires SHEETS_TRANSPORT=memory");
  }
  return transport;
}

export { CONTEXT_TAB, DASHBOARD_TAB, TRACKER_TAB } from "./config";
export type { SheetsTransport } from "./transport";
