import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_ORDER_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

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
      laboratoryId: true,
    },
  },
  orderedTestItems: {
    select: {
      id: true,
      notes: true,
      testDefinition: {
        select: {
          id: true,
          code: true,
          name: true,
          laboratoryId: true,
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
          createdAt: true,
          updatedAt: true,
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

function assertLabAdminScope(user) {
  if (user.role === "SUPERADMIN") {
    return null;
  }

  if (user.role === "LAB_ADMIN") {
    if (!user.laboratoryId) {
      throw new ApiError(
        403,
        "LAB_ADMIN users must be assigned to a laboratory before managing test orders.",
      );
    }

    return user.laboratoryId;
  }

  throw new ApiError(403, "You are not authorized to access test orders.");
}

function getLabAdminLaboratoryId(user) {
  const laboratoryId = assertLabAdminScope(user);

  if (!laboratoryId) {
    throw new ApiError(403, "LAB_ADMIN users must be assigned to a laboratory before managing test orders.");
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

    if (data.notes !== null && data.notes !== undefined && !notes) {
      throw new ApiError(400, "notes cannot be empty if provided.", {
        field: "notes",
      });
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }
  }

  return updateData;
}

function assertNoImmutableOverrides(data) {
  const immutableFields = ["patientId", "testDefinitionId", "laboratoryId"];
  const providedFields = immutableFields.filter((field) => data[field] !== undefined);

  if (providedFields.length > 0) {
    throw new ApiError(400, "patientId, testDefinitionId, and laboratoryId cannot be changed on an existing order.", {
      fields: providedFields,
    });
  }
}

function handlePrismaError(error) {
  if (error?.code === "P2003") {
    throw new ApiError(409, "This test order cannot be deleted because related records already exist.", {
      field: error.meta?.field_name ?? null,
    });
  }

  if (
    typeof error?.message === "string" &&
    error.message.includes("violates RESTRICT setting of foreign key constraint")
  ) {
    throw new ApiError(409, "This test order cannot be deleted because related records already exist.");
  }

  if (error?.code === "P2025") {
    throw new ApiError(404, "Test order not found.");
  }

  throw error;
}

async function findAccessiblePatient({ user, patientId }) {
  assertUuid(patientId, "patientId");

  const laboratoryId = user.role === "LAB_ADMIN" ? getLabAdminLaboratoryId(user) : null;

  const patient = await prisma.patient.findFirst({
    where: laboratoryId ? { id: patientId, laboratoryId } : { id: patientId },
    select: {
      id: true,
      laboratoryId: true,
      name: true,
      fullName: true,
      cnic: true,
    },
  });

  if (!patient) {
    throw new ApiError(404, "Patient not found.");
  }

  return patient;
}

async function findAccessibleTestDefinition({ user, testDefinitionId }) {
  assertUuid(testDefinitionId, "testDefinitionId");

  const laboratoryId = user.role === "LAB_ADMIN" ? getLabAdminLaboratoryId(user) : null;

  const testDefinition = await prisma.testDefinition.findFirst({
    where: laboratoryId ? { id: testDefinitionId, laboratoryId } : { id: testDefinitionId },
    select: {
      id: true,
      laboratoryId: true,
      code: true,
      name: true,
    },
  });

  if (!testDefinition) {
    throw new ApiError(404, "Test definition not found.");
  }

  return testDefinition;
}

function assertSameLaboratory(patient, testDefinition) {
  if (patient.laboratoryId !== testDefinition.laboratoryId) {
    throw new ApiError(400, "Patient and test definition must belong to the same laboratory.", {
      fields: ["patientId", "testDefinitionId"],
    });
  }
}

async function createTestOrder({ user, data }) {
  const patientId = normalizeString(data.patientId);
  const testDefinitionId = normalizeString(data.testDefinitionId);

  if (!patientId) {
    throw new ApiError(400, "patientId is required.", { field: "patientId" });
  }

  if (!testDefinitionId) {
    throw new ApiError(400, "testDefinitionId is required.", {
      field: "testDefinitionId",
    });
  }

  const patient = await findAccessiblePatient({ user, patientId });
  const testDefinition = await findAccessibleTestDefinition({ user, testDefinitionId });
  assertSameLaboratory(patient, testDefinition);

  const requestedLaboratoryId = normalizeOptionalString(data.laboratoryId);
  const derivedLaboratoryId = patient.laboratoryId;

  if (requestedLaboratoryId !== undefined) {
    assertUuid(requestedLaboratoryId, "laboratoryId");

    if (requestedLaboratoryId !== derivedLaboratoryId) {
      throw new ApiError(400, "laboratoryId must match the patient and test definition laboratory.", {
        field: "laboratoryId",
      });
    }
  }

  const notes = data.notes === undefined ? undefined : normalizeOptionalString(data.notes);

  if (data.notes !== null && data.notes !== undefined && !notes) {
    throw new ApiError(400, "notes cannot be empty if provided.", {
      field: "notes",
    });
  }

  const status = data.status === undefined ? undefined : normalizeOrderStatus(data.status);

  try {
    return await prisma.testOrder.create({
      data: {
        laboratoryId: derivedLaboratoryId,
        patientId,
        ...(status ? { status } : {}),
        ...(notes !== undefined ? { notes } : {}),
        orderedTestItems: {
          create: {
            testDefinitionId,
          },
        },
      },
      select: TEST_ORDER_SELECT,
    });
  } catch (error) {
    handlePrismaError(error);
  }
}

async function listTestOrders({ user, query }) {
  const where = buildListWhere(user);
  const { page, limit } = parsePagination(query);
  const skip = (page - 1) * limit;

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
    prisma.testOrder.count({ where }),
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
    },
  });

  if (!order) {
    throw new ApiError(404, "Test order not found.");
  }

  const updateData = buildOrderUpdateData(data);

  if (Object.keys(updateData).length === 0) {
    throw new ApiError(400, "At least one editable order field must be provided.");
  }

  try {
    return await prisma.testOrder.update({
      where: { id: orderId },
      data: updateData,
      select: TEST_ORDER_SELECT,
    });
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
    },
  });

  if (!order) {
    throw new ApiError(404, "Test order not found.");
  }

  try {
    await prisma.testOrder.delete({
      where: { id: orderId },
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