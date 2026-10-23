import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";
import {
  assertUuid,
  parsePagination,
  normalizeString,
  normalizeOptionalString,
} from "../utils/validators.js";
import { recordAuditLog } from "../utils/audit.js";

const VALID_ORDER_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

const TEST_ORDER_SELECT = {
  id: true,
  laboratoryId: true,
  patientId: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,

  laboratory: {
    select: {
      id: true,
      name: true,
    },
  },

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
      notes: true,

      testDefinition: {
        select: {
          id: true,
          code: true,
          name: true,
          price: true,
          laboratoryId: true,

          parameters: {
            orderBy: {
              order: "asc",
            },
            select: {
              id: true,
              name: true,
              unit: true,
              referenceRange: true,
              order: true,
            },
          },
        },
      },

      result: {
        select: {
          id: true,
          status: true,
          value: true,
          unit: true,
          referenceRange: true,
          interpretation: true,
          notes: true,
          finalizedAt: true,
          finalizedById: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  },
};

function normalizeOrderStatus(value) {
  const normalizedValue = normalizeString(value).toUpperCase();

  if (!normalizedValue) {
    return undefined;
  }

  if (!VALID_ORDER_STATUSES.includes(normalizedValue)) {
    throw new ApiError(400, "status must be a valid test order status.", {
      field: "status",
      validValues: VALID_ORDER_STATUSES,
    });
  }

  return normalizedValue;
}

function assertLabAdminScope(user) {
  if (user.role === "SUPERADMIN") {
    return null;
  }

  if (user.role === "LAB_ADMIN" || user.role === "LAB_TECH") {
    if (!user.laboratoryId) {
      throw new ApiError(
        403,
        "User must be assigned to a laboratory before accessing test orders."
      );
    }

    return user.laboratoryId;
  }

  throw new ApiError(403, "You are not authorized to access test orders.");
}

function getLabAdminLaboratoryId(user) {
  const laboratoryId = assertLabAdminScope(user);

  if (!laboratoryId) {
    throw new ApiError(
      403,
      "LAB_ADMIN users must be assigned to a laboratory before managing test orders."
    );
  }

  return laboratoryId;
}

function buildListWhere(user) {
  const laboratoryId = assertLabAdminScope(user);

  if (laboratoryId) {
    return { laboratoryId };
  }

  return {};
}

function buildOrderUpdateData(data) {
  const updateData = {};

  if (data.status !== undefined) {
    updateData.status = normalizeOrderStatus(data.status);
  }

  if (data.notes !== undefined) {
    const notes = normalizeOptionalString(data.notes);
    updateData.notes = notes ?? null;
  }

  return updateData;
}

function assertNoImmutableOverrides(data) {
  const immutableFields = ["patientId", "laboratoryId"];

  const providedFields = immutableFields.filter(
    (field) => data[field] !== undefined
  );

  if (providedFields.length > 0) {
    throw new ApiError(
      400,
      "patientId and laboratoryId cannot be changed on an existing order.",
      {
        fields: providedFields,
      }
    );
  }
}

function handlePrismaError(error) {
  if (error?.code === "P2003") {
    throw new ApiError(
      409,
      "This test order cannot be deleted because related records (results or payments) already exist.",
      {
        field: error.meta?.field_name ?? null,
      }
    );
  }

  if (
    typeof error?.message === "string" &&
    error.message.includes("violates RESTRICT setting of foreign key constraint")
  ) {
    throw new ApiError(
      409,
      "This test order cannot be deleted because related records already exist."
    );
  }

  if (error?.code === "P2025") {
    throw new ApiError(404, "Test order not found.");
  }

  throw error;
}

async function findAccessiblePatient({ user, patientId }) {
  assertUuid(patientId, "patientId");

  const laboratoryId =
    user.role === "LAB_ADMIN" || user.role === "LAB_TECH"
      ? getLabAdminLaboratoryId(user)
      : null;

  const patient = await prisma.patient.findFirst({
    where: laboratoryId
      ? {
          id: patientId,
          laboratoryId,
        }
      : {
          id: patientId,
        },

    select: {
      id: true,
      laboratoryId: true,
      name: true,
      fullName: true,
      cnic: true,
      phone: true,
      age: true,
      ageUnit: true,
      gender: true,
      address: true,
    },
  });

  if (!patient) {
    throw new ApiError(404, "Patient not found.");
  }

  return patient;
}

async function findAccessibleTestDefinition({ user, testDefinitionId }) {
  assertUuid(testDefinitionId, "testDefinitionId");

  const laboratoryId =
    user.role === "LAB_ADMIN" || user.role === "LAB_TECH"
      ? getLabAdminLaboratoryId(user)
      : null;

  const testDefinition = await prisma.testDefinition.findFirst({
    where: laboratoryId
      ? {
          id: testDefinitionId,
          OR: [
            {
              laboratoryId,
            },
            {
              laboratoryId: null,
            },
          ],
        }
      : {
          id: testDefinitionId,
        },

    select: {
      id: true,
      laboratoryId: true,
      code: true,
      name: true,
      price: true,

      parameters: {
        orderBy: {
          order: "asc",
        },

        select: {
          id: true,
          name: true,
          unit: true,
          referenceRange: true,
          order: true,
        },
      },
    },
  });

  if (!testDefinition) {
    throw new ApiError(404, `Test definition not found: ${testDefinitionId}`);
  }

  return testDefinition;
}

function assertSameLaboratory(patient, testDefinition) {
  // Global test templates can be used by any laboratory.
  if (testDefinition.laboratoryId === null) {
    return;
  }

  if (patient.laboratoryId !== testDefinition.laboratoryId) {
    throw new ApiError(
      400,
      "Patient and test definition must belong to the same laboratory.",
      {
        fields: ["patientId", "testDefinitionId"],
      }
    );
  }
}

async function createTestOrder({ user, data }) {
  const patientId = normalizeString(data.patientId);

  if (!patientId) {
    throw new ApiError(400, "patientId is required.", {
      field: "patientId",
    });
  }

  // Support both single testDefinitionId or multiple testDefinitionIds array
  const rawTestIds = data.testDefinitionIds || (data.testDefinitionId ? [data.testDefinitionId] : []);
  const testDefinitionIds = Array.isArray(rawTestIds)
    ? [...new Set(rawTestIds.map((id) => normalizeString(id)).filter(Boolean))]
    : [];

  if (testDefinitionIds.length === 0) {
    throw new ApiError(400, "At least one testDefinitionId is required.", {
      field: "testDefinitionId",
    });
  }

  const patient = await findAccessiblePatient({
    user,
    patientId,
  });

  // Verify all test definitions and snapshot their prices (Fixes A1, Historical Integrity)
  const testDefinitions = [];
  for (const testId of testDefinitionIds) {
    const testDef = await findAccessibleTestDefinition({
      user,
      testDefinitionId: testId,
    });
    assertSameLaboratory(patient, testDef);
    testDefinitions.push(testDef);
  }

  const derivedLaboratoryId = patient.laboratoryId;

  const notes = normalizeOptionalString(data.notes);
  const status =
    data.status === undefined ? undefined : normalizeOrderStatus(data.status);

  try {
    const order = await prisma.testOrder.create({
      data: {
        laboratoryId: derivedLaboratoryId,
        patientId,

        ...(status ? { status } : {}),
        ...(notes !== undefined ? { notes } : {}),

        orderedTestItems: {
          create: testDefinitions.map((testDef) => ({
            testDefinitionId: testDef.id,
            price: testDef.price || 0, // Snapshot price at order time (Fixes A1, M2)
          })),
        },
      },

      select: TEST_ORDER_SELECT,
    });

    await recordAuditLog({
      laboratoryId: derivedLaboratoryId,
      userId: user.id,
      action: "TEST_ORDER_CREATED",
      entity: "TestOrder",
      entityId: order.id,
      details: {
        patientId,
        testIds: testDefinitionIds,
        totalItems: testDefinitions.length,
      },
    });

    return order;
  } catch (error) {
    handlePrismaError(error);
  }
}

async function listTestOrders({ user, query }) {
  const accessibleWhere = buildListWhere(user);
  const { page, limit } = parsePagination(query);
  const skip = (page - 1) * limit;

  const where = { ...accessibleWhere };

  if (query?.status) {
    where.status = normalizeOrderStatus(query.status);
  }

  if (query?.patientId) {
    assertUuid(query.patientId, "patientId");
    where.patientId = query.patientId;
  }

  if (query?.search) {
    const s = query.search.trim();
    where.patient = {
      OR: [
        { name: { contains: s, mode: "insensitive" } },
        { fullName: { contains: s, mode: "insensitive" } },
        { cnic: { contains: s } },
        { phone: { contains: s } },
      ],
    };
  }

  const [orders, total] = await prisma.$transaction([
    prisma.testOrder.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
      select: TEST_ORDER_SELECT,
    }),

    prisma.testOrder.count({
      where,
    }),
  ]);

  return {
    orders,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function getTestOrderById({ user, orderId }) {
  assertUuid(orderId, "id");

  const order = await prisma.testOrder.findFirst({
    where: {
      id: orderId,
      ...buildListWhere(user),
    },

    select: TEST_ORDER_SELECT,
  });

  if (!order) {
    throw new ApiError(404, "Test order not found.");
  }

  return order;
}

async function updateTestOrder({ user, orderId, data }) {
  assertUuid(orderId, "id");

  assertNoImmutableOverrides(data);

  const order = await prisma.testOrder.findFirst({
    where: {
      id: orderId,
      ...buildListWhere(user),
    },

    select: {
      id: true,
      laboratoryId: true,
      status: true,
    },
  });

  if (!order) {
    throw new ApiError(404, "Test order not found.");
  }

  const updateData = buildOrderUpdateData(data);

  if (Object.keys(updateData).length === 0) {
    throw new ApiError(
      400,
      "At least one editable order field must be provided."
    );
  }

  try {
    const updated = await prisma.testOrder.update({
      where: {
        id: orderId,
      },

      data: updateData,

      select: TEST_ORDER_SELECT,
    });

    await recordAuditLog({
      laboratoryId: order.laboratoryId,
      userId: user.id,
      action: "TEST_ORDER_UPDATED",
      entity: "TestOrder",
      entityId: orderId,
      details: updateData,
    });

    return updated;
  } catch (error) {
    handlePrismaError(error);
  }
}

async function deleteTestOrder({ user, orderId }) {
  assertUuid(orderId, "id");

  const order = await prisma.testOrder.findFirst({
    where: {
      id: orderId,
      ...buildListWhere(user),
    },

    select: {
      id: true,
      laboratoryId: true,
      status: true,
      orderedTestItems: {
        select: {
          id: true,
          result: { select: { id: true } },
        },
      },
      payments: { select: { id: true } },
    },
  });

  if (!order) {
    throw new ApiError(404, "Test order not found.");
  }

  // Check if any results or payments exist
  const hasResults = order.orderedTestItems.some((item) => Boolean(item.result));
  const hasPayments = order.payments.length > 0;

  if (hasResults || hasPayments) {
    throw new ApiError(
      409,
      "This test order cannot be deleted because related results or payments exist. You may cancel the order instead."
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.orderedTestItem.deleteMany({
        where: { orderId },
      });
      await tx.testOrder.delete({
        where: { id: orderId },
      });
    });

    await recordAuditLog({
      laboratoryId: order.laboratoryId,
      userId: user.id,
      action: "TEST_ORDER_DELETED",
      entity: "TestOrder",
      entityId: orderId,
    });
  } catch (error) {
    handlePrismaError(error);
  }

  return order;
}

export {
  createTestOrder,
  listTestOrders,
  getTestOrderById,
  updateTestOrder,
  deleteTestOrder,
};
