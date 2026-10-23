import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";
import {
  assertUuid,
  parsePagination,
  normalizeString,
  normalizeOptionalString,
} from "../utils/validators.js";
import { recordAuditLog } from "../utils/audit.js";

const VALID_PAYMENT_STATUSES = ["UNPAID", "PARTIALLY_PAID", "PAID", "REFUNDED"];

const PAYMENT_SELECT = {
  id: true,
  laboratoryId: true,
  orderId: true,
  status: true,
  amount: true,
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

function assertLabAdminScope(user) {
  if (user.role === "SUPERADMIN") {
    return null;
  }

  if (user.role === "LAB_ADMIN" || user.role === "LAB_TECH") {
    if (!user.laboratoryId) {
      throw new ApiError(
        403,
        "User must be assigned to a laboratory before managing payments."
      );
    }

    return user.laboratoryId;
  }

  throw new ApiError(403, "You are not authorized to access payments.");
}

function buildListWhere(user) {
  const laboratoryId = assertLabAdminScope(user);

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
    numericValue = Number(trimmed);
  } else if (typeof value === "number") {
    numericValue = value;
  } else {
    throw new ApiError(400, "amount must be a positive number.", {
      field: "amount",
    });
  }

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
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

  // If status is omitted, server sets PAID (Fixes A3)
  paymentData.status = data.status ? normalizePaymentStatus(data.status) : "PAID";

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

async function findAccessibleTestOrder({ user, orderId }) {
  assertUuid(orderId, "orderId");

  const laboratoryId = assertLabAdminScope(user);

  const order = await prisma.testOrder.findFirst({
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

  let totalAmount = 0;
  const items = (order.orderedTestItems || []).map((item) => {
    const itemPrice = Number(item.price || item.testDefinition?.price || 0);
    totalAmount += itemPrice;
    return {
      id: item.id,
      testCode: item.testDefinition?.code,
      testName: item.testDefinition?.name,
      price: itemPrice,
    };
  });

  let paidAmount = 0;
  (order.payments || []).forEach((p) => {
    if (p.status === "PAID") {
      paidAmount += Number(p.amount || 0);
    }
  });

  const remainingAmount = Math.max(0, totalAmount - paidAmount);
  let status = "UNPAID";
  if (paidAmount >= totalAmount && totalAmount > 0) {
    status = "PAID";
  } else if (paidAmount > 0) {
    status = "PARTIALLY_PAID";
  }

  return {
    orderId: order.id,
    patient: order.patient,
    totalAmount,
    paidAmount,
    remainingAmount,
    status,
    items,
    payments: order.payments,
  };
}

async function createPayment({ user, data }) {
  const orderId = normalizeString(data.orderId);

  if (!orderId) {
    throw new ApiError(400, "orderId is required.", { field: "orderId" });
  }

  const paymentData = buildPaymentData(data);

  if (paymentData.amount === undefined) {
    throw new ApiError(400, "amount is required.", { field: "amount" });
  }

  const accessibleOrder = await findAccessibleTestOrder({ user, orderId });

  try {
    return await prisma.$transaction(async (tx) => {
      // Re-fetch existing payments inside transaction to guarantee atomic balance check (Fixes M2)
      const existingPayments = await tx.payment.findMany({
        where: {
          orderId,
          status: "PAID",
        },
        select: {
          amount: true,
        },
      });

      let totalOrderAmount = 0;
      accessibleOrder.orderedTestItems.forEach((item) => {
        totalOrderAmount += Number(item.price || item.testDefinition?.price || 0);
      });

      const alreadyPaid = existingPayments.reduce(
        (sum, p) => sum + Number(p.amount || 0),
        0
      );
      const remainingBalance = Math.max(0, totalOrderAmount - alreadyPaid);

      // Overpayment cap: check only if order has items with prices
      if (totalOrderAmount > 0 && paymentData.amount > remainingBalance + 0.001) {
        throw new ApiError(
          400,
          `Payment amount (Rs. ${paymentData.amount}) exceeds remaining balance of Rs. ${remainingBalance.toFixed(2)}.`,
          {
            remainingBalance,
            totalOrderAmount,
            alreadyPaid,
          }
        );
      }

      const payment = await tx.payment.create({
        data: {
          laboratoryId: accessibleOrder.laboratoryId,
          orderId,
          amount: paymentData.amount,
          status: paymentData.status,
          paidAt: paymentData.paidAt,
          notes: paymentData.notes,
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
      });

      return payment;
    });
  } catch (error) {
    if (error?.code === "P2025") {
      throw new ApiError(404, "Payment not found.");
    }
    throw error;
  }
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
  listPayments,
  getPaymentById,
  getOrderBilling,
};
