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
  };
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
  } finally {
    prisma.patient.findFirst = originals.patient;
    prisma.testDefinition.findFirst = originals.definition;
    prisma.testOrder.create = originals.order;
  }
});
