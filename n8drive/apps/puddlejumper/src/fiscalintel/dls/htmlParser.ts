/**
 * DLS HTML Table Parser
 * Extracts tabular data from Logi Analytics HTML report responses.
 * DLS reports render data as plain HTML tables with class="rd-grid-table".
 */

export interface ParsedRow {
  [column: string]: string;
}

/**
 * Extract column headers from the first <TR> inside a report table.
 * DLS uses <TH> or first <TD> row for headers.
 */
function extractHeaders(tableHtml: string): string[] {
  const headerMatch = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/i);
  if (!headerMatch) return [];
  const row = headerMatch[0];
  const headers: string[] = [];
  const cellRe = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
  let m: RegExpExecArray | null;
  while ((m = cellRe.exec(row)) !== null) {
    headers.push(cleanCell(m[1]));
  }
  return headers;
}

/**
 * Strip HTML tags and decode common entities, collapse whitespace.
 */
function cleanCell(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse all <TR> rows (skipping the header row) into keyed objects.
 */
function extractRows(tableHtml: string, headers: string[]): ParsedRow[] {
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows: ParsedRow[] = [];
  let match: RegExpExecArray | null;
  let isFirst = true;

  while ((match = rowRe.exec(tableHtml)) !== null) {
    if (isFirst) { isFirst = false; continue; } // skip header row
    const rowHtml = match[1];
    const cells: string[] = [];
    const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cm: RegExpExecArray | null;
    while ((cm = cellRe.exec(rowHtml)) !== null) {
      cells.push(cleanCell(cm[1]));
    }
    if (cells.length === 0) continue;
    const row: ParsedRow = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ""; });
    rows.push(row);
  }
  return rows;
}

/**
 * Main parse function — finds the primary data table in DLS report HTML
 * and returns headers + rows.
 */
export function parseDlsTable(html: string): { headers: string[]; rows: ParsedRow[] } {
  // DLS reports use rd-grid-table or a standard table with many columns
  // Find the largest table in the page (heuristic: most rows)
  const tableRe = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let bestTable = "";
  let bestCount = 0;
  let m: RegExpExecArray | null;

  while ((m = tableRe.exec(html)) !== null) {
    const trCount = (m[1].match(/<tr/gi) || []).length;
    if (trCount > bestCount) {
      bestCount = trCount;
      bestTable = m[1];
    }
  }

  if (!bestTable) return { headers: [], rows: [] };

  const headers = extractHeaders(bestTable);
  const rows = extractRows(bestTable, headers);
  return { headers, rows };
}

/**
 * Parse a numeric value from a DLS cell — strips $, %, commas.
 * Returns null if not parseable.
 */
export function parseNumber(val: string): number | null {
  const cleaned = val.replace(/[$,%\s]/g, "").replace(/\(([^)]+)\)/, "-$1");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}
