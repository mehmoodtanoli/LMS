import prisma from "../config/prisma.js";

import ApiError from "../utils/ApiError.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

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

function assertLaboratoryScope(user) {
  if (user.role === "SUPERADMIN") {
    return null;
  }

  if (user.role === "LAB_ADMIN") {
    if (!user.laboratoryId) {
      throw new ApiError(
        403,
        "LAB_ADMIN users must be assigned to a laboratory before accessing tests.",
      );
    }

    return user.laboratoryId;
  }

  throw new ApiError(403, "You are not authorized to access test definitions.");
}

function assertSuperAdmin(user) {
  if (user.role !== "SUPERADMIN") {
    throw new ApiError(
      403,
      "Only SUPERADMIN users can manage test definitions.",
    );
  }
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

function buildTestData(data) {
  const testData = {};

  if (data.code !== undefined) {
    const code = normalizeString(data.code);

    if (!code) {
      throw new ApiError(400, "code is required.", { field: "code" });
    }

    testData.code = code;
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

    if (
      data.description !== null &&
      data.description !== undefined &&
      !description
    ) {
      throw new ApiError(400, "description cannot be empty if provided.", {
        field: "description",
      });
    }

    testData.description = description ?? null;
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

  if (parameters.length === 0) {
    throw new ApiError(400, "At least one parameter is required.", {
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
  assertSuperAdmin(user);

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

function handlePrismaError(error) {
  if (error?.code === "P2002") {
    throw new ApiError(
      409,
      "A test definition with the same code already exists in this laboratory.",
      {
        fields: error.meta?.target ?? null,
      },
    );
  }

  if (error?.code === "P2003") {
    throw new ApiError(
      409,
      "This test definition cannot be deleted because related records already exist.",
      {
        field: error.meta?.field_name ?? null,
      },
    );
  }

  if (error?.code === "P2025") {
    throw new ApiError(404, "Test definition not found.");
  }

  throw error;
}

function buildAccessibleWhere(user) {
  const laboratoryId = assertLaboratoryScope(user);

  if (user.role === "LAB_ADMIN") {
    return {
      OR: [{ laboratoryId }, { laboratoryId: null }],
    };
  }

  return {};
}

async function createTestDefinition({ user, data }) {
  assertSuperAdmin(user);

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
    return await prisma.testDefinition.create({
      data: {
        ...testData,
        laboratoryId,
        ...(parameters
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
  } catch (error) {
    handlePrismaError(error);
  }
}

async function listTestDefinitions({ user, query }) {
  const where = buildAccessibleWhere(user);
  const { page, limit } = parsePagination(query);
  const skip = (page - 1) * limit;

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
  assertSuperAdmin(user);

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

  const testData = buildTestData(data);
  const parameters = buildParameterData(data.parameters);

  if (Object.keys(testData).length === 0 && parameters === undefined) {
    throw new ApiError(
      400,
      "At least one test field or parameters must be provided.",
    );
  }

  try {
    return await prisma.$transaction(async (tx) => {
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

        await tx.testParameter.createMany({
          data: parameters.map((parameter) => ({
            ...parameter,
            testDefinitionId: testId,
          })),
        });
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
  } catch (error) {
    handlePrismaError(error);
  }
}

async function deleteTestDefinition({ user, testId }) {
  assertSuperAdmin(user);

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

  try {
    await prisma.testDefinition.delete({
      where: { id: testId },
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
