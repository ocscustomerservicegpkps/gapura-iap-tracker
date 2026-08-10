import { google, type sheets_v4 } from "googleapis";
import type { CellValue } from "@/domain/rows";
import {
  contiguousRunsDescending,
  type RangeUpdate,
  type SheetsTransport,
} from "./transport";

export interface GoogleTransportConfig {
  spreadsheetId: string;
  clientEmail: string;
  privateKey: string;
}

/**
 * The real thing. Dates are read and written as text, and values are written with
 * `RAW` so `14 Okt 2026` is never quietly reinterpreted as a date value by the
 * spreadsheet's own (US) locale.
 */
export class GoogleSheetsTransport implements SheetsTransport {
  private readonly api: sheets_v4.Sheets;
  private readonly spreadsheetId: string;
  private tabIds: Promise<Map<string, number>> | null = null;

  constructor(config: GoogleTransportConfig) {
    this.spreadsheetId = config.spreadsheetId;
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: config.clientEmail,
        // Env vars carry the newlines escaped.
        private_key: config.privateKey.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    this.api = google.sheets({ version: "v4", auth });
  }

  async readRange(range: string): Promise<string[][]> {
    const response = await this.api.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range,
      valueRenderOption: "FORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });
    const values = response.data.values ?? [];
    return values.map((row) =>
      (row as unknown[]).map((cell) =>
        cell === null || cell === undefined ? "" : String(cell),
      ),
    );
  }

  async writeRanges(updates: readonly RangeUpdate[]): Promise<void> {
    if (updates.length === 0) return;
    await this.api.spreadsheets.values.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: updates.map((update) => ({
          range: update.range,
          values: update.values,
        })),
      },
    });
  }

  async appendRows(
    tab: string,
    values: readonly (readonly CellValue[])[],
  ): Promise<void> {
    if (values.length === 0) return;
    await this.api.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${tab}!A:O`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: values.map((row) => [...row]) },
    });
  }

  async deleteRows(tab: string, rowNumbers: readonly number[]): Promise<void> {
    if (rowNumbers.length === 0) return;
    const sheetId = await this.resolveTabId(tab);
    await this.api.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: contiguousRunsDescending(rowNumbers).map(({ start, end }) => ({
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: start - 1,
              endIndex: end,
            },
          },
        })),
      },
    });
  }

  /**
   * Write cells that must be evaluated rather than stored literally.
   *
   * Deliberately absent from {@link SheetsTransport}: only the one-off maintenance
   * scripts write formulas, and the application must never be able to. Everything
   * the app writes goes through `writeRanges` with RAW so `14 Okt 2026` survives as
   * text.
   */
  async writeFormulas(updates: readonly RangeUpdate[]): Promise<void> {
    if (updates.length === 0) return;
    await this.api.spreadsheets.values.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: updates.map((update) => ({
          range: update.range,
          values: update.values,
        })),
      },
    });
  }

  /** Script-only, for the same reason as {@link writeFormulas}. */
  async clearRange(range: string): Promise<void> {
    await this.api.spreadsheets.values.clear({
      spreadsheetId: this.spreadsheetId,
      range,
      requestBody: {},
    });
  }

  private async resolveTabId(tab: string): Promise<number> {
    this.tabIds ??= this.api.spreadsheets
      .get({ spreadsheetId: this.spreadsheetId, fields: "sheets.properties" })
      .then(
        (response) =>
          new Map(
            (response.data.sheets ?? []).map((sheet) => [
              sheet.properties?.title ?? "",
              sheet.properties?.sheetId ?? 0,
            ]),
          ),
      );

    const id = (await this.tabIds).get(tab);
    if (id === undefined) {
      this.tabIds = null;
      throw new Error(`Tab "${tab}" not found in spreadsheet ${this.spreadsheetId}`);
    }
    return id;
  }
}
