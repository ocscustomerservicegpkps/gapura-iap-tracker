import { crc32 } from "node:zlib";
import {
  DOCUMENT_TITLE,
  MATRIX_HEADINGS,
  SECTIONS,
  SIGNATURE,
  type IapDocument,
} from "./iap-document";

/**
 * A `.docx` written by hand: the format is a zip of five XML parts, and the reference
 * document's own formatting (Arial, the green heading, the bordered tables) sits on
 * the runs themselves, so nothing here needs a template file or a library.
 *
 * ponytail: entries are stored uncompressed — a page of XML is a few kilobytes either
 * way. Switch to `deflateRawSync` (method 8) if documents ever grow attachments.
 */
export function renderDocx(doc: IapDocument): Buffer {
  return zip([
    // Word wants the content types first in the archive.
    { name: "[Content_Types].xml", body: CONTENT_TYPES },
    { name: "_rels/.rels", body: ROOT_RELS },
    { name: "word/_rels/document.xml.rels", body: DOCUMENT_RELS },
    { name: "word/document.xml", body: documentXml(doc) },
    { name: "word/styles.xml", body: STYLES },
  ]);
}

export const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// ── the document ────────────────────────────────────────────────────────────

const GREEN = "0B5B31";
const BLUE = "0D4D8B";

function documentXml(doc: IapDocument): string {
  const body = [
    para(DOCUMENT_TITLE, {
      style: "Heading1",
      align: "center",
      after: 60,
      bold: true,
      color: GREEN,
    }),
    para(doc.subtitle, {
      align: "center",
      after: 240,
      italic: true,
      color: "444444",
      size: 22,
    }),
    doc.header.length ? headerTable(doc) : "",
    heading(SECTIONS.background),
    ...doc.background.map((text) =>
      para(text, { after: 140, align: "both", size: 20 }),
    ),
    heading(SECTIONS.matrix),
    matrixTable(doc),
    heading(SECTIONS.kpi),
    // ponytail: literal bullet with a hanging indent, so the file needs no
    // numbering.xml. Swap for a real w:numPr list if anyone edits these in Word.
    ...doc.kpis.map((kpi) =>
      para(`• ${kpi}`, { after: 60, size: 19, hanging: true }),
    ),
    heading(SECTIONS.closing),
    para(doc.closing, { after: 140, align: "both", size: 20 }),
    para("", { after: 140 }),
    para(SIGNATURE.intro, { after: 140 }),
    para("", { after: 140 }),
    para("", { after: 140 }),
    para(SIGNATURE.name, { after: 0 }),
    para(SIGNATURE.company, { after: 0, bold: true }),
  ].join("");

  return `${XML_DECLARATION}<w:document xmlns:w="${W_NS}"><w:body>${body}${SECT_PR}</w:body></w:document>`;
}

function heading(text: string): string {
  return para(text, {
    style: "Heading2",
    before: 260,
    after: 120,
    bold: true,
    color: BLUE,
    size: 25,
  });
}

/** Kasus / Insiden, Pihak Terkait, … — label column shaded, as in the reference. */
function headerTable(doc: IapDocument): string {
  const rows = doc.header.map(({ label, value }) =>
    tableRow([
      cell([para(label, { bold: true, size: 20 })], 1250, "EAF7EE"),
      cell([para(value, { size: 20 })], 3750),
    ]),
  );
  return table([2474, 7422], rows);
}

function matrixTable(doc: IapDocument): string {
  // Twips across the reference's text width. The step column is wider than the
  // reference's, which was sized for that document's short step names.
  const grid = [500, 1600, 3500, 1100, 1000, 1700];
  const widths = pctWidths(grid);

  const head = tableRow(
    MATRIX_HEADINGS.map((text, i) =>
      cell(
        [
          para(text, {
            bold: true,
            size: 19,
            color: "FFFFFF",
            align: i === 0 || i >= 3 ? "center" : undefined,
          }),
        ],
        widths[i]!,
        GREEN,
      ),
    ),
    { header: true },
  );

  const rows = doc.matrix.map((row) =>
    tableRow([
      cell([para(String(row.no), { size: 19, align: "center" })], widths[0]!),
      cell([para(row.step, { size: 19, bold: true })], widths[1]!),
      cell(
        row.details.map((detail, i) =>
          para(detail, { size: 19, after: i < row.details.length - 1 ? 60 : 0 }),
        ),
        widths[2]!,
      ),
      cell([para(row.timeline, { size: 19, align: "center" })], widths[3]!),
      cell([para(row.status, { size: 18, align: "center" })], widths[4]!),
      cell([para(row.pic, { size: 19, align: "center" })], widths[5]!),
    ]),
  );

  return table(grid, [head, ...rows]);
}

/** Grid columns as fiftieths of a percent, the unit `w:tcW type="pct"` counts in. */
function pctWidths(grid: readonly number[]): number[] {
  const total = grid.reduce((sum, w) => sum + w, 0);
  return grid.map((w) => Math.round((w / total) * 5000));
}

// ── OOXML primitives ────────────────────────────────────────────────────────

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const XML_DECLARATION =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const ARIAL = '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>';

/** A4 with the reference document's margins. */
const SECT_PR =
  '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
  '<w:pgMar w:top="900" w:right="1000" w:bottom="900" w:left="1000" w:header="708" w:footer="708" w:gutter="0"/>' +
  "</w:sectPr>";

interface TextStyle {
  bold?: boolean;
  italic?: boolean;
  /** Half-points, matching `w:sz` — 20 is 10pt. */
  size?: number;
  color?: string;
}

interface ParagraphStyle extends TextStyle {
  style?: "Heading1" | "Heading2";
  align?: "center" | "both";
  before?: number;
  after?: number;
  hanging?: boolean;
}

/**
 * Sheet cells arrive as arbitrary text. Beyond the three markup characters, the C0
 * control range is not representable in XML 1.0 at all and would make Word reject the
 * file outright, so it is dropped rather than escaped.
 */
function escapeXml(text: string): string {
  return text
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function runProps(style: TextStyle): string {
  return (
    ARIAL +
    (style.bold ? "<w:b/><w:bCs/>" : "") +
    (style.italic ? "<w:i/><w:iCs/>" : "") +
    (style.color ? `<w:color w:val="${style.color}"/>` : "") +
    (style.size ? `<w:sz w:val="${style.size}"/><w:szCs w:val="${style.size}"/>` : "")
  );
}

/** Child order inside `w:pPr` is fixed by the schema: pStyle, spacing, ind, jc, rPr. */
function para(text: string, style: ParagraphStyle = {}): string {
  const pPr =
    (style.style ? `<w:pStyle w:val="${style.style}"/>` : "") +
    `<w:spacing${style.before ? ` w:before="${style.before}"` : ""} w:after="${style.after ?? 0}"/>` +
    (style.hanging ? '<w:ind w:left="360" w:hanging="180"/>' : "") +
    (style.align ? `<w:jc w:val="${style.align}"/>` : "") +
    `<w:rPr>${runProps(style)}</w:rPr>`;
  const run = text
    ? `<w:r><w:rPr>${runProps(style)}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`
    : "";
  return `<w:p><w:pPr>${pPr}</w:pPr>${run}</w:p>`;
}

const CELL_BORDERS = ["top", "left", "bottom", "right"]
  .map((side) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>`)
  .join("");

/** Word requires at least one paragraph per cell, so an empty cell still gets one. */
function cell(paragraphs: string[], width: number, fill?: string): string {
  const tcPr =
    `<w:tcW w:w="${width}" w:type="pct"/>` +
    `<w:tcBorders>${CELL_BORDERS}</w:tcBorders>` +
    (fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : "") +
    '<w:tcMar><w:top w:w="80" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar>' +
    '<w:vAlign w:val="center"/>';
  const content = paragraphs.length ? paragraphs.join("") : "<w:p/>";
  return `<w:tc><w:tcPr>${tcPr}</w:tcPr>${content}</w:tc>`;
}

/** `header` repeats the row at the top of every page the table spills onto. */
function tableRow(cells: string[], { header = false } = {}): string {
  return `<w:tr>${header ? "<w:trPr><w:tblHeader/></w:trPr>" : ""}${cells.join("")}</w:tr>`;
}

function table(grid: readonly number[], rows: string[]): string {
  const borders = ["top", "left", "bottom", "right", "insideH", "insideV"]
    .map((side) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="auto"/>`)
    .join("");
  const tblPr =
    '<w:tblW w:w="5000" w:type="pct"/>' +
    `<w:tblBorders>${borders}</w:tblBorders>` +
    '<w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="0" w:noVBand="0"/>';
  const tblGrid = grid.map((w) => `<w:gridCol w:w="${w}"/>`).join("");
  return `<w:tbl><w:tblPr>${tblPr}</w:tblPr><w:tblGrid>${tblGrid}</w:tblGrid>${rows.join("")}</w:tbl>`;
}

// ── the fixed parts ─────────────────────────────────────────────────────────

const CONTENT_TYPES = `${XML_DECLARATION}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="${DOCX_CONTENT_TYPE}.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;

const RELS_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const OFFICE_RELS =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

const ROOT_RELS = `${XML_DECLARATION}<Relationships xmlns="${RELS_NS}"><Relationship Id="rId1" Type="${OFFICE_RELS}/officeDocument" Target="word/document.xml"/></Relationships>`;

const DOCUMENT_RELS = `${XML_DECLARATION}<Relationships xmlns="${RELS_NS}"><Relationship Id="rId1" Type="${OFFICE_RELS}/styles" Target="styles.xml"/></Relationships>`;

/** Only what the document's `w:pStyle` references, matching the reference's sizes. */
const STYLES = `${XML_DECLARATION}<w:styles xmlns:w="${W_NS}"><w:docDefaults><w:rPrDefault><w:rPr>${ARIAL}<w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:rPrDefault><w:pPrDefault/></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:qFormat/><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:qFormat/><w:pPr><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style></w:styles>`;

// ── the zip ─────────────────────────────────────────────────────────────────

/** 1 Jan 1980 in MS-DOS date format — the epoch, so every export is reproducible. */
const DOS_EPOCH_DATE = 0x21;

function zip(entries: readonly { name: string; body: string }[]): Buffer {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = Buffer.from(entry.body, "utf8");
    const crc = crc32(data);

    const header = Buffer.alloc(30 + name.length);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4); // version needed
    header.writeUInt16LE(0x0800, 6); // names are UTF-8
    header.writeUInt16LE(0, 8); // stored, not deflated
    header.writeUInt16LE(0, 10); // modified time
    header.writeUInt16LE(DOS_EPOCH_DATE, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18); // compressed size
    header.writeUInt32LE(data.length, 22); // uncompressed size
    header.writeUInt16LE(name.length, 26);
    name.copy(header, 30);
    local.push(header, data);

    const record = Buffer.alloc(46 + name.length);
    record.writeUInt32LE(0x02014b50, 0);
    record.writeUInt16LE(20, 4); // version made by
    record.writeUInt16LE(20, 6); // version needed
    record.writeUInt16LE(0x0800, 8);
    record.writeUInt16LE(0, 10);
    record.writeUInt16LE(0, 12);
    record.writeUInt16LE(DOS_EPOCH_DATE, 14);
    record.writeUInt32LE(crc, 16);
    record.writeUInt32LE(data.length, 20);
    record.writeUInt32LE(data.length, 24);
    record.writeUInt16LE(name.length, 28);
    record.writeUInt32LE(offset, 42); // offset of the local header
    name.copy(record, 46);
    central.push(record);

    offset += header.length + data.length;
  }

  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...local, directory, end]);
}
