import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/config/prisma.js";
import {
  createPayment,
  finalizeOrderBill,
  getOrderBilling,
} from "../src/services/payment.service.js";

const admin = {
  id: "00000000-0000-0000-0000-000000000010",
  role: "LAB_ADMIN",
  laboratoryId: "00000000-0000-0000-0000-000000000001",
};

const tech = { ...admin, role: "LAB_TECH" };
const superadmin = { ...admin, role: "SUPERADMIN", laboratoryId: null };
const orderId = "00000000-0000-0000-0000-000000000020";

function makeOrder(totalAmount = null, payments = []) {
  return {
    id: orderId,
    laboratoryId: admin.laboratoryId,
    status: "PENDING",
    notes: null,
    totalAmount: totalAmount === null ? null : Number(totalAmount).toFixed(2),
    billFinalizedAt: totalAmount === null ? null : new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    patient: null,
    orderedTestItems: [
      {
        id: "00000000-0000-0000-0000-000000000030",
        price: 9999,
        testDefinition: { id: "test", code: "CBC", name: "CBC", price: 9999 },
      },
    ],
    payments,
  };
}

function installTransaction(order, { auditError = false, serialize = false } = {}) {
  const state = {
    order,
    payments: [...order.payments],
    created: [],
    lockCalls: 0,
    updates: [],
  };
  let lockTail = Promise.resolve();
  let releaseCurrentLock = null;
  const tx = {
    $queryRaw: async () => {
      const previousLock = serialize ? lockTail : Promise.resolve();
      let releaseLock;
      if (serialize) {
        lockTail = new Promise((resolve) => {
          releaseLock = resolve;
        });
      }
      await previousLock;
      state.lockCalls += 1;
      if (serialize) {
        releaseCurrentLock = releaseLock;
      }
      if (!serialize) {
        releaseLock = () => {};
      }
      return [];
    },
    testOrder: {
      findFirst: async () => state.order,
      update: async ({ data }) => {
        state.updates.push(data);
        state.order = {
          ...state.order,
          ...data,
          ...(data.totalAmount !== undefined
            ? { totalAmount: Number(data.totalAmount).toFixed(2) }
            : {}),
        };
        releaseCurrentLock?.();
        releaseCurrentLock = null;
        return state.order;
      },
    },
    payment: {
      findUnique: async ({ where }) =>
        state.created.find((payment) => payment.idempotencyKey === where.idempotencyKey) || null,
      findMany: async () => state.payments,
      create: async ({ data }) => {
        const payment = {
          id: `00000000-0000-0000-0000-${String(state.created.length + 40).padStart(12, "0")}`,
          ...data,
          amount: Number(data.amount).toFixed(2),
          order: state.order,
        };
        state.created.push(payment);
        state.payments.push(payment);
        state.order = { ...state.order, payments: state.payments };
        releaseCurrentLock?.();
        releaseCurrentLock = null;
        return payment;
      },
    },
    auditLog: {
      create: async () => {
        if (auditError) {
          throw new Error("audit unavailable");
        }
        return {};
      },
    },
  };
  const originalTransaction = prisma.$transaction;
  const originalFindFirst = prisma.testOrder.findFirst;
  const initialOrder = state.order;
  const initialPayments = [...state.payments];
  prisma.$transaction = async (callback) => {
    try {
      return await callback(tx);
    } catch (error) {
      if (auditError) {
        state.order = initialOrder;
        state.payments = initialPayments;
        state.created = [];
        state.updates = [];
      }
      throw error;
    }
  };
  prisma.testOrder.findFirst = async () => state.order;
  return {
    state,
    restore: () => {
      prisma.$transaction = originalTransaction;
      prisma.testOrder.findFirst = originalFindFirst;
    },
  };
}

function key(number) {
  return `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
}

test("first payment establishes the final bill and stores the method", async () => {
  const mock = installTransaction(makeOrder());
  try {
    const payment = await createPayment({
      user: admin,
      data: { orderId, orderTotalAmount: 5000, amount: 2000, method: "CASH" },
      idempotencyKey: key(50),
    });

    assert.equal(Number(payment.amount), 2000);
    assert.equal(payment.method, "CASH");
    assert.equal(Number(mock.state.order.totalAmount), 5000);
    assert.equal(mock.state.updates.length, 1);
    assert.equal(mock.state.lockCalls, 1);
  } finally {
    mock.restore();
  }
});

test("full first payment leaves no remaining balance", async () => {
  const mock = installTransaction(makeOrder());
  try {
    await createPayment({
      user: admin,
      data: { orderId, orderTotalAmount: "5000.00", amount: "5000.00", method: "CARD" },
      idempotencyKey: key(51),
    });
    const billing = await getOrderBilling({ user: admin, orderId });
    assert.equal(billing.totalAmount, 5000);
    assert.equal(billing.paidAmount, 5000);
    assert.equal(billing.remainingAmount, 0);
    assert.equal(billing.status, "PAID");
  } finally {
    mock.restore();
  }
});

test("subsequent payments use the established bill and support partial payments", async () => {
  const first = {
    id: "00000000-0000-0000-0000-000000000040",
    amount: 2000,
    status: "PAID",
    method: "CASH",
    paidAt: new Date(),
  };
  const mock = installTransaction(makeOrder(5000, [first]));
  try {
    await createPayment({
      user: admin,
      data: { orderId, amount: 1000, method: "BANK_TRANSFER" },
      idempotencyKey: key(52),
    });
    const billing = await getOrderBilling({ user: admin, orderId });
    assert.equal(billing.paidAmount, 3000);
    assert.equal(billing.remainingAmount, 2000);
    assert.equal(billing.status, "PARTIALLY_PAID");
  } finally {
    mock.restore();
  }
});

test("overpayments and bill changes are rejected", async () => {
  const mock = installTransaction(makeOrder(5000));
  try {
    await assert.rejects(
      createPayment({
        user: admin,
        data: { orderId, amount: 5001, method: "CASH" },
        idempotencyKey: key(53),
      }),
      /exceeds remaining balance/
    );
    await assert.rejects(
      createPayment({
        user: admin,
        data: { orderId, orderTotalAmount: 6000, amount: 100, method: "CASH" },
        idempotencyKey: key(54),
      }),
      /already been finalized/
    );
  } finally {
    mock.restore();
  }
});

test("legacy orders require a bill before accepting a payment", async () => {
  const mock = installTransaction(makeOrder());
  try {
    await assert.rejects(
      createPayment({
        user: admin,
        data: { orderId, amount: 100, method: "CASH" },
        idempotencyKey: key(55),
      }),
      /orderTotalAmount is required/
    );
  } finally {
    mock.restore();
  }
});

test("legacy orders with existing payments preserve history while finalizing a bill", async () => {
  const historicalPayment = {
    id: "00000000-0000-0000-0000-000000000041",
    amount: 1500,
    status: "PAID",
    method: "OTHER",
    paidAt: new Date("2026-01-01T00:00:00Z"),
  };
  const mock = installTransaction(makeOrder(null, [historicalPayment]));
  try {
    await createPayment({
      user: admin,
      data: { orderId, orderTotalAmount: 5000, amount: 1000, method: "CASH" },
      idempotencyKey: key(62),
    });
    assert.equal(mock.state.created.length, 1);
    assert.equal(mock.state.payments[0], historicalPayment);
    assert.equal(mock.state.payments[0].amount, 1500);
    assert.equal(Number(mock.state.order.totalAmount), 5000);
  } finally {
    mock.restore();
  }
});

test("legacy billing with existing payments remains explicitly unbilled", async () => {
  const historicalPayment = {
    id: "00000000-0000-0000-0000-000000000042",
    amount: 1500,
    status: "PAID",
    method: "OTHER",
    paidAt: new Date("2026-01-01T00:00:00Z"),
  };
  const mock = installTransaction(makeOrder(null, [historicalPayment]));
  try {
    const billing = await getOrderBilling({ user: admin, orderId });
    assert.equal(billing.totalAmount, null);
    assert.equal(billing.paidAmount, 1500);
    assert.equal(billing.remainingAmount, null);
    assert.equal(billing.status, "UNBILLED");
  } finally {
    mock.restore();
  }
});

test("legacy order without payments can finalize without creating a payment", async () => {
  const mock = installTransaction(makeOrder());
  try {
    const billing = await finalizeOrderBill({
      user: admin,
      orderId,
      totalAmount: 5000,
    });

    assert.equal(Number(billing.totalAmount), 5000);
    assert.equal(mock.state.created.length, 0);
    assert.equal(mock.state.updates.length, 1);
  } finally {
    mock.restore();
  }
});

test("legacy order with payments equal to the final bill is finalized as paid", async () => {
  const historicalPayment = {
    id: "00000000-0000-0000-0000-000000000043",
    amount: 5000,
    status: "PAID",
    method: "OTHER",
    paidAt: new Date(),
  };
  const mock = installTransaction(makeOrder(null, [historicalPayment]));
  try {
    await finalizeOrderBill({ user: admin, orderId, totalAmount: 5000 });
    const billing = await getOrderBilling({ user: admin, orderId });
    assert.equal(billing.status, "PAID");
    assert.equal(billing.remainingAmount, 0);
    assert.equal(mock.state.created.length, 0);
  } finally {
    mock.restore();
  }
});

test("legacy order with payments below the final bill remains partially paid", async () => {
  const historicalPayment = {
    id: "00000000-0000-0000-0000-000000000044",
    amount: 3000,
    status: "PAID",
    method: "OTHER",
    paidAt: new Date(),
  };
  const mock = installTransaction(makeOrder(null, [historicalPayment]));
  try {
    await finalizeOrderBill({ user: admin, orderId, totalAmount: 5000 });
    const billing = await getOrderBilling({ user: admin, orderId });
    assert.equal(billing.status, "PARTIALLY_PAID");
    assert.equal(billing.remainingAmount, 2000);
    assert.equal(mock.state.created.length, 0);
  } finally {
    mock.restore();
  }
});

test("legacy order with payments above the final bill is rejected unchanged", async () => {
  const historicalPayment = {
    id: "00000000-0000-0000-0000-000000000045",
    amount: 6000,
    status: "PAID",
    method: "OTHER",
    paidAt: new Date(),
  };
  const mock = installTransaction(makeOrder(null, [historicalPayment]));
  try {
    await assert.rejects(
      finalizeOrderBill({ user: admin, orderId, totalAmount: 5000 }),
      /cannot be less than the amount already paid/
    );
    assert.equal(mock.state.order.totalAmount, null);
    assert.equal(mock.state.payments[0], historicalPayment);
    assert.equal(mock.state.created.length, 0);
  } finally {
    mock.restore();
  }
});

test("only LAB_ADMIN can finalize bills", async () => {
  for (const user of [tech, superadmin]) {
    const mock = installTransaction(makeOrder());
    try {
      await assert.rejects(
        finalizeOrderBill({ user, orderId, totalAmount: 5000 }),
        /Only LAB_ADMIN users can finalize bills/
      );
      assert.equal(mock.state.order.totalAmount, null);
    } finally {
      mock.restore();
    }
  }
});

test("repeated finalization with the same amount is idempotent", async () => {
  const mock = installTransaction(makeOrder());
  try {
    const first = await finalizeOrderBill({ user: admin, orderId, totalAmount: 5000 });
    const second = await finalizeOrderBill({ user: admin, orderId, totalAmount: 5000 });
    assert.equal(Number(first.totalAmount), 5000);
    assert.equal(Number(second.totalAmount), 5000);
    assert.equal(mock.state.updates.length, 1);
    assert.equal(mock.state.created.length, 0);
  } finally {
    mock.restore();
  }
});

test("repeated finalization with a different amount is rejected", async () => {
  const mock = installTransaction(makeOrder());
  try {
    await finalizeOrderBill({ user: admin, orderId, totalAmount: 5000 });
    await assert.rejects(
      finalizeOrderBill({ user: admin, orderId, totalAmount: 6000 }),
      /already been finalized/
    );
    assert.equal(Number(mock.state.order.totalAmount), 5000);
    assert.equal(mock.state.updates.length, 1);
  } finally {
    mock.restore();
  }
});

test("concurrent finalization requests cannot establish conflicting bills", async () => {
  const mock = installTransaction(makeOrder(), { serialize: true });
  try {
    const results = await Promise.allSettled([
      finalizeOrderBill({ user: admin, orderId, totalAmount: 5000 }),
      finalizeOrderBill({ user: admin, orderId, totalAmount: 6000 }),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    assert.equal(Number(mock.state.order.totalAmount), 5000);
    assert.equal(mock.state.lockCalls, 2);
  } finally {
    mock.restore();
  }
});

test("audit-log failure rolls back bill finalization", async () => {
  const mock = installTransaction(makeOrder(), { auditError: true });
  try {
    await assert.rejects(
      finalizeOrderBill({ user: admin, orderId, totalAmount: 5000 }),
      /audit unavailable/
    );
    assert.equal(mock.state.order.totalAmount, null);
    assert.equal(mock.state.order.billFinalizedAt, null);
    assert.equal(mock.state.created.length, 0);
  } finally {
    mock.restore();
  }
});

test("idempotency keys cannot be reused with a different payload", async () => {
  const originalTransaction = prisma.$transaction;
  prisma.$transaction = async (callback) =>
    callback({
      $queryRaw: async () => [],
      testOrder: { findFirst: async () => makeOrder(5000) },
      payment: {
        findUnique: async () => ({
          id: "00000000-0000-0000-0000-000000000070",
          laboratoryId: admin.laboratoryId,
          idempotencyPayload: {
            orderId,
            orderTotalAmount: "5000.00",
            amount: "10.00",
            method: "CASH",
            status: "PAID",
            paidAt: null,
            notes: null,
          },
        }),
      },
    });
  try {
    await assert.rejects(
      createPayment({
        user: admin,
        data: { orderId, orderTotalAmount: 5000, amount: 11, method: "CASH" },
        idempotencyKey: key(63),
      }),
      /different payment payload/
    );
  } finally {
    prisma.$transaction = originalTransaction;
  }
});

test("idempotency unique-key races return a conflict", async () => {
  const originalTransaction = prisma.$transaction;
  prisma.$transaction = async (callback) =>
    callback({
      $queryRaw: async () => [],
      testOrder: { findFirst: async () => makeOrder(5000) },
      payment: {
        findUnique: async () => null,
        findMany: async () => [],
        create: async () => {
          throw { code: "P2002" };
        },
      },
    });
  try {
    await assert.rejects(
      createPayment({
        user: admin,
        data: { orderId, amount: 10 },
        idempotencyKey: key(64),
      }),
      /Idempotency-Key was already used/
    );
  } finally {
    prisma.$transaction = originalTransaction;
  }
});

test("invalid payment statuses are rejected", async () => {
  await assert.rejects(
    createPayment({
      user: admin,
      data: { orderId, amount: 10, status: "INVALID" },
      idempotencyKey: key(65),
    }),
    /status must be a valid payment status/
  );
  await assert.rejects(
    createPayment({
      user: admin,
      data: { orderId, amount: 10, status: "UNPAID" },
      idempotencyKey: key(66),
    }),
    /must have PAID status/
  );
});

test("audit-log failures abort payment creation", async () => {
  const originalTransaction = prisma.$transaction;
  prisma.$transaction = async (callback) =>
    callback({
      $queryRaw: async () => [],
      testOrder: { findFirst: async () => makeOrder(5000) },
      payment: {
        findUnique: async () => null,
        findMany: async () => [],
        create: async () => ({
          id: "00000000-0000-0000-0000-000000000060",
          laboratoryId: admin.laboratoryId,
          orderId,
        }),
      },
      auditLog: {
        create: async () => {
          throw new Error("audit unavailable");
        },
      },
    });
  try {
    await assert.rejects(
      createPayment({
        user: admin,
        data: { orderId, amount: 10 },
        idempotencyKey: key(67),
      }),
      /audit unavailable/
    );
  } finally {
    prisma.$transaction = originalTransaction;
  }
});

test("LAB_TECH can view billing but cannot record payments", async () => {
  const mock = installTransaction(makeOrder(5000));
  try {
    const billing = await getOrderBilling({ user: tech, orderId });
    assert.equal(billing.totalAmount, 5000);
    await assert.rejects(
      createPayment({
        user: tech,
        data: { orderId, amount: 100 },
        idempotencyKey: key(56),
      }),
      /Only LAB_ADMIN users can record payments/
    );
  } finally {
    mock.restore();
  }
});

test("SUPERADMIN retains payment access but cannot change an established bill", async () => {
  const mock = installTransaction(makeOrder(5000));
  try {
    await createPayment({
      user: superadmin,
      data: { orderId, amount: 100, method: "OTHER" },
      idempotencyKey: key(57),
    });
    await assert.rejects(
      createPayment({
        user: superadmin,
        data: { orderId, orderTotalAmount: 6000, amount: 100 },
        idempotencyKey: key(58),
      }),
      /already been finalized/
    );
  } finally {
    mock.restore();
  }
});

test("duplicate idempotency requests create one payment", async () => {
  const mock = installTransaction(makeOrder());
  try {
    const data = { orderId, orderTotalAmount: 5000, amount: 1000, method: "CASH" };
    const first = await createPayment({ user: admin, data, idempotencyKey: key(59) });
    const second = await createPayment({ user: admin, data, idempotencyKey: key(59) });
    assert.equal(first.id, second.id);
    assert.equal(mock.state.created.length, 1);
  } finally {
    mock.restore();
  }
});

test("concurrent first payments serialize on the order lock", async () => {
  const mock = installTransaction(makeOrder(), { serialize: true });
  try {
    const requests = [
      createPayment({
        user: admin,
        data: { orderId, orderTotalAmount: 5000, amount: 1000 },
        idempotencyKey: key(60),
      }),
      createPayment({
        user: admin,
        data: { orderId, orderTotalAmount: 6000, amount: 1000 },
        idempotencyKey: key(61),
      }),
    ];
    const results = await Promise.allSettled(requests);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    assert.equal(mock.state.lockCalls, 2);
    assert.equal(Number(mock.state.order.totalAmount), 5000);
  } finally {
    mock.restore();
  }
});
