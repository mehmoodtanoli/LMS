import prisma from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import ApiError from "../utils/ApiError.js";

function getScope(user) {
  if (user.role === "SUPERADMIN") return null;
  if (user.role === "LAB_ADMIN") {
    if (!user.laboratoryId) {
      throw new ApiError(403, "User must be assigned to a laboratory.");
    }
    return user.laboratoryId;
  }
  throw new ApiError(403, "You are not authorized to access dashboard statistics.");
}

function getDayRange(now) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

async function getDashboardStatistics({ user, now = new Date() }) {
  const laboratoryId = getScope(user);
  const { start, end } = getDayRange(now);
  const patientWhere = {
    isDeleted: false,
    ...(laboratoryId ? { laboratoryId } : {}),
  };
  const orderWhere = laboratoryId ? { laboratoryId } : {};
  const resultWhere = {
    status: "PENDING",
    ...(laboratoryId
      ? { orderedTestItem: { order: { laboratoryId } } }
      : {}),
  };
  const reportWhere = {
    status: "FINAL",
    createdAt: { gte: start, lt: end },
    ...(laboratoryId ? { laboratoryId } : {}),
  };
  const paymentWhere = {
    status: "PAID",
    ...(laboratoryId ? { laboratoryId } : {}),
  };
  const testWhere = laboratoryId
    ? { OR: [{ laboratoryId }, { laboratoryId: null }] }
    : {};
  const orderSelect = {
    id: true,
    status: true,
    createdAt: true,
    patient: { select: { name: true, fullName: true } },
    orderedTestItems: {
      select: { id: true, testDefinition: { select: { code: true } } },
      take: 8,
    },
  };
  const orderScope = {
    ...orderWhere,
    status: { not: "CANCELLED" },
  };
  const unpaidScope = laboratoryId
    ? Prisma.sql`AND o."laboratoryId" = ${laboratoryId}::uuid`
    : Prisma.empty;

  const [
    pendingResults,
    unpaidOrdersAmount,
    patientsToday,
    ordersToday,
    reportsFinalizedToday,
    testsInCatalog,
    revenue,
    recentOrders,
    activeWorkOrders,
  ] = await Promise.all([
    prisma.result.count({ where: resultWhere }),
    prisma.$queryRaw`
      SELECT COALESCE(SUM(order_totals.total_amount - order_payments.paid_amount), 0) AS amount
      FROM (
        SELECT o."id",
          COALESCE(SUM(oti."price"), 0) AS total_amount
        FROM "test_orders" o
        LEFT JOIN "ordered_test_items" oti ON oti."orderId" = o."id"
        WHERE o."status" <> 'CANCELLED'
          ${unpaidScope}
        GROUP BY o."id"
      ) order_totals
      JOIN (
        SELECT o."id",
          COALESCE(SUM(CASE WHEN p."status" = 'PAID' THEN p."amount" ELSE 0 END), 0) AS paid_amount
        FROM "test_orders" o
        LEFT JOIN "payments" p ON p."orderId" = o."id"
        WHERE o."status" <> 'CANCELLED'
          ${unpaidScope}
        GROUP BY o."id"
      ) order_payments ON order_payments.id = order_totals.id
      WHERE order_totals.total_amount > order_payments.paid_amount
    `,
    prisma.patient.count({ where: { ...patientWhere, createdAt: { gte: start, lt: end } } }),
    prisma.testOrder.count({ where: { ...orderWhere, createdAt: { gte: start, lt: end } } }),
    prisma.report.count({ where: reportWhere }),
    prisma.testDefinition.count({ where: testWhere }),
    prisma.payment.aggregate({ where: paymentWhere, _sum: { amount: true } }),
    prisma.testOrder.findMany({
      where: orderScope,
      select: orderSelect,
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.testOrder.findMany({
      where: { ...orderScope, status: { in: ["PENDING", "IN_PROGRESS"] } },
      select: orderSelect,
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
  ]);

  return {
    pendingResults,
    unpaidOrdersAmount: Number(unpaidOrdersAmount[0]?.amount || 0),
    patientsToday,
    ordersToday,
    reportsFinalizedToday,
    testsInCatalog,
    totalRevenueCollected: Number(revenue._sum.amount || 0),
    recentOrders,
    activeWorkOrders,
  };
}

export { getDashboardStatistics, getScope, getDayRange };
