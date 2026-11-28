// Reference range parsing for High / Low / Normal flags.
// Handles "13-17", "13 – 17", "13 to 17", "<40", "≤5", "Up to 200", "Less than 160",
// "Below 5", ">45", "≥40", "More than 40", "Above 40".
// ponytail: one range per parameter; age/gender-specific ranges need a schema change.

const NUM = "(\\d+(?:\\.\\d+)?)";

export function parseRange(text) {
  if (!text) return null;
  const s = String(text).toLowerCase().replace(/,/g, "");

  const between = s.match(new RegExp(`${NUM}\\s*(?:-|–|—|to)\\s*${NUM}`));
  if (between) return { low: Number(between[1]), high: Number(between[2]) };

  const n = s.match(new RegExp(NUM));
  if (!n) return null;
  const limit = Number(n[1]);

  if (/<|≤|up\s*to|less than|below|under|max/.test(s)) return { low: null, high: limit };
  if (/>|≥|more than|greater than|above|over|min|at least/.test(s)) return { low: limit, high: null };
  return null;
}

export function computeFlag(value, refRange) {
  const range = parseRange(refRange);
  if (!range || value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  const num = Number(text);
  if (!Number.isFinite(num)) return null;

  if (range.low !== null && num < range.low) return "Low";
  if (range.high !== null && num > range.high) return "High";
  return "Normal";
}
