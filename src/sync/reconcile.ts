import type { DbRow } from "../supabase/database";
export type Cells = (string | number)[];
export const TRACKER_HEADERS = ["No","ID IAP","Judul IAP / Kasus","Stasiun / Pihak Terkait",
 "No Langkah","Langkah Perbaikan","Detail Tindakan","PIC (Pemilik)","Linimasa (Target)",
 "Tanggal Target","Status","% Progres","Tanggal Selesai Aktual","Status Terlambat",
 "Bukti / Catatan","Konteks","Link Evidence","Kasus / Insiden","Pihak Terkait",
 "Tujuan Dokumen","Tanggal Efektif","Latar Belakang & Analisis Akar Masalah",
 "Parameter Keberhasilan (KPI)"];
export type Change = { iapId: string; stepNo: number; version: number | null; cells: Cells | null };
export type Conflict = { iapId: string; stepNo: number; column: string;
  baseline: unknown; sheet: unknown; database: unknown };
const names = ["no","iap_id","title","station","step_no","step","action","pic","timeline","target_date","status","progress","actual_date","stored_overdue","evidence","context_note","evidence_link","incident","parties","purpose","effective_date","root_cause","kpis"];
export const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export const keyOf = (cells: Cells) => JSON.stringify([String(cells[1]).trim(), Number(cells[4])]);
export function normalize(cells: readonly unknown[]): Cells {
  const row: Cells = Array.from({ length: 23 }, (_, i) => String(cells[i] ?? ""));
  for (const i of [0, 4, 11]) {
    const raw = row[i];
    const number = Number(raw);
    if (!Number.isInteger(number)) throw new Error(`Angka tidak valid di kolom ${names[i]}`);
    row[i] = number;
  }
  row[1] = String(row[1]).trim();
  if (!row[1] || Number(row[4]) < 1 || Number(row[11]) < 0 || Number(row[11]) > 100)
    throw new Error("ID, nomor langkah, atau progres Google Sheets tidak valid.");
  if (!["Belum Dimulai", "Sedang Berjalan", "Selesai"].includes(String(row[10])))
    throw new Error("Status Google Sheets tidak valid.");
  return row;
}
export function indexRows(rows: Cells[]): Map<string, Cells> {
  const index = new Map<string, Cells>();
  for (const row of rows) {
    const key = keyOf(row);
    if (index.has(key)) throw new Error(`Duplikat ID IAP / No Langkah: ${key}`);
    index.set(key, row);
  }
  return index;
}
export function reconcile(baseline: Cells[], sheet: Cells[], database: DbRow[]) {
  const base = indexRows(baseline), sheets = indexRows(sheet);
  const db = new Map(database.map(row => [keyOf(row.cells), row]));
  const changes: Change[] = [], conflicts: Conflict[] = [];
  for (const key of new Set([...base.keys(), ...sheets.keys(), ...db.keys()])) {
    const b = base.get(key), s = sheets.get(key), d = db.get(key);
    let merged: Cells | undefined;
    if (equal(s, b)) merged = d?.cells;
    else if (equal(d?.cells, b)) merged = s;
    else if (equal(s, d?.cells)) merged = s;
    else if (!s || !d) {
      merged = d?.cells;
      conflicts.push({ iapId: String((d?.cells ?? s ?? b)![1]),
        stepNo: Number((d?.cells ?? s ?? b)![4]), column: "__row__",
        baseline: b ?? null, sheet: s ?? null, database: d?.cells ?? null });
    } else {
      merged = [...d.cells];
      for (let i = 0; i < 23; i++) {
        if (i === 1 || i === 4) continue;
        if (equal(s[i], b?.[i])) continue;
        if (equal(d.cells[i], b?.[i]) || equal(s[i], d.cells[i])) merged[i] = s[i]!;
        else conflicts.push({ iapId: String(d.cells[1]), stepNo: Number(d.cells[4]),
          column: names[i]!, baseline: b?.[i] ?? null, sheet: s[i], database: d.cells[i] });
      }
    }
    if (!equal(merged, d?.cells)) {
      const identity = merged ?? d!.cells;
      changes.push({ iapId: String(identity[1]), stepNo: Number(identity[4]),
        version: d?.version ?? null, cells: merged ?? null });
    }
  }
  return { changes, conflicts };
}
