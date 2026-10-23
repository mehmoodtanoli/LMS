import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";
import {
  assertUuid,
  parsePagination,
  normalizeString,
  normalizeOptionalString,
} from "../utils/validators.js";
import { recordAuditLog } from "../utils/audit.js";

function assertLaboratoryScope(user) {
  if (user.role === "SUPERADMIN") {
    return null;
  }

  if (user.role === "LAB_ADMIN" || user.role === "LAB_TECH") {
    if (!user.laboratoryId) {
      throw new ApiError(
        403,
        "User must be assigned to a laboratory before accessing tests."
      );
    }

    return user.laboratoryId;
  }

  throw new ApiError(403, "You are not authorized to access test definitions.");
}

function assertCanManageTest(user, testDefinition = null) {
  if (user.role === "SUPERADMIN") {
    return;
  }

  if (user.role === "LAB_ADMIN") {
    if (!user.laboratoryId) {
      throw new ApiError(
        403,
        "LAB_ADMIN users must be assigned to a laboratory before managing tests."
      );
    }
    if (testDefinition && testDefinition.laboratoryId !== user.laboratoryId) {
      throw new ApiError(
        403,
        "LAB_ADMIN can only modify or delete tests belonging to their own laboratory."
      );
    }
    return;
  }

  throw new ApiError(403, "You are not authorized to manage test definitions.");
}

function buildTestData(data) {
  const testData = {};

  if (data.code !== undefined) {
    const code = normalizeString(data.code);

    if (!code) {
      throw new ApiError(400, "code is required.", { field: "code" });
    }

    testData.code = code.toUpperCase();
  }

  if (data.name !== undefined) {
    const name = normalizeString(data.name);

    if (!name) {
      throw new ApiError(400, "name is required.", { field: "name" });
    }

    testData.name = name;
  }

  if (data.description !== undefined) {
    const description = normalizeOptionalString(data.description);
    testData.description = description ?? null;
  }

  // Accept and validate test price (Fixes A1)
  if (data.price !== undefined) {
    if (data.price === null || data.price === "") {
      testData.price = 0;
    } else {
      const numericPrice = Number(data.price);
      if (!Number.isFinite(numericPrice) || numericPrice < 0) {
        throw new ApiError(400, "price must be a non-negative number.", {
          field: "price",
        });
      }
      testData.price = numericPrice;
    }
  }

  return testData;
}

function buildParameterData(parameters) {
  if (parameters === undefined) {
    return undefined;
  }

  if (!Array.isArray(parameters)) {
    throw new ApiError(400, "parameters must be an array.", {
      field: "parameters",
    });
  }

  return parameters.map((parameter, index) => {
    if (!parameter || typeof parameter !== "object") {
      throw new ApiError(400, `Parameter ${index + 1} must be an object.`, {
        field: `parameters[${index}]`,
      });
    }

    const name = normalizeString(parameter.name);

    if (!name) {
      throw new ApiError(400, `Parameter ${index + 1} name is required.`, {
        field: `parameters[${index}].name`,
      });
    }

    const unit = normalizeOptionalString(parameter.unit);
    const referenceRange = normalizeOptionalString(parameter.referenceRange);

    return {
      name,
      unit: unit ?? null,
      referenceRange: referenceRange ?? null,
      order:
        parameter.order === undefined
          ? index + 1
          : Number.isInteger(Number(parameter.order))
          ? Number(parameter.order)
          : index + 1,
    };
  });
}

async function resolveLaboratoryIdForCreate({ user, laboratoryId }) {
  if (user.role === "LAB_ADMIN") {
    return user.laboratoryId;
  }

  if (user.role === "SUPERADMIN") {
    const normalizedLaboratoryId = normalizeString(laboratoryId);

    // SUPERADMIN can omit laboratoryId to create a global template.
    if (!normalizedLaboratoryId) {
      return null;
    }

    assertUuid(normalizedLaboratoryId, "laboratoryId");

    const laboratory = await prisma.laboratory.findUnique({
      where: { id: normalizedLaboratoryId },
    });

    if (!laboratory) {
      throw new ApiError(404, "Laboratory not found.", {
        field: "laboratoryId",
      });
    }

    return normalizedLaboratoryId;
  }

  throw new ApiError(403, "You are not authorized to create test definitions.");
}

function handlePrismaError(error) {
  if (error?.code === "P2002") {
    throw new ApiError(
      409,
      "A test definition with the same code already exists in this laboratory.",
      {
        fields: error.meta?.target ?? null,
      }
    );
  }

  if (error?.code === "P2003") {
    throw new ApiError(
      409,
      "This test definition cannot be deleted because related records already exist.",
      {
        field: error.meta?.field_name ?? null,
      }
    );
  }

  if (error?.code === "P2025") {
    throw new ApiError(404, "Test definition not found.");
  }

  throw error;
}

function buildAccessibleWhere(user) {
  const laboratoryId = assertLaboratoryScope(user);

  if (user.role === "LAB_ADMIN" || user.role === "LAB_TECH") {
    return {
      OR: [{ laboratoryId }, { laboratoryId: null }],
    };
  }

  return {};
}

async function createTestDefinition({ user, data }) {
  assertCanManageTest(user);

  const laboratoryId = await resolveLaboratoryIdForCreate({
    user,
    laboratoryId: data.laboratoryId,
  });

  const testData = buildTestData(data);
  const parameters = buildParameterData(data.parameters);

  if (!testData.code) {
    throw new ApiError(400, "code is required.", { field: "code" });
  }

  if (!testData.name) {
    throw new ApiError(400, "name is required.", { field: "name" });
  }

  try {
    const test = await prisma.testDefinition.create({
      data: {
        ...testData,
        laboratoryId,
        ...(parameters && parameters.length > 0
          ? {
              parameters: {
                create: parameters,
              },
            }
          : {}),
      },
      include: {
        parameters: {
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    await recordAuditLog({
      laboratoryId,
      userId: user.id,
      action: "TEST_CREATED",
      entity: "TestDefinition",
      entityId: test.id,
      details: { code: test.code, name: test.name, price: test.price },
    });

    return test;
  } catch (error) {
    handlePrismaError(error);
  }
}

async function listTestDefinitions({ user, query }) {
  const accessibleWhere = buildAccessibleWhere(user);
  const { page, limit } = parsePagination(query);
  const skip = (page - 1) * limit;

  const where = { ...accessibleWhere };

  if (query?.search) {
    const s = query.search.trim();
    where.AND = [
      {
        OR: [
          { code: { contains: s, mode: "insensitive" } },
          { name: { contains: s, mode: "insensitive" } },
          { description: { contains: s, mode: "insensitive" } },
        ],
      },
    ];
  }

  const [tests, total] = await prisma.$transaction([
    prisma.testDefinition.findMany({
      where,
      include: {
        parameters: {
          orderBy: {
            order: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    }),
    prisma.testDefinition.count({ where }),
  ]);

  return {
    tests,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function getTestDefinitionById({ user, testId }) {
  assertUuid(testId, "id");

  const where = {
    id: testId,
    ...buildAccessibleWhere(user),
  };

  const testDefinition = await prisma.testDefinition.findFirst({
    where,
    include: {
      parameters: {
        orderBy: {
          order: "asc",
        },
      },
    },
  });

  if (!testDefinition) {
    throw new ApiError(404, "Test definition not found.");
  }

  return testDefinition;
}

async function updateTestDefinition({ user, testId, data }) {
  assertUuid(testId, "id");

  const where = {
    id: testId,
    ...buildAccessibleWhere(user),
  };

  const existingTestDefinition = await prisma.testDefinition.findFirst({
    where,
    include: {
      parameters: true,
    },
  });

  if (!existingTestDefinition) {
    throw new ApiError(404, "Test definition not found.");
  }

  assertCanManageTest(user, existingTestDefinition);

  const testData = buildTestData(data);
  const parameters = buildParameterData(data.parameters);

  if (Object.keys(testData).length === 0 && parameters === undefined) {
    throw new ApiError(
      400,
      "At least one test field or parameters must be provided."
    );
  }

  try {
    const updatedTest = await prisma.$transaction(async (tx) => {
      if (Object.keys(testData).length > 0) {
        await tx.testDefinition.update({
          where: { id: testId },
          data: testData,
        });
      }

      if (parameters !== undefined) {
        await tx.testParameter.deleteMany({
          where: {
            testDefinitionId: testId,
          },
        });

        if (parameters.length > 0) {
          await tx.testParameter.createMany({
            data: parameters.map((parameter) => ({
              ...parameter,
              testDefinitionId: testId,
            })),
          });
        }
      }

      return tx.testDefinition.findUnique({
        where: { id: testId },
        include: {
          parameters: {
            orderBy: {
              order: "asc",
            },
          },
        },
      });
    });

    await recordAuditLog({
      laboratoryId: existingTestDefinition.laboratoryId,
      userId: user.id,
      action: "TEST_UPDATED",
      entity: "TestDefinition",
      entityId: testId,
      details: { ...testData, parametersCount: parameters?.length },
    });

    return updatedTest;
  } catch (error) {
    handlePrismaError(error);
  }
}

async function deleteTestDefinition({ user, testId }) {
  assertUuid(testId, "id");

  const where = {
    id: testId,
    ...buildAccessibleWhere(user),
  };

  const testDefinition = await prisma.testDefinition.findFirst({
    where,
  });

  if (!testDefinition) {
    throw new ApiError(404, "Test definition not found.");
  }

  assertCanManageTest(user, testDefinition);

  try {
    await prisma.testDefinition.delete({
      where: { id: testId },
    });

    await recordAuditLog({
      laboratoryId: testDefinition.laboratoryId,
      userId: user.id,
      action: "TEST_DELETED",
      entity: "TestDefinition",
      entityId: testId,
    });
  } catch (error) {
    handlePrismaError(error);
  }

  return testDefinition;
}

export {
  createTestDefinition,
  listTestDefinitions,
  getTestDefinitionById,
  updateTestDefinition,
  deleteTestDefinition,
};
