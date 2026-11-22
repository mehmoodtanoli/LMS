import test from "node:test";
import assert from "node:assert/strict";
import {
  CSV_BOM,
  buildCsv,
  escapeCsvCell,
  guardFormula,
  toCellText,
} from "../src/utils/csv.js";

test("escapeCsvCell quotes commas, quotes and line breaks", () => {
  assert.equal(escapeCsvCell("plain"), "plain");
  assert.equal(escapeCsvCell("a,b"), '"a,b"');
  assert.equal(escapeCsvCell('He said "hi"'), '"He said ""hi"""');
  assert.equal(escapeCsvCell("line1\nline2"), '"line1\nline2"');
});

test("guardFormula neutralises formula starters", () => {
  assert.equal(guardFormula("=1+1"), "'=1+1");
  assert.equal(guardFormula("@SUM(A1)"), "'@SUM(A1)");
  assert.equal(guardFormula("+cmd|' /C calc'!A0"), "'+cmd|' /C calc'!A0");
  assert.equal(guardFormula("-cmd"), "'-cmd");
  assert.equal(guardFormula("  =1+1"), "'  =1+1");
  assert.equal(guardFormula("\t=1+1"), "'\t=1+1");
});

test("guardFormula keeps harmless values unchanged", () => {
  assert.equal(guardFormula("Ali Khan"), "Ali Khan");
  assert.equal(guardFormula("-5.2"), "-5.2");
  assert.equal(guardFormula("+923001234567"), "+923001234567");
  assert.equal(guardFormula("+92 300 1234567", { allowPhone: true }), "+92 300 1234567");
  assert.equal(guardFormula("+92 300 1234567"), "'+92 300 1234567");
});

test("toCellText handles nulls, numbers, decimals, dates, booleans and JSON", () => {
  assert.equal(toCellText(null), "");
  assert.equal(toCellText(undefined), "");
  assert.equal(toCellText(-12.5), "-12.5");
  assert.equal(toCellText({ toFixed: (d) => (-10).toFixed(d) }), "-10.00");
  assert.equal(toCellText(true), "Yes");
  assert.equal(toCellText(new Date("2026-11-22T10:00:00Z")), "2026-11-22 15:00:00");
  assert.equal(toCellText({ a: 1 }), '{"a":1}');
});

test("buildCsv adds BOM, CRLF and escapes cells", () => {
  const columns = [
    { header: "Name", value: (r) => r.name },
    { header: "Amount", value: (r) => r.amount },
  ];
  const csv = buildCsv(columns, [
    { name: '=HYPERLINK("x")', amount: -3 },
    { name: "A, B", amount: 4 },
  ]);

  assert.ok(csv.startsWith(CSV_BOM + "Name,Amount\r\n"));
  assert.ok(csv.includes(`"'=HYPERLINK(""x"")",-3\r\n`));
  assert.ok(csv.includes('"A, B",4\r\n'));
  assert.ok(csv.endsWith("\r\n"));
});