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
        "LAB_ADMIN users must be assigned to a laboratory before managing tests.",
      );
    }

    return user.laboratoryId;
  }

  throw new ApiError(403, "You are not authorized to access test definitions.");
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

    if (description !== undefined) {
      testData.description = description;
    }
  }

  return testData;
}

async function resolveLaboratoryIdForCreate({ user, laboratoryId }) {
  const scopedLaboratoryId = assertLaboratoryScope(user);

  if (user.role === "LAB_ADMIN") {
    return scopedLaboratoryId;
  }

  const normalizedLaboratoryId = normalizeString(laboratoryId);

  if (!normalizedLaboratoryId) {
    throw new ApiError(400, "laboratoryId is required.", {
      field: "laboratoryId",
    });
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

  if (laboratoryId) {
    return { laboratoryId };
  }

  return {};
}

async function createTestDefinition({ user, data }) {
  const laboratoryId = await resolveLaboratoryIdForCreate({
    user,
    laboratoryId: data.laboratoryId,
  });

  const testData = buildTestData(data);

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

  const testDefinition = await prisma.testDefinition.findFirst({ where });

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
  });

  if (!existingTestDefinition) {
    throw new ApiError(404, "Test definition not found.");
  }

  const testData = buildTestData(data);

  if (Object.keys(testData).length === 0) {
    throw new ApiError(400, "At least one test field must be provided.");
  }

  try {
    return await prisma.testDefinition.update({
      where: { id: testId },
      data: testData,
    });
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

  const testDefinition = await prisma.testDefinition.findFirst({ where });

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
