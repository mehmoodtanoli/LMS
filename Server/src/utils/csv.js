/**
 * CSV generation utilities for the Export Data feature.
 *
 * - UTF-8 with BOM so Microsoft Excel opens non-ASCII text correctly.
 * - CRLF row separators (RFC 4180).
 * - Proper quoting of commas, quotes and line breaks.
 * - Spreadsheet formula injection protection for text cells.
 *
 * Numbers, booleans and dates are never passed through the formula guard,
 * so negative amounts and timestamps stay intact.
 */

export const CSV_BOM = "\uFEFF";
export const CSV_EOL = "\r\n";

// A text cell is dangerous when a spreadsheet could interpret it as a formula.
// Excel ignores leading spaces before "=", so the check looks past them.
const FORMULA_START = /^[\s]*[=+\-@]|^[\t\r]/;
// Plain numbers such as "-5.2" are harmless and must stay unchanged.
const PLAIN_NUMBER = /^[+-]?\d+(\.\d+)?$/;
// A plain international phone number such as "+92 300 1234567" is harmless
// and must not be altered, otherwise exported phone data would be corrupted.
const SAFE_PHONE = /^\+\d[\d\s\-()]*$/;

/**
 * Neutralises spreadsheet formula injection by prefixing a single quote.
 * Only used for text values.
 */
export function guardFormula(text, { allowPhone = false } = {}) {
  if (!FORMULA_START.test(text)) return text;
  if (PLAIN_NUMBER.test(text.trim())) return text;
  if (allowPhone && SAFE_PHONE.test(text.trim())) return text;
  return `'${text}`;
}

/**
 * Formats a Date as "YYYY-MM-DD HH:mm:ss" in a fixed UTC offset
 * (default Pakistan Standard Time, UTC+5, because the server runs in UTC).
 */
export function formatDate(date, utcOffsetMinutes = 300) {
  const shifted = new Date(date.getTime() + utcOffsetMinutes * 60 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())} ` +
    `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}`
  );
}

/**
 * Converts any JavaScript value into the raw (unquoted) text of a CSV cell.
 * Dates, decimals, numbers and booleans are trusted non-text values.
 * Everything else is text and goes through the formula guard.
 */
export function toCellText(value, options = {}) {
  if (value === null || value === undefined) return "";

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? ""
      : formatDate(value, options.utcOffsetMinutes);
  }

  // Prisma Decimal exposes toFixed; keep money at two decimals.
  if (typeof value === "object" && typeof value.toFixed === "function") {
    return value.toFixed(options.decimals ?? 2);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }

  if (typeof value === "boolean") return value ? "Yes" : "No";

  if (typeof value === "object") {
    return guardFormula(JSON.stringify(value), options);
  }

  return guardFormula(String(value), options);
}

/**
 * Quotes a cell when it contains a delimiter, quote or line break.
 */
export function escapeCsvCell(text) {
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildCsvHeader(columns) {
  return columns.map((column) => escapeCsvCell(column.header)).join(",");
}

/**
 * A column is { header, value: (record) => any, phone?: boolean, decimals?: number }.
 */
export function buildCsvRow(columns, record, options = {}) {
  return columns
    .map((column) =>
      escapeCsvCell(
        toCellText(column.value(record), {
          allowPhone: Boolean(column.phone),
          decimals: column.decimals,
          utcOffsetMinutes: options.utcOffsetMinutes,
        })
      )
    )
    .join(",");
}

/**
 * Assembles a complete CSV document (with BOM) from records.
 */
export function buildCsv(columns, records, options = {}) {
  const lines = [buildCsvHeader(columns)];
  for (const record of records) {
    lines.push(buildCsvRow(columns, record, options));
  }
  return CSV_BOM + lines.join(CSV_EOL) + CSV_EOL;
}