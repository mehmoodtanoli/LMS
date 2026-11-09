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
