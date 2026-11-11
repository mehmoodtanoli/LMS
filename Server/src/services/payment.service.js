import prisma from "../config/prisma.js";
import { randomUUID } from "node:crypto";
import ApiError from "../utils/ApiError.js";
import {
  assertUuid,
  parsePagination,
  normalizeString,
  normalizeOptionalString,
} from "../utils/validators.js";
import { recordAuditLog } from "../utils/audit.js";

const VALID_PAYMENT_STATUSES = ["UNPAID", "PARTIALLY_PAID", "PAID", "REFUNDED"];
const VALID_PAYMENT_METHODS = ["CASH", "CARD", "BANK_TRANSFER", "OTHER"];

const PAYMENT_SELECT = {
  id: true,
  laboratoryId: true,
  orderId: true,
  status: true,
  amount: true,
  method: true,
  paidAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  laboratory: {
    select: {
      id: true,
      name: true,
    },
  },
  order: {
    select: {
      id: true,
      status: true,
      notes: true,
      laboratoryId: true,
      totalAmount: true,
      billFinalizedAt: true,
      patient: {
        select: {
          id: true,
          name: true,
          fullName: true,
          cnic: true,
          phone: true,
          age: true,
          ageUnit: true,
          gender: true,
          address: true,
          laboratoryId: true,
        },
      },
      orderedTestItems: {
        select: {
          id: true,
          price: true,
          testDefinition: {
            select: {
              id: true,
              code: true,
              name: true,
              price: true,
            },
          },
        },
      },
    },
  },
};

const IDEMPOTENCY_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertPaymentReadScope(user) {
  if (user.role === "SUPERADMIN") {
    return null;
  }

  if (user.role === "LAB_ADMIN" || user.role === "LAB_TECH") {
    if (!user.laboratoryId) {
      throw new ApiError(
        403,
        "User must be assigned to a laboratory before accessing payments."
      );
    }

    return user.laboratoryId;
  }

  throw new ApiError(403, "You are not authorized to access payments.");
}

function assertPaymentWriteScope(user) {
  if (user.role === "SUPERADMIN") {
    return null;
  }

  if (user.role === "LAB_ADMIN") {
    if (!user.laboratoryId) {
      throw new ApiError(
        403,
        "User must be assigned to a laboratory before managing payments."
      );
    }

    return user.laboratoryId;
  }

  throw new ApiError(403, "Only LAB_ADMIN users can record payments.");
}

function assertBillFinalizationScope(user) {
  if (user.role !== "LAB_ADMIN") {
    throw new ApiError(403, "Only LAB_ADMIN users can finalize bills.");
  }

  if (!user.laboratoryId) {
    throw new ApiError(
      403,
      "User must be assigned to a laboratory before finalizing bills."
    );
  }

  return user.laboratoryId;
}

function parseMoneyToCents(value, field = "amount", allowZero = false) {
  const normalizedValue = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalizedValue)) {
    throw new ApiError(400, `${field} must be a positive amount with at most two decimal places.`, {
      field,
    });
  }

  const [whole, fraction = ""] = normalizedValue.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents < 0 || (!allowZero && cents === 0)) {
    throw new ApiError(400, "amount must be a positive number.", { field });
  }
  return cents;
}

function moneyToCents(value, field = "amount", allowZero = false) {
  if (value === undefined || value === null) {
    throw new ApiError(400, `${field} is required.`, { field });
  }
  return parseMoneyToCents(value, field, allowZero);
}

function normalizePaymentMethod(value) {
  const method = normalizeString(value).toUpperCase();
  if (!method || !VALID_PAYMENT_METHODS.includes(method)) {
    throw new ApiError(400, "method must be a valid payment method.", {
      field: "method",
      validValues: VALID_PAYMENT_METHODS,
    });
  }
  return method;
}

function buildListWhere(user) {
  const laboratoryId = assertPaymentReadScope(user);

  if (laboratoryId) {
    return { laboratoryId };
  }

  return {};
}

function normalizePaymentStatus(value) {
  const normalizedValue = normalizeString(value).toUpperCase();

  if (!normalizedValue) {
    return "PAID"; // Default to PAID (Fixes A3)
  }

  if (!VALID_PAYMENT_STATUSES.includes(normalizedValue)) {
    throw new ApiError(400, "status must be a valid payment status.", {
      field: "status",
      validValues: VALID_PAYMENT_STATUSES,
    });
  }

  return normalizedValue;
}

function normalizePaymentAmount(value) {
  if (value === undefined || value === null) {
    throw new ApiError(400, "amount is required.", { field: "amount" });
  }

  let numericValue;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new ApiError(400, "amount is required.", { field: "amount" });
    }
    numericValue = moneyToCents(trimmed) / 100;
  } else if (typeof value === "number") {
    numericValue = moneyToCents(value.toFixed(2)) / 100;
  } else {
    throw new ApiError(400, "amount must be a positive number.", {
      field: "amount",
    });
  }

  return numericValue;
}

function buildPaymentData(data) {
  const paymentData = {};

  if (data.amount !== undefined) {
    paymentData.amount = normalizePaymentAmount(data.amount);
  }

  paymentData.status = data.status ? normalizePaymentStatus(data.status) : "PAID";
  if (paymentData.status !== "PAID") {
    throw new ApiError(400, "New payment transactions must have PAID status.", {
      field: "status",
    });
  }

  paymentData.method = normalizePaymentMethod(data.method || "CASH");

  if (data.paidAt !== undefined) {
    if (data.paidAt === null || data.paidAt === "") {
      paymentData.paidAt = new Date();
    } else {
      const paidAt = new Date(data.paidAt);
      if (Number.isNaN(paidAt.getTime())) {
        throw new ApiError(400, "paidAt must be a valid date when provided.", {
          field: "paidAt",
        });
      }
      paymentData.paidAt = paidAt;
    }
  } else {
    paymentData.paidAt = new Date();
  }

  if (data.notes !== undefined) {
    const notes = normalizeOptionalString(data.notes);
    paymentData.notes = notes ?? null;
  }

  return paymentData;
}

async function findAccessibleTestOrder({ user, orderId, db = prisma }) {
  assertUuid(orderId, "orderId");

  const laboratoryId = assertPaymentReadScope(user);

  const order = await db.testOrder.findFirst({
    where: laboratoryId
      ? {
          id: orderId,
          laboratoryId,
        }
      : {
          id: orderId,
        },
    select: {
      id: true,
      laboratoryId: true,
      status: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      totalAmount: true,
      billFinalizedAt: true,
      patient: {
        select: {
          id: true,
          name: true,
          fullName: true,
          cnic: true,
          phone: true,
          age: true,
          ageUnit: true,
          gender: true,
          address: true,
          laboratoryId: true,
        },
      },
      orderedTestItems: {
        select: {
          id: true,
          price: true,
          testDefinition: {
            select: {
              id: true,
              code: true,
              name: true,
              price: true,
            },
          },
        },
      },
      payments: {
        select: {
          id: true,
          amount: true,
          method: true,
          status: true,
          paidAt: true,
        },
      },
    },
  });

  if (!order) {
    throw new ApiError(404, "Test order not found.");
  }

  return order;
}

async function getOrderBilling({ user, orderId }) {
  const order = await findAccessibleTestOrder({ user, orderId });

  const items = (order.orderedTestItems || []).map((item) => {
    return {
      id: item.id,
      testCode: item.testDefinition?.code,
      testName: item.testDefinition?.name,
    };
  });

  const totalAmountCents =
    order.totalAmount === null || order.totalAmount === undefined
      ? null
      : moneyToCents(order.totalAmount, "order total", true);
  let paidAmountCents = 0;
  (order.payments || []).forEach((p) => {
    if (p.status === "PAID") {
      paidAmountCents += moneyToCents(p.amount, "payment amount");
    }
  });

  const remainingAmountCents =
    totalAmountCents === null
      ? null
      : Math.max(0, totalAmountCents - paidAmountCents);
  let status = totalAmountCents === null ? "UNBILLED" : "UNPAID";
  if (totalAmountCents !== null && paidAmountCents >= totalAmountCents) {
    status = "PAID";
  } else if (totalAmountCents !== null && paidAmountCents > 0) {
    status = "PARTIALLY_PAID";
  }

  return {
    orderId: order.id,
    patient: order.patient,
    totalAmount: totalAmountCents === null ? null : totalAmountCents / 100,
    paidAmount: paidAmountCents / 100,
    remainingAmount:
      remainingAmountCents === null ? null : remainingAmountCents / 100,
    billFinalizedAt: order.billFinalizedAt,
    status,
    items,
    payments: order.payments,
  };
}

async function createPayment({ user, data, idempotencyKey }) {
  assertPaymentWriteScope(user);
  const orderId = normalizeString(data.orderId);

  if (!orderId) {
    throw new ApiError(400, "orderId is required.", { field: "orderId" });
  }

  const paymentData = buildPaymentData(data);

  if (paymentData.amount === undefined) {
    throw new ApiError(400, "amount is required.", { field: "amount" });
  }

  const requestedOrderTotal =
    data.orderTotalAmount === undefined
      ? null
      : moneyToCents(data.orderTotalAmount, "orderTotalAmount");

  const normalizedIdempotencyKey = normalizeString(idempotencyKey).toLowerCase() || randomUUID();
  if (!IDEMPOTENCY_KEY_PATTERN.test(normalizedIdempotencyKey)) {
    throw new ApiError(400, "Idempotency-Key must be a valid UUID.", {
      field: "idempotencyKey",
    });
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "test_orders" WHERE id = ${orderId}::uuid FOR UPDATE`;
      const accessibleOrder = await findAccessibleTestOrder({ user, orderId, db: tx });

      const existingPayment = await tx.payment.findUnique({
        where: { idempotencyKey: normalizedIdempotencyKey },
        select: {
          ...PAYMENT_SELECT,
          idempotencyPayload: true,
        },
      });
      const requestedPayload = {
        orderId,
        orderTotalAmount:
          requestedOrderTotal === null
            ? null
            : (requestedOrderTotal / 100).toFixed(2),
        amount: Number(paymentData.amount).toFixed(2),
        method: paymentData.method,
        status: paymentData.status,
        paidAt: data.paidAt === undefined ? null : paymentData.paidAt?.toISOString() ?? null,
        notes: paymentData.notes ?? null,
      };
      if (existingPayment) {
        const existingPayload = existingPayment.idempotencyPayload;
        if (JSON.stringify(existingPayload) !== JSON.stringify(requestedPayload)) {
          throw new ApiError(409, "Idempotency-Key was already used with a different payment payload.");
        }
        if (existingPayment.laboratoryId !== accessibleOrder.laboratoryId) {
          throw new ApiError(409, "Idempotency-Key was already used.");
        }
        return existingPayment;
      }

      const existingPayments = await tx.payment.findMany({
        where: {
          orderId,
          status: "PAID",
        },
        select: {
          amount: true,
        },
      });

      const establishedTotal =
        accessibleOrder.totalAmount === null ||
        accessibleOrder.totalAmount === undefined
          ? null
          : moneyToCents(accessibleOrder.totalAmount, "order total", true);

      if (establishedTotal === null && requestedOrderTotal === null) {
        throw new ApiError(
          400,
          "orderTotalAmount is required when recording the first payment.",
          { field: "orderTotalAmount" }
        );
      }

      if (establishedTotal !== null && requestedOrderTotal !== null) {
        throw new ApiError(
          409,
          "The bill has already been finalized and cannot be changed."
        );
      }

      const totalOrderAmountCents = establishedTotal ?? requestedOrderTotal;

      const alreadyPaidCents = existingPayments.reduce(
        (sum, p) => sum + moneyToCents(p.amount, "payment amount"),
        0
      );
      const paymentAmountCents = moneyToCents(paymentData.amount);
      const remainingBalanceCents = Math.max(
        0,
        totalOrderAmountCents - alreadyPaidCents
      );

      if (paymentAmountCents > remainingBalanceCents) {
        const remainingBalance = remainingBalanceCents / 100;
        throw new ApiError(
          400,
          `Payment amount (Rs. ${paymentData.amount}) exceeds remaining balance of Rs. ${remainingBalance.toFixed(2)}.`,
          {
            remainingBalance,
            totalOrderAmount: totalOrderAmountCents / 100,
            alreadyPaid: alreadyPaidCents / 100,
          }
        );
      }

      if (establishedTotal === null) {
        await tx.testOrder.update({
          where: { id: orderId },
          data: {
            totalAmount: totalOrderAmountCents / 100,
            billFinalizedAt: new Date(),
          },
        });
      }

      const payment = await tx.payment.create({
        data: {
          laboratoryId: accessibleOrder.laboratoryId,
          orderId,
          amount: paymentData.amount,
          method: paymentData.method,
          status: paymentData.status,
          paidAt: paymentData.paidAt,
          notes: paymentData.notes,
          idempotencyKey: normalizedIdempotencyKey,
          idempotencyPayload: requestedPayload,
        },
        select: PAYMENT_SELECT,
      });

      await recordAuditLog({
        laboratoryId: accessibleOrder.laboratoryId,
        userId: user.id,
        action: "PAYMENT_CREATED",
        entity: "Payment",
        entityId: payment.id,
        details: {
          orderId,
          amount: paymentData.amount,
          status: paymentData.status,
        },
        db: tx,
      });

      return payment;
    });
  } catch (error) {
    if (error?.code === "P2002") {
      throw new ApiError(409, "Idempotency-Key was already used.");
    }
    if (error?.code === "P2025") {
      throw new ApiError(404, "Payment not found.");
    }
    throw error;
  }
}

async function finalizeOrderBill({ user, orderId, totalAmount }) {
  const laboratoryId = assertBillFinalizationScope(user);
  assertUuid(orderId, "orderId");
  const requestedTotalCents = moneyToCents(totalAmount, "totalAmount");

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "test_orders" WHERE id = ${orderId}::uuid FOR UPDATE`;
    const order = await findAccessibleTestOrder({ user, orderId, db: tx });

    if (order.laboratoryId !== laboratoryId) {
      throw new ApiError(403, "You are not authorized to finalize this bill.");
    }

    if (order.totalAmount !== null && order.totalAmount !== undefined) {
      const establishedTotalCents = moneyToCents(
        order.totalAmount,
        "order total",
        true
      );
      if (establishedTotalCents !== requestedTotalCents) {
        throw new ApiError(
          409,
          "The bill has already been finalized and cannot be changed."
        );
      }

      return order;
    }

    const existingPayments = await tx.payment.findMany({
      where: {
        orderId,
        status: "PAID",
      },
      select: {
        amount: true,
      },
    });
    const alreadyPaidCents = existingPayments.reduce(
      (sum, payment) => sum + moneyToCents(payment.amount, "payment amount"),
      0
    );

    if (requestedTotalCents < alreadyPaidCents) {
      throw new ApiError(
        400,
        "Final bill cannot be less than the amount already paid.",
        {
          totalAmount: requestedTotalCents / 100,
          alreadyPaid: alreadyPaidCents / 100,
        }
      );
    }

    const finalizedAt = new Date();
    const updatedOrder = await tx.testOrder.update({
      where: { id: orderId },
      data: {
        totalAmount: requestedTotalCents / 100,
        billFinalizedAt: finalizedAt,
      },
    });

    await recordAuditLog({
      laboratoryId,
      userId: user.id,
      action: "BILL_FINALIZED",
      entity: "TestOrder",
      entityId: orderId,
      details: {
        totalAmount: requestedTotalCents / 100,
        alreadyPaid: alreadyPaidCents / 100,
      },
      db: tx,
    });

    return updatedOrder;
  });
}

async function listPayments({ user, query }) {
  const accessibleWhere = buildListWhere(user);
  const { page, limit } = parsePagination(query);
  const skip = (page - 1) * limit;

  const where = { ...accessibleWhere };

  if (query?.status) {
    const s = normalizeString(query.status).toUpperCase();
    if (VALID_PAYMENT_STATUSES.includes(s)) {
      where.status = s;
    }
  }

  if (query?.orderId) {
    assertUuid(query.orderId, "orderId");
    where.orderId = query.orderId;
  }

  if (query?.search) {
    const s = query.search.trim();
    where.OR = [
      { notes: { contains: s, mode: "insensitive" } },
      {
        order: {
          patient: {
            OR: [
              { name: { contains: s, mode: "insensitive" } },
              { fullName: { contains: s, mode: "insensitive" } },
              { cnic: { contains: s } },
            ],
          },
        },
      },
    ];
  }

  const [payments, total] = await prisma.$transaction([
    prisma.payment.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
      select: PAYMENT_SELECT,
    }),
    prisma.payment.count({ where }),
  ]);

  return {
    payments,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function getPaymentById({ user, paymentId }) {
  assertUuid(paymentId, "id");

  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      ...buildListWhere(user),
    },
    select: PAYMENT_SELECT,
  });

  if (!payment) {
    throw new ApiError(404, "Payment not found.");
  }

  return payment;
}

export {
  createPayment,
  finalizeOrderBill,
  listPayments,
  getPaymentById,
  getOrderBilling,
};
