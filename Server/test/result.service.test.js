import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/config/prisma.js";
import { updateResult } from "../src/services/result.service.js";

const user = {
  id: "00000000-0000-0000-0000-000000000010",
  email: "tech@example.test",
  role: "LAB_TECH",
  laboratoryId: "00000000-0000-0000-0000-000000000001",
};

const resultId = "00000000-0000-0000-0000-000000000020";
const firstUpdatedAt = new Date("2026-01-01T00:00:00.000Z");
const existingResult = {
  id: resultId,
  status: "PENDING",
  value: { observation: "old" },
  notes: null,
  updatedAt: firstUpdatedAt,
  orderedTestItem: { order: { laboratoryId: user.laboratoryId } },
};

test("result update rejects a same-status lost update", async () => {
  const originalFindFirst = prisma.result.findFirst;
  const originalTransaction = prisma.$transaction;
  prisma.result.findFirst = async () => existingResult;
  prisma.$transaction = async (callback) =>
    callback({
      $queryRaw: async () => [],
      result: {
        findUnique: async () => ({
          status: "PENDING",
          updatedAt: new Date("2026-01-01T00:00:01.000Z"),
        }),
      },
    });

  try {
    await assert.rejects(
      updateResult({
        user,
        resultId,
        data: { value: { observation: "new" } },
      }),
      /changed while it was being edited/
    );
  } finally {
    prisma.result.findFirst = originalFindFirst;
    prisma.$transaction = originalTransaction;
  }
});

test("result update preserves a valid forward transition", async () => {
  const originalFindFirst = prisma.result.findFirst;
  const originalTransaction = prisma.$transaction;
  prisma.result.findFirst = async () => existingResult;
  prisma.$transaction = async (callback) =>
    callback({
      $queryRaw: async () => [],
      result: {
        findUnique: async () => ({
          status: "PENDING",
          updatedAt: firstUpdatedAt,
        }),
        update: async ({ data }) => ({
          ...existingResult,
          ...data,
          status: data.status || existingResult.status,
        }),
      },
      auditLog: { create: async () => ({}) },
    });

  try {
    const updated = await updateResult({
      user,
      resultId,
      data: { status: "IN_PROGRESS", value: { observation: "new" } },
    });
    assert.equal(updated.status, "IN_PROGRESS");
  } finally {
    prisma.result.findFirst = originalFindFirst;
    prisma.$transaction = originalTransaction;
  }
});

function fakeReportTx(latestReport) {
  const calls = { created: null, superseded: null, orderStatus: null };
  const tx = {
    $queryRaw: async () => [],
    testOrder: {
      findUnique: async () => ({
        id: "order-1",
        laboratoryId: "lab-1",
        status: "IN_PROGRESS",
        laboratory: null,
        patient: { id: "p1", name: "A" },
        orderedTestItems: [
          {
            testDefinition: { parameters: [{ id: "hb", name: "Hb" }] },
            result: { status: "FINALIZED", value: { hb: "11" } },
          },
        ],
      }),
      update: async ({ data }) => { calls.orderStatus = data.status; },
    },
    report: {
      findFirst: async () => latestReport,
      update: async ({ data }) => { calls.superseded = data.status; },
      create: async ({ data }) => { calls.created = data; return { id: "r2", ...data }; },
    },
    laboratory: { update: async () => ({ reportCounter: 9 }) },
    auditLog: { create: async () => ({}) },
  };
  return { tx, calls };
}

test("amending a result issues a new AMENDED report version", async () => {
  const { tx, calls } = fakeReportTx({ id: "r1", version: 1, status: "FINAL", reportNumber: 4 });
  const { ensureFinalReportForOrder } = await import("../src/services/result.service.js");

  await ensureFinalReportForOrder(tx, { id: "u1", role: "LAB_ADMIN" }, "order-1", { amended: true });

  assert.equal(calls.superseded, "SUPERSEDED");
  assert.equal(calls.created.status, "AMENDED");
  assert.equal(calls.created.version, 2);
  assert.equal(calls.created.reportNumber, 4);
  assert.equal(calls.orderStatus, "COMPLETED");
});

test("finalizing again without amendment keeps the issued report", async () => {
  const latest = { id: "r1", version: 1, status: "FINAL", reportNumber: 4 };
  const { tx, calls } = fakeReportTx(latest);
  const { ensureFinalReportForOrder } = await import("../src/services/result.service.js");

  const report = await ensureFinalReportForOrder(tx, { id: "u1", role: "LAB_ADMIN" }, "order-1");

  assert.equal(report, latest);
  assert.equal(calls.created, null);
});

test("numeric parameters reject text, text parameters accept it", async () => {
  const { assertNumericValues } = await import("../src/services/result.service.js");
  const params = [
    { id: "hb", name: "Hemoglobin", referenceRange: "13-17" },
    { id: "chol", name: "Cholesterol", referenceRange: "Up to 200" },
    { id: "hcv", name: "Anti HCV", referenceRange: "Negative" },
  ];

  assert.throws(() => assertNumericValues({ hb: "abc" }, params), { statusCode: 400 });
  assert.throws(() => assertNumericValues({ chol: "12..5" }, params), { statusCode: 400 });
  assert.doesNotThrow(() => assertNumericValues({ hb: "12.5", chol: "190", hcv: "Positive" }, params));
  assert.doesNotThrow(() => assertNumericValues({ hb: "" }, params));
});

test("numeric parameters accept qualifiers, separators and text named in the range", async () => {
  const { assertNumericValues } = await import("../src/services/result.service.js");
  const params = [
    { id: "tsh", name: "TSH", referenceRange: "0.4-4.0" },
    { id: "plt", name: "Platelets", referenceRange: "150,000-450,000" },
    { id: "hcv", name: "Anti HCV", referenceRange: "Non-reactive (<1.0)" },
  ];

  assert.doesNotThrow(() =>
    assertNumericValues({ tsh: "<0.01", plt: "1,200", hcv: "Non-reactive" }, params)
  );
  assert.doesNotThrow(() => assertNumericValues({ tsh: ">= 5", plt: ">1000" }, params));
  assert.throws(() => assertNumericValues({ tsh: "high-ish" }, params), { statusCode: 400 });
  assert.throws(() => assertNumericValues({ hcv: "Reactive-ish" }, params), { statusCode: 400 });
  assert.throws(() => assertNumericValues({ tsh: "-" }, params), { statusCode: 400 });
});

test("result update checks numeric values against the parameter range", async () => {
  const originalFindFirst = prisma.result.findFirst;
  let select;
  prisma.result.findFirst = async (args) => {
    select = args.select;
    return {
      ...existingResult,
      orderedTestItem: {
        order: { laboratoryId: user.laboratoryId },
        testDefinition: { parameters: [{ id: "hb", name: "Hb", referenceRange: "13-17" }] },
      },
    };
  };
  try {
    await assert.rejects(
      updateResult({ user, resultId, data: { value: { hb: "high-ish" } } }),
      { statusCode: 400 }
    );
    assert.equal(
      select.orderedTestItem.select.testDefinition.select.parameters.select.referenceRange,
      true
    );
  } finally {
    prisma.result.findFirst = originalFindFirst;
  }
});
