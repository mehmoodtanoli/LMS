import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/config/prisma.js";
import {
  createTestOrder,
  updateTestOrder,
} from "../src/services/test-order.service.js";

const user = {
  id: "00000000-0000-0000-0000-000000000010",
  role: "LAB_ADMIN",
  laboratoryId: "00000000-0000-0000-0000-000000000001",
};
const patientId = "00000000-0000-0000-0000-000000000020";
const testId = "00000000-0000-0000-0000-000000000030";

test("order creation does not copy catalog prices into ordered items", async () => {
  const originals = {
    patient: prisma.patient.findFirst,
    definition: prisma.testDefinition.findFirst,
    order: prisma.testOrder.create,
    transaction: prisma.$transaction,
    audit: prisma.auditLog.create,
  };
  prisma.$transaction = async (callback) =>
    callback({
      laboratory: { update: async () => ({ orderCounter: 7 }) },
      testOrder: { create: (args) => prisma.testOrder.create(args) },
    });
  prisma.auditLog.create = async () => ({});
  let orderData;
  prisma.patient.findFirst = async () => ({
    id: patientId,
    laboratoryId: user.laboratoryId,
    name: "Patient",
    fullName: null,
    cnic: null,
    phone: null,
    age: 30,
    ageUnit: "YEARS",
    gender: "OTHER",
    address: null,
  });

  test("established billing fields cannot be changed through order updates", async () => {
    await assert.rejects(
      updateTestOrder({
        user,
        orderId: "00000000-0000-0000-0000-000000000040",
        data: { totalAmount: 1 },
      }),
      /totalAmount/
    );
    await assert.rejects(
      updateTestOrder({
        user,
        orderId: "00000000-0000-0000-0000-000000000040",
        data: { billFinalizedAt: null },
      }),
      /billFinalizedAt/
    );
  });
  prisma.testDefinition.findFirst = async () => ({
    id: testId,
    laboratoryId: user.laboratoryId,
    code: "CBC",
    name: "Complete Blood Count",
    price: 9999,
    parameters: [],
  });
  prisma.testOrder.create = async ({ data, select }) => {
    orderData = data;
    return {
      id: "00000000-0000-0000-0000-000000000040",
      laboratoryId: user.laboratoryId,
      patientId,
      status: "PENDING",
      notes: null,
      totalAmount: null,
      billFinalizedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      laboratory: { id: user.laboratoryId, name: "Lab" },
      patient: { id: patientId },
      orderedTestItems: [],
      ...select,
    };
  };

  try {
    await createTestOrder({
      user,
      data: { patientId, testDefinitionIds: [testId] },
    });
    assert.deepEqual(orderData.orderedTestItems.create, [
      { testDefinitionId: testId },
    ]);
    assert.equal(orderData.orderNumber, 7);
  } finally {
    prisma.patient.findFirst = originals.patient;
    prisma.testDefinition.findFirst = originals.definition;
    prisma.testOrder.create = originals.order;
    prisma.$transaction = originals.transaction;
    prisma.auditLog.create = originals.audit;
  }
});

async function withOrder(order, fn) {
  const originals = { find: prisma.testOrder.findFirst, update: prisma.testOrder.update };
  prisma.testOrder.findFirst = async () => order;
  prisma.testOrder.update = async ({ data }) => ({ ...order, ...data });
  try {
    return await fn();
  } finally {
    prisma.testOrder.findFirst = originals.find;
    prisma.testOrder.update = originals.update;
  }
}

const orderId = "00000000-0000-0000-0000-000000000041";

test("order status: cancelled and completed orders cannot change", async () => {
  await withOrder({ id: orderId, laboratoryId: user.laboratoryId, status: "CANCELLED", payments: [] }, () =>
    assert.rejects(updateTestOrder({ user, orderId, data: { status: "COMPLETED" } }), { statusCode: 409 })
  );
  await withOrder({ id: orderId, laboratoryId: user.laboratoryId, status: "COMPLETED", payments: [] }, () =>
    assert.rejects(updateTestOrder({ user, orderId, data: { status: "PENDING" } }), { statusCode: 409 })
  );
});

test("order status: admins may cancel paid orders, lab techs cannot cancel", async () => {
  const originalAudit = prisma.auditLog.create;
  let auditDetails;
  prisma.auditLog.create = async ({ data }) => { auditDetails = data.details; return {}; };
  try {
    await withOrder({ id: orderId, laboratoryId: user.laboratoryId, status: "PENDING", payments: [{ id: "p" }] }, async () => {
      const updated = await updateTestOrder({ user, orderId, data: { status: "CANCELLED" } });
      assert.equal(updated.status, "CANCELLED");
    });
    assert.deepEqual(auditDetails.cancelledWithPaidPayments, ["p"]);
  } finally {
    prisma.auditLog.create = originalAudit;
  }
  const tech = { ...user, role: "LAB_TECH" };
  await withOrder({ id: orderId, laboratoryId: user.laboratoryId, status: "PENDING", payments: [] }, () =>
    assert.rejects(updateTestOrder({ user: tech, orderId, data: { status: "CANCELLED" } }), { statusCode: 403 })
  );
});

test("new orders cannot start in a non-PENDING status", async () => {
  const original = prisma.patient.findFirst;
  prisma.patient.findFirst = async () => ({ id: patientId, laboratoryId: user.laboratoryId });
  const originalDef = prisma.testDefinition.findFirst;
  prisma.testDefinition.findFirst = async () => ({ id: testId, laboratoryId: user.laboratoryId, parameters: [] });
  try {
    for (const status of ["CANCELLED", "COMPLETED"]) {
      await assert.rejects(
        createTestOrder({ user: { ...user, role: "LAB_TECH" }, data: { patientId, testDefinitionIds: [testId], status } }),
        { statusCode: 400 }
      );
    }
  } finally {
    prisma.patient.findFirst = original;
    prisma.testDefinition.findFirst = originalDef;
  }
});
