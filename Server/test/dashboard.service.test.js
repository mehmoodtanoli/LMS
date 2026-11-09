import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/config/prisma.js";
import { getDashboardStatistics } from "../src/services/dashboard.service.js";

const laboratoryId = "00000000-0000-0000-0000-000000000001";

function mockDashboardPrisma({ amount = 0, revenue = 0 } = {}) {
  const originals = {
    resultCount: prisma.result.count,
    patientCount: prisma.patient.count,
    orderCount: prisma.testOrder.count,
    reportCount: prisma.report.count,
    testCount: prisma.testDefinition.count,
    paymentAggregate: prisma.payment.aggregate,
    orderFindMany: prisma.testOrder.findMany,
    queryRaw: prisma.$queryRaw,
  };
  const calls = {};
  prisma.result.count = async (args) => {
    calls.result = args;
    return 0;
  };
  prisma.patient.count = async () => 0;
  prisma.testOrder.count = async () => 0;
  prisma.report.count = async () => 0;
  prisma.testDefinition.count = async () => 48;
  prisma.payment.aggregate = async (args) => {
    calls.payment = args;
    return { _sum: { amount: revenue } };
  };
  prisma.testOrder.findMany = async () => [];
  prisma.$queryRaw = async () => [{ amount }];
  return { calls, restore: () => {
    prisma.result.count = originals.resultCount;
    prisma.patient.count = originals.patientCount;
    prisma.testOrder.count = originals.orderCount;
    prisma.report.count = originals.reportCount;
    prisma.testDefinition.count = originals.testCount;
    prisma.payment.aggregate = originals.paymentAggregate;
    prisma.testOrder.findMany = originals.orderFindMany;
    prisma.$queryRaw = originals.queryRaw;
  } };
}

test("empty production data returns zero transactional metrics and catalog count", async () => {
  const mock = mockDashboardPrisma();
  try {
    const result = await getDashboardStatistics({
      user: { role: "SUPERADMIN" },
      now: new Date("2025-01-15T12:00:00Z"),
    });
    assert.equal(result.pendingResults, 0);
    assert.equal(result.unpaidOrdersAmount, 0);
    assert.equal(result.totalRevenueCollected, 0);
    assert.equal(result.testsInCatalog, 48);
  } finally {
    mock.restore();
  }
});

test("LAB_ADMIN dashboard statistics are scoped to the authenticated laboratory", async () => {
  const mock = mockDashboardPrisma({ amount: 1250, revenue: 8600 });
  try {
    const result = await getDashboardStatistics({
      user: { role: "LAB_ADMIN", laboratoryId },
    });
    assert.equal(result.unpaidOrdersAmount, 1250);
    assert.equal(result.totalRevenueCollected, 8600);
    assert.deepEqual(mock.calls.result.where.orderedTestItem.order, { laboratoryId });
    assert.deepEqual(mock.calls.payment.where, { status: "PAID", laboratoryId });
  } finally {
    mock.restore();
  }
});

test("LAB_TECH cannot access dashboard statistics", async () => {
  await assert.rejects(
    getDashboardStatistics({ user: { role: "LAB_TECH", laboratoryId } }),
    /not authorized/
  );
});
