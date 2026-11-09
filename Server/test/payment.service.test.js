import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/config/prisma.js";
import { createPayment } from "../src/services/payment.service.js";

const user = {
  id: "00000000-0000-0000-0000-000000000010",
  role: "LAB_ADMIN",
  laboratoryId: "00000000-0000-0000-0000-000000000001",
};

const order = {
  id: "00000000-0000-0000-0000-000000000020",
  laboratoryId: user.laboratoryId,
  status: "PENDING",
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  patient: null,
  orderedTestItems: [
    {
      id: "00000000-0000-0000-0000-000000000030",
      price: 20,
      testDefinition: { id: "test", code: "CBC", name: "CBC", price: 20 },
    },
  ],
  payments: [],
};

test("payment creation replays a request with the same idempotency key", async () => {
  const payment = {
    id: "00000000-0000-0000-0000-000000000040",
    laboratoryId: user.laboratoryId,
    orderId: order.id,
    status: "PAID",
    amount: 10,
    paidAt: null,
    notes: null,
    idempotencyPayload: {
      orderId: order.id,
      amount: "10.00",
      status: "PAID",
      paidAt: null,
      notes: null,
    },
    order,
  };
  let created = 0;
  const tx = {
    $queryRaw: async () => [],
    testOrder: { findFirst: async () => order },
    payment: {
      findUnique: async () => (created ? payment : null),
      findMany: async () => [],
      create: async () => {
        created += 1;
        return payment;
      },
    },
    auditLog: { create: async () => ({}) },
  };

  const originalTransaction = prisma.$transaction;
  prisma.$transaction = async (callback) => callback(tx);
  try {
    const first = await createPayment({
      user,
      data: { orderId: order.id, amount: 10 },
      idempotencyKey: "00000000-0000-4000-8000-000000000050",
    });
    const second = await createPayment({
      user,
      data: { orderId: order.id, amount: 10 },
      idempotencyKey: "00000000-0000-4000-8000-000000000050",
    });

    assert.equal(created, 1);
    assert.equal(first.id, second.id);
  } finally {
    prisma.$transaction = originalTransaction;
  }
});

test("payment creation rejects non-transaction statuses", async () => {
  await assert.rejects(
    createPayment({
      user,
      data: { orderId: order.id, amount: 10, status: "UNPAID" },
      idempotencyKey: "00000000-0000-4000-8000-000000000051",
    }),
    /must have PAID status/
  );
});

test("payment creation rejects positive payments for zero-price orders", async () => {
  const originalTransaction = prisma.$transaction;
  prisma.$transaction = async (callback) =>
    callback({
      $queryRaw: async () => [],
      testOrder: {
        findFirst: async () => ({
          ...order,
          orderedTestItems: [{ ...order.orderedTestItems[0], price: 0 }],
        }),
      },
      payment: {
        findUnique: async () => null,
        findMany: async () => [],
      },
    });

  try {
    await assert.rejects(
      createPayment({
        user,
        data: { orderId: order.id, amount: 1 },
        idempotencyKey: "00000000-0000-4000-8000-000000000052",
      }),
      /exceeds remaining balance/
    );
  } finally {
    prisma.$transaction = originalTransaction;
  }
});

test("payment creation rejects idempotency-key payload reuse", async () => {
  const originalTransaction = prisma.$transaction;
  prisma.$transaction = async (callback) =>
    callback({
      $queryRaw: async () => [],
      testOrder: { findFirst: async () => order },
      payment: {
        findUnique: async () => ({
          id: "00000000-0000-0000-0000-000000000070",
          laboratoryId: user.laboratoryId,
          idempotencyPayload: {
            orderId: order.id,
            amount: "10.00",
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
        user,
        data: { orderId: order.id, amount: 11 },
        idempotencyKey: "00000000-0000-4000-8000-000000000071",
      }),
      /different payment payload/
    );
  } finally {
    prisma.$transaction = originalTransaction;
  }
});

test("payment creation converts an idempotency unique-key race to conflict", async () => {
  const originalTransaction = prisma.$transaction;
  prisma.$transaction = async (callback) =>
    callback({
      $queryRaw: async () => [],
      testOrder: { findFirst: async () => order },
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
        user,
        data: { orderId: order.id, amount: 10 },
        idempotencyKey: "00000000-0000-4000-8000-000000000072",
      }),
      /Idempotency-Key was already used/
    );
  } finally {
    prisma.$transaction = originalTransaction;
  }
});

test("LAB_TECH users cannot create payments", async () => {
  await assert.rejects(
    createPayment({
      user: { ...user, role: "LAB_TECH" },
      data: { orderId: order.id, amount: 1 },
      idempotencyKey: "00000000-0000-4000-8000-000000000053",
    }),
    /not authorized to access payments/
  );
});

test("payment creation propagates required audit failures", async () => {
  const originalTransaction = prisma.$transaction;
  prisma.$transaction = async (callback) =>
    callback({
      $queryRaw: async () => [],
      testOrder: { findFirst: async () => order },
      payment: {
        findUnique: async () => null,
        findMany: async () => [],
        create: async () => ({
          id: "00000000-0000-0000-0000-000000000060",
          laboratoryId: user.laboratoryId,
          orderId: order.id,
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
        user,
        data: { orderId: order.id, amount: 10 },
        idempotencyKey: "00000000-0000-4000-8000-000000000061",
      }),
      /audit unavailable/
    );
  } finally {
    prisma.$transaction = originalTransaction;
  }
});
