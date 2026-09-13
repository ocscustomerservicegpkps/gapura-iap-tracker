/**
 * Self-check for the station-text parsing in `src/domain/branches.ts`, run against
 * the exact `Stasiun / Pihak Terkait` strings the live Tracker tab holds today.
 *
 * Run with `npm run check:branches`. If a station cell later stops resolving, this
 * is what tells you before a branch user silently loses rows.
 */
import assert from "node:assert/strict";
import { branchesOf, canSeeStation, PUSAT } from "../src/domain/branches";

const LIVE_STATIONS: ReadonlyArray<readonly [string, string[]]> = [
  ["Hainan Airlines (HU) - Stasiun CGK", ["CGK"]],
  ["Garuda Indonesia (GA) - Stasiun YIA & DPS", ["YIA", "DPS"]],
  ["Scoot - Stasiun CGK & KNO", ["CGK", "KNO"]],
  // TIM (Timika) is not one of the hub branches, so only MDC and Lombok resolve.
  ["PT Airfast Indonesia - Stasiun MDC/TIM & Lombok", ["MDC", "LOP"]],
  ["PT Gapura Angkasa - Stasiun CGK", ["CGK"]],
  ["Garuda Indonesia - Stasiun BTH (Hang Nadim, Batam)", ["BTH"]],
  ["Garuda Indonesia - Stasiun KNO (Kualanamu)", ["KNO"]],
  [
    "PT Gapura Angkasa - Stasiun CGK & Surabaya / China Southern Airlines (CZ)",
    ["CGK", "SUB"],
  ],
  ["CGK", ["CGK"]],
  ["DPS", ["DPS"]],
  ["PT Gapura Angkasa – Stasiun CGK / China Southern Airlines (CZ)", ["CGK"]],
  ["PT Pelita Air Service - Stasiun SUB (SUB-CGK)", ["SUB", "CGK"]],
  ["PT Gapura Angkasa Stasiun CGK / PT Pelita Air Service", ["CGK"]],
];

for (const [station, expected] of LIVE_STATIONS) {
  const actual = branchesOf(station).sort();
  assert.deepEqual(
    actual,
    [...expected].sort(),
    `${station}\n  expected ${expected.join(",")}\n  got      ${actual.join(",")}`,
  );
}

// Head office is never restricted, including on a cell nothing else resolves.
assert.equal(canSeeStation(PUSAT, "keterangan tanpa stasiun"), true);
assert.equal(canSeeStation("CGK", "Scoot - Stasiun CGK & KNO"), true);
assert.equal(canSeeStation("DPS", "Scoot - Stasiun CGK & KNO"), false);
// A row whose station cannot be resolved stays hidden from branch users.
assert.equal(canSeeStation("CGK", "keterangan tanpa stasiun"), false);

console.log(`OK — ${LIVE_STATIONS.length} live station strings resolve as expected.`);
