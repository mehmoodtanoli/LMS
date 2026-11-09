import test from "node:test";
import assert from "node:assert/strict";
import {
  createReport,
  hasCompleteResult,
} from "../src/services/report.service.js";
import prisma from "../src/config/prisma.js";

const scalar = (result) => ({
  testDefinition: { parameters: [] },
  result,
});

test("report completeness rejects missing, blank, and non-finalized scalar results", () => {
  assert.equal(hasCompleteResult(scalar(null)), false);
  assert.equal(hasCompleteResult(scalar({ status: "FINALIZED", value: "" })), false);
  assert.equal(hasCompleteResult(scalar({ status: "FINALIZED", value: "   " })), false);
  assert.equal(hasCompleteResult(scalar({ status: "COMPLETED", value: "12" })), false);
});

test("report completeness accepts a non-blank finalized scalar result", () => {
  assert.equal(hasCompleteResult(scalar({ status: "FINALIZED", value: "12" })), true);
});

test("report completeness requires every parameter value", () => {
  const item = {
    testDefinition: {
      parameters: [
        { id: "p1", name: "Hemoglobin" },
        { id: "p2", name: "WBC" },
      ],
    },
    result: { status: "FINALIZED", value: { p1: "12" } },
  };

  assert.equal(hasCompleteResult(item), false);
  assert.equal(
    hasCompleteResult({
      ...item,
      result: { status: "FINALIZED", value: { p1: "12", p2: "   " } },
    }),
    false
  );
  assert.equal(
    hasCompleteResult({
      ...item,
      result: { status: "FINALIZED", value: { p1: "12", p2: "4.5" } },
    }),
    true
  );
});

test("report completeness accepts parameter names as stored value keys", () => {
  assert.equal(
    hasCompleteResult({
      testDefinition: { parameters: [{ id: "p1", name: "Hemoglobin" }] },
      result: { status: "FINALIZED", value: { Hemoglobin: "12" } },
    }),
    true
  );
});

test("LAB_TECH users cannot finalize or amend reports", async () => {
  await assert.rejects(
    createReport({
      user: {
        id: "00000000-0000-0000-0000-000000000010",
        role: "LAB_TECH",
        laboratoryId: "00000000-0000-0000-0000-000000000001",
      },
      data: {
        orderId: "00000000-0000-0000-0000-000000000020",
        status: "FINAL",
      },
    }),
    /cannot finalize or amend/
  );
});

test("LAB_TECH users can proceed with draft report preparation", async () => {
  const originalFindFirst = prisma.testOrder.findFirst;
  prisma.testOrder.findFirst = async () => ({
    status: "PENDING",
    orderedTestItems: [],
  });

  try {
    await assert.rejects(
      createReport({
        user: {
          id: "00000000-0000-0000-0000-000000000010",
          role: "LAB_TECH",
          laboratoryId: "00000000-0000-0000-0000-000000000001",
        },
        data: {
          orderId: "00000000-0000-0000-0000-000000000020",
        },
      }),
      /does not contain any ordered test items/
    );
  } finally {
    prisma.testOrder.findFirst = originalFindFirst;
  }
});
