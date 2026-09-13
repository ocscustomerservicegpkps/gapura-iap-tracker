/**
 * The registration dropdown's options, and the rule that decides which tracker
 * rows a branch user may see.
 *
 * Codes are IATA station codes for Indonesian commercial airports. `PUSAT` is not
 * an airport: it is the head office (Kantor Pusat / KPS), and it is the one value
 * that is not restricted to a single station.
 */

export const PUSAT = "PUSAT";

export interface Branch {
  /** IATA code, or `PUSAT`. Stored on the profile. */
  code: string;
  /** City or airport the code belongs to, shown next to it in the dropdown. */
  city: string;
}

export interface BranchGroup {
  /** Hub the stations report to (`HUB 1`…`HUB 5`), or `Kantor Pusat`. */
  region: string;
  branches: readonly Branch[];
}

/**
 * Grouped by hub, the way the operation is organised: every station reports to one
 * of the five hubs, so that is what the `<select>`'s `<optgroup>` labels are.
 */
export const BRANCH_GROUPS: readonly BranchGroup[] = [
  {
    region: "Kantor Pusat",
    branches: [{ code: PUSAT, city: "Kantor Pusat (KPS), seluruh cabang" }],
  },
  {
    region: "HUB 1",
    branches: [
      { code: "CGK", city: "Jakarta — Soekarno-Hatta" },
      { code: "KJT", city: "Majalengka — Kertajati" },
      { code: "BDO", city: "Bandung — Husein Sastranegara" },
      { code: "HLP", city: "Jakarta — Halim Perdanakusuma" },
    ],
  },
  {
    region: "HUB 2",
    branches: [
      { code: "SUB", city: "Surabaya — Juanda" },
      { code: "JOG", city: "Yogyakarta — Adisutjipto" },
      { code: "YIA", city: "Yogyakarta — Internasional (Kulon Progo)" },
      { code: "SOC", city: "Surakarta — Adi Soemarmo" },
      { code: "SRG", city: "Semarang — Ahmad Yani" },
      { code: "BWX", city: "Banyuwangi" },
      { code: "DHX", city: "Kediri — Dhoho" },
    ],
  },
  {
    region: "HUB 3",
    branches: [
      { code: "DPS", city: "Denpasar — I Gusti Ngurah Rai" },
      { code: "BPN", city: "Balikpapan — Sultan Aji Muhammad Sulaiman" },
      { code: "BDJ", city: "Banjarmasin — Syamsudin Noor" },
      { code: "PNK", city: "Pontianak — Supadio" },
      { code: "LOP", city: "Lombok — Zainuddin Abdul Madjid" },
      { code: "KOE", city: "Kupang — El Tari" },
      { code: "LBI", city: "Labuan Bajo — Komodo" },
      { code: "AAP", city: "Samarinda — APT Pranoto" },
    ],
  },
  {
    region: "HUB 4",
    branches: [
      { code: "UPG", city: "Makassar — Sultan Hasanuddin" },
      { code: "MDC", city: "Manado — Sam Ratulangi" },
      { code: "AMQ", city: "Ambon — Pattimura" },
      { code: "DJJ", city: "Jayapura — Sentani" },
      { code: "BIK", city: "Biak — Frans Kaisiepo" },
      { code: "MKW", city: "Manokwari — Rendani" },
      { code: "MKQ", city: "Merauke — Mopah" },
    ],
  },
  {
    region: "HUB 5",
    branches: [
      { code: "KNO", city: "Medan — Kualanamu" },
      { code: "BTJ", city: "Banda Aceh — Sultan Iskandar Muda" },
      { code: "PDG", city: "Padang — Minangkabau" },
      { code: "PKU", city: "Pekanbaru — Sultan Syarif Kasim II" },
      { code: "BTH", city: "Batam — Hang Nadim" },
      { code: "PLM", city: "Palembang — Sultan Mahmud Badaruddin II" },
      { code: "DJB", city: "Jambi — Sultan Thaha" },
      { code: "TJQ", city: "Tanjung Pandan — H.A.S. Hanandjoeddin" },
      { code: "TNJ", city: "Tanjung Pinang — Raja Haji Fisabilillah" },
      { code: "BKS", city: "Bengkulu — Fatmawati Soekarno" },
      { code: "PGK", city: "Pangkal Pinang — Depati Amir" },
      { code: "DTB", city: "Siborong-Borong — Silangit" },
      { code: "TKG", city: "Bandar Lampung — Radin Inten II" },
    ],
  },
] as const;

export const BRANCHES: readonly Branch[] = BRANCH_GROUPS.flatMap(
  (group) => group.branches,
);

const BY_CODE = new Map(BRANCHES.map((branch) => [branch.code, branch]));

export function isBranchCode(code: string): boolean {
  return BY_CODE.has(code);
}

export function branchLabel(code: string): string {
  const branch = BY_CODE.get(code);
  return branch ? `${branch.code} — ${branch.city}` : code;
}

/**
 * City and airport names that identify a station when the sheet spells them out
 * instead of using the code — "Stasiun CGK & Surabaya" has to resolve to SUB too.
 *
 * Short names are dropped: a three- or four-letter word like "Moa" or "Kao" matches
 * unrelated prose far too easily, and those stations are always written as codes.
 */
const NAME_CANDIDATES: ReadonlyArray<readonly [string, string]> = BRANCHES.filter(
  (branch) => branch.code !== PUSAT,
).flatMap((branch) =>
  branch.city
    .split(/[\u2014/(),]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 5)
    .map((part) => [part.toLowerCase(), branch.code] as const),
);

// Ambiguous city names (e.g. Jakarta) cannot grant access to two airports.
const NAME_TO_CODE = NAME_CANDIDATES.filter(([name, code]) =>
  !NAME_CANDIDATES.some(([otherName, otherCode]) => name === otherName && code !== otherCode),
);

const CODE_PATTERN = /\b[A-Z]{3}\b/g;

/**
 * Every branch a tracker row belongs to, read out of its free-text
 * `Stasiun / Pihak Terkait` cell. A row naming two stations belongs to both, which
 * is why this returns a list rather than a single code.
 *
 * ponytail: derived from the text rather than stored, so no sheet migration and no
 * backfill. If a station ever has to be recorded that the text does not name — or
 * the prose starts producing wrong matches — add an explicit `Cabang` column to the
 * Tracker tab and read that instead.
 */
export function branchesOf(station: string): string[] {
  const found = new Set<string>();

  for (const match of station.toUpperCase().matchAll(CODE_PATTERN)) {
    if (BY_CODE.has(match[0])) found.add(match[0]);
  }

  const haystack = station.toLowerCase();
  for (const [name, code] of NAME_TO_CODE) {
    if (haystack.includes(name)) found.add(code);
  }

  return [...found];
}

/** Whether a user at `branchCode` may see a row whose station cell reads `station`. */
export function canSeeStation(branchCode: string, station: string): boolean {
  if (branchCode === PUSAT) return true;
  return branchesOf(station).includes(branchCode);
}
