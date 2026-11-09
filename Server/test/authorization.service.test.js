import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/config/prisma.js";
import { getPatientById } from "../src/services/patient.service.js";
import { getTestOrderById } from "../src/services/test-order.service.js";
import { getPaymentById } from "../src/services/payment.service.js";
import { getResultById } from "../src/services/result.service.js";
import { getReportById } from "../src/services/report.service.js";
import { getTestDefinitionById } from "../src/services/test.service.js";

const user = {
  role: "LAB_ADMIN",
  laboratoryId: "00000000-0000-0000-0000-000000000001",
};
const id = "00000000-0000-0000-0000-000000000002";

test("laboratory-scoped reads reject records from another laboratory", async () => {
  const methods = [
    ["patient", getPatientById, { patientId: id }],
    ["testOrder", getTestOrderById, { orderId: id }],
    ["payment", getPaymentById, { paymentId: id }],
    ["result", getResultById, { resultId: id }],
    ["report", getReportById, { reportId: id }],
    ["testDefinition", getTestDefinitionById, { testId: id }],
  ];
  const originals = new Map();
  const queries = [];

  for (const [model, method, args] of methods) {
    originals.set(model, prisma[model].findFirst);
    prisma[model].findFirst = async ({ where }) => {
      queries.push({ model, where });
      return null;
    };
    await assert.rejects(method({ user, ...args }), /not found/);
  }

  for (const [model, original] of originals) {
    prisma[model].findFirst = original;
  }

  assert.deepEqual(
    queries.map(({ model, where }) => [model, where.laboratoryId ?? where.order?.laboratoryId ?? where.orderedTestItem?.order?.laboratoryId]),
    [
      ["patient", user.laboratoryId],
      ["testOrder", user.laboratoryId],
      ["payment", user.laboratoryId],
      ["result", user.laboratoryId],
      ["report", user.laboratoryId],
      ["testDefinition", undefined],
    ]
  );
  assert.deepEqual(queries[5].where.OR, [
    { laboratoryId: user.laboratoryId },
    { laboratoryId: null },
  ]);
});
