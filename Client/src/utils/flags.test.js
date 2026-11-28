// Run: node --test Client/src/utils/flags.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { computeFlag } from "./flags.js";

test("flags for every range style", () => {
  assert.equal(computeFlag("10", "13-17"), "Low");
  assert.equal(computeFlag("18", "13 – 17"), "High");
  assert.equal(computeFlag("15", "13 to 17"), "Normal");
  assert.equal(computeFlag("215", "Up to 200"), "High");
  assert.equal(computeFlag("170", "Less than 160"), "High");
  assert.equal(computeFlag("35", "<40"), "Normal");
  assert.equal(computeFlag("40", ">45"), "Low");
  assert.equal(computeFlag("50", "More than 40"), "Normal");
  assert.equal(computeFlag("Positive", "Negative"), null);
  assert.equal(computeFlag("12abc", "13-17"), null);
  assert.equal(computeFlag("", "13-17"), null);
});
