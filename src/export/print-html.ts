import {
  DOCUMENT_TITLE,
  MATRIX_HEADINGS,
  SECTIONS,
  SIGNATURE,
  type IapDocument,
} from "./iap-document";

/**
 * The same document as `renderDocx`, as an A4 print page.
 *
 * ponytail: PDF is the browser's own print dialog — "Simpan sebagai PDF" — rather than
 * a rendering engine bundled into the app. It costs no dependency, it prints the fonts
 * the reader actually has, and the page is readable on its own if printing is declined.
 */
export function renderPrintHtml(doc: IapDocument): string {
  const header = doc.header.length
    ? `<table class="meta">${doc.header
        .map(
          (row) =>
            `<tr><th>${escapeHtml(row.label)}</th><td>${escapeHtml(row.value)}</td></tr>`,
        )
        .join("")}</table>`
    : "";

  const matrix = `<table class="matrix"><colgroup><col class="no"><col class="step"><col class="details"><col class="timeline"><col class="status"><col class="pic"></colgroup><thead><tr>${MATRIX_HEADINGS.map(
    (label) => `<th>${escapeHtml(label)}</th>`,
  ).join("")}</tr></thead><tbody>${doc.matrix
    .map(
      (row) =>
        `<tr><td class="c">${row.no}</td><td><b>${escapeHtml(row.step)}</b></td>` +
        `<td>${row.details.map((detail) => `<p>${escapeHtml(detail)}</p>`).join("")}</td>` +
        `<td class="c">${escapeHtml(row.timeline)}</td><td class="c">${escapeHtml(row.status)}</td><td class="c">${escapeHtml(row.pic)}</td></tr>`,
    )
    .join("")}</tbody></table>`;

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>${escapeHtml(`IAP ${doc.iapId}`)}</title>
<style>
  @page { size: A4; margin: 1.6cm 1.8cm; }
  * { box-sizing: border-box; }
  body { margin: 0 auto; max-width: 21cm; padding: 1.6cm 1.8cm; font: 10pt/1.45 Arial, Helvetica, sans-serif; color: #000; }
  h1 { margin: 0 0 4pt; font-size: 16pt; text-align: center; color: #0B5B31; }
  .subtitle { margin: 0 0 12pt; text-align: center; font-style: italic; font-size: 11pt; color: #444; }
  h2 { margin: 13pt 0 6pt; font-size: 12.5pt; color: #0D4D8B; page-break-after: avoid; }
  p { margin: 0 0 7pt; text-align: justify; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #BFBFBF; padding: 4pt 6pt; vertical-align: middle; text-align: left; }
  .meta th { width: 25%; background: #EAF7EE; font-weight: bold; }
  .matrix { font-size: 9.5pt; }
  .matrix col.no { width: 5%; }
  .matrix col.step { width: 17%; }
  .matrix col.details { width: 35%; }
  .matrix col.timeline { width: 12%; }
  .matrix col.status { width: 11%; }
  .matrix col.pic { width: 20%; }
  .matrix thead th { background: #0B5B31; color: #fff; text-align: center; }
  .matrix td p { margin: 0 0 3pt; text-align: left; }
  .matrix td p:last-child { margin-bottom: 0; }
  .matrix tr { page-break-inside: avoid; }
  td.c { text-align: center; }
  ul { margin: 0 0 7pt; padding-left: 16pt; }
  li { margin-bottom: 3pt; font-size: 9.5pt; }
  .sign { margin-top: 18pt; }
  .sign .space { height: 46pt; }
  .sign b { display: block; }
  @media print { body { padding: 0; max-width: none; } }
</style>
</head>
<body onload="window.print()">
<h1>${escapeHtml(DOCUMENT_TITLE)}</h1>
<p class="subtitle">${escapeHtml(doc.subtitle)}</p>
${header}
<h2>${escapeHtml(SECTIONS.background)}</h2>
${doc.background.map((text) => `<p>${escapeHtml(text)}</p>`).join("")}
<h2>${escapeHtml(SECTIONS.matrix)}</h2>
${matrix}
<h2>${escapeHtml(SECTIONS.kpi)}</h2>
<ul>${doc.kpis.map((kpi) => `<li>${escapeHtml(kpi)}</li>`).join("")}</ul>
<h2>${escapeHtml(SECTIONS.closing)}</h2>
<p>${escapeHtml(doc.closing)}</p>
<div class="sign">
  <p>${escapeHtml(SIGNATURE.intro)}</p>
  <div class="space"></div>
  <p>${escapeHtml(SIGNATURE.name)}</p>
  <p><b>${escapeHtml(SIGNATURE.company)}</b></p>
</div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
