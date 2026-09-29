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
          status: true,
          amount: true,
          paidAt: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  },
};

const PAYMENT_ORDER_SELECT = {
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
      status: true,
      amount: true,
      paidAt: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "asc",
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

/**
 * Payment management is intentionally restricted to:
 *
 * SUPERADMIN:
 *   Can manage payments across all laboratories.
 *
 * LAB_ADMIN:
 *   Can manage payments only inside their assigned laboratory.
 *
 * LAB_TECH:
 *   Cannot access payment functionality.
 */
function assertPaymentAccess(user) {
  if (!user?.role) {
    throw new ApiError(403, "You are not authorized to access payments.");
  }

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
  const laboratoryId = assertPaymentAccess(user);

  if (laboratoryId) {
    return {
      laboratoryId,
    };
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
    throw new ApiError(400, "amount is required.", {
      field: "amount",
    });
  }

  let numericValue;

  if (typeof value === "string") {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      throw new ApiError(400, "amount is required.", {
        field: "amount",
      });
    }

    numericValue = Number(trimmedValue);
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

  /*
   * Money is stored with two decimal places.
   * Reject values with more than two decimal places instead
   * of silently rounding them.
   *
   * Using the original string when available prevents values such
   * as "100.123" from being accepted.
   */
  const sourceValue = typeof value === "string" ? value.trim() : String(value);

  const decimalPart = sourceValue.split(".")[1] || "";

  if (decimalPart.length > 2) {
    throw new ApiError(
      400,
      "amount cannot have more than two decimal places.",
      {
        field: "amount",
      },
    );
  }

  return numericValue;
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

/**
 * Convert Prisma Decimal/string/number values into a Number
 * for simple money calculations.
 *
 * Database values remain Decimal in Prisma.
 */
function toNumber(value) {
  if (value === null || value === undefined) {
    return 0;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    throw new ApiError(500, "Invalid monetary value encountered.");
  }

  return numericValue;
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate billing information for an order.
 *
 * The price stored on OrderedTestItem is used because it is a
 * historical snapshot of the price at the time the test was ordered.
 *
 * Changing TestDefinition.price later will therefore NOT change
 * old orders.
 */
function calculateOrderBilling(order) {
  const totalAmount = roundMoney(
    (order.orderedTestItems || []).reduce(
      (sum, item) => sum + toNumber(item.price),
      0,
    ),
  );

  /**
   * Only payments that are not refunded count toward the
   * amount actually received.
   */
  const paidAmount = roundMoney(
    (order.payments || [])
      .filter((payment) => payment.status !== "REFUNDED")
      .reduce((sum, payment) => sum + toNumber(payment.amount), 0),
  );

  const remainingAmount = roundMoney(Math.max(totalAmount - paidAmount, 0));

  let paymentStatus = "UNPAID";

  if (paidAmount >= totalAmount && totalAmount > 0) {
    paymentStatus = "PAID";
  } else if (paidAmount > 0) {
    paymentStatus = "PARTIALLY_PAID";
  }

  return {
    totalAmount,
    paidAmount,
    remainingAmount,
    paymentStatus,
  };
}

/**
 * Find an order accessible to the current user.
 */
async function findAccessibleTestOrder({ user, orderId }) {
  assertUuid(orderId, "orderId");

  const laboratoryId = assertPaymentAccess(user);

  const order = await prisma.testOrder.findFirst({
    where: laboratoryId
      ? {
          id: orderId,
          laboratoryId,
        }
      : {
          id: orderId,
        },
    select: PAYMENT_ORDER_SELECT,
  });

  if (!order) {
    throw new ApiError(404, "Test order not found.");
  }

  return order;
}

/**
 * Ensure an order has at least one priced test.
 */
function assertOrderHasValidTotal(order) {
  const billing = calculateOrderBilling(order);

  if (billing.totalAmount <= 0) {
    throw new ApiError(
      400,
      "This order does not have a valid billable total. Add priced tests before recording payment.",
    );
  }

  return billing;
}

/**
 * Create a payment against an order.
 *
 * The payment cannot exceed the remaining balance.
 *
 * The client does not need to calculate the remaining amount itself;
 * the server calculates it from the database.
 */
async function createPayment({ user, data }) {
  const orderId = normalizeString(data.orderId);

  if (!orderId) {
    throw new ApiError(400, "orderId is required.", {
      field: "orderId",
    });
  }

  const paymentData = buildPaymentData(data);

  if (paymentData.amount === undefined) {
    throw new ApiError(400, "amount is required.", {
      field: "amount",
    });
  }

  const order = await findAccessibleTestOrder({
    user,
    orderId,
  });

  const billing = assertOrderHasValidTotal(order);
  const paymentAmount = toNumber(paymentData.amount);

  if (paymentAmount > billing.remainingAmount) {
    throw new ApiError(
      400,
      `Payment amount cannot exceed the remaining balance of ${billing.remainingAmount.toFixed(
        2,
      )}.`,
      {
        field: "amount",
        totalAmount: billing.totalAmount,
        paidAmount: billing.paidAmount,
        remainingAmount: billing.remainingAmount,
      },
    );
  }

  /**
   * Payment rows represent actual payment transactions.
   *
   * If the caller does not provide a status, treat the transaction
   * itself as PAID. The overall order payment state is calculated
   * separately from all transactions.
   */
  if (paymentData.status && paymentData.status !== "PAID") {
    throw new ApiError(400, "New payment transactions must have PAID status.", {
      field: "status",
      validValues: ["PAID"],
    });
  }

  paymentData.status = "PAID";

  /**
   * A positive payment should have a paidAt timestamp.
   * If one is not supplied, use the current server time.
   */
  if (paymentData.paidAt === undefined) {
    paymentData.paidAt = new Date();
  }

  try {
    const payment = await prisma.payment.create({
      data: {
        laboratoryId: order.laboratoryId,
        orderId,
        ...paymentData,
      },
      select: PAYMENT_SELECT,
    });

    /**
     * Recalculate billing after creation so the response contains
     * the current order-level billing state.
     */
    const updatedOrder = await prisma.testOrder.findUnique({
      where: {
        id: orderId,
      },
      select: PAYMENT_ORDER_SELECT,
    });

    if (!updatedOrder) {
      throw new ApiError(404, "Test order not found.");
    }

    const updatedBilling = calculateOrderBilling(updatedOrder);

    return {
      ...payment,
      billing: updatedBilling,
    };
  } catch (error) {
    if (error?.code === "P2003") {
      throw new ApiError(400, "Invalid order or laboratory reference.");
    }

    if (error?.code === "P2025") {
      throw new ApiError(404, "Payment or test order not found.");
    }

    throw error;
  }
}

/**
 * List payments.
 */
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

    prisma.payment.count({
      where,
    }),
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

/**
 * Get one payment.
 *
 * Includes the order's current billing summary so the frontend
 * can immediately show:
 *
 * Total
 * Paid
 * Remaining
 * Payment status
 */
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

  const billing = calculateOrderBilling(payment.order);

  return {
    ...payment,
    billing,
  };
}

/**
 * Get billing information for a test order.
 *
 * This is useful for the order/payment screen:
 *
 * GET /payments/order/:orderId
 *
 * The route/controller can expose this service method if needed.
 */
async function getOrderBilling({ user, orderId }) {
  const order = await findAccessibleTestOrder({
    user,
    orderId,
  });

  const billing = calculateOrderBilling(order);

  return {
    order: {
      id: order.id,
      laboratoryId: order.laboratoryId,
      status: order.status,
      notes: order.notes,
      patient: order.patient,
    },

    items: order.orderedTestItems.map((item) => ({
      id: item.id,
      testDefinition: item.testDefinition,
      price: roundMoney(toNumber(item.price)),
    })),

    payments: order.payments.map((payment) => ({
      id: payment.id,
      status: payment.status,
      amount: roundMoney(toNumber(payment.amount)),
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
    })),

    billing,
  };
}

export { createPayment, listPayments, getPaymentById, getOrderBilling };
