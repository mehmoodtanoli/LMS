import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_PAYMENT_STATUSES = ["UNPAID", "PARTIALLY_PAID", "PAID", "REFUNDED"];
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

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
          laboratoryId: true,
        },
      },
    },
  },
};

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalString(value) {
  const normalizedValue = normalizeString(value);
  return normalizedValue ? normalizedValue : undefined;
}

function assertUuid(value, fieldName) {
  if (!UUID_PATTERN.test(value)) {
    throw new ApiError(400, `${fieldName} must be a valid UUID.`, {
      field: fieldName,
    });
  }
}

function assertLabAdminScope(user) {
  if (user.role === "SUPERADMIN") {
    return null;
  }

  if (user.role === "LAB_ADMIN") {
    if (!user.laboratoryId) {
      throw new ApiError(
        403,
        "LAB_ADMIN users must be assigned to a laboratory before managing payments.",
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

function parsePagination(query) {
  const pageValue = query?.page ?? DEFAULT_PAGE;
  const limitValue = query?.limit ?? DEFAULT_LIMIT;
  const page = Number(pageValue);
  const limit = Number(limitValue);

  if (!Number.isInteger(page) || page < 1) {
    throw new ApiError(400, "page must be a positive integer.", {
      field: "page",
    });
  }

  if (!Number.isInteger(limit) || limit < 1) {
    throw new ApiError(400, "limit must be a positive integer.", {
      field: "limit",
    });
  }

  return {
    page,
    limit: Math.min(limit, MAX_LIMIT),
  };
}

function normalizePaymentStatus(value) {
  const normalizedValue = normalizeString(value).toUpperCase();

  if (!normalizedValue) {
    return undefined;
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
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    throw new ApiError(400, "amount is required.", { field: "amount" });
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      throw new ApiError(400, "amount is required.", { field: "amount" });
    }

    return trimmedValue;
  }

  return value;
}

function buildPaymentData(data) {
  const paymentData = {};

  if (data.amount !== undefined) {
    paymentData.amount = normalizePaymentAmount(data.amount);
  }

  if (data.status !== undefined) {
    paymentData.status = normalizePaymentStatus(data.status);
  }

  if (data.paidAt !== undefined) {
    if (data.paidAt === null || data.paidAt === "") {
      paymentData.paidAt = null;
    } else {
      const paidAt = new Date(data.paidAt);

      if (Number.isNaN(paidAt.getTime())) {
        throw new ApiError(400, "paidAt must be a valid date when provided.", {
          field: "paidAt",
        });
      }

      paymentData.paidAt = paidAt;
    }
  }

  if (data.notes !== undefined) {
    const notes = normalizeOptionalString(data.notes);

    if (data.notes !== null && data.notes !== undefined && !notes) {
      throw new ApiError(400, "notes cannot be empty if provided.", {
        field: "notes",
      });
    }

    if (notes !== undefined) {
      paymentData.notes = notes;
    }
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
          laboratoryId: true,
        },
      },
    },
  });

  if (!order) {
    throw new ApiError(404, "Test order not found.");
  }

  return order;
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

  const order = await findAccessibleTestOrder({ user, orderId });

  try {
    return await prisma.payment.create({
      data: {
        laboratoryId: order.laboratoryId,
        orderId,
        ...paymentData,
      },
      select: PAYMENT_SELECT,
    });
  } catch (error) {
    if (error?.code === "P2025") {
      throw new ApiError(404, "Payment not found.");
    }

    throw error;
  }
}

async function listPayments({ user, query }) {
  const where = buildListWhere(user);
  const { page, limit } = parsePagination(query);
  const skip = (page - 1) * limit;

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

export { createPayment, listPayments, getPaymentById };