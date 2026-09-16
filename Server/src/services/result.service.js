import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_RESULT_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "FINALIZED"];
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const RESULT_SELECT = {
  id: true,
  orderedTestItemId: true,
  status: true,
  value: true,
  unit: true,
  referenceRange: true,
  interpretation: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  orderedTestItem: {
    select: {
      id: true,
      notes: true,
      order: {
        select: {
          id: true,
          status: true,
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
        },
      },
      testDefinition: {
        select: {
          id: true,
          code: true,
          name: true,
          laboratoryId: true,
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

function assertLabAdminScope(user) {
  if (user.role === "SUPERADMIN") {
    return null;
  }

  if (user.role === "LAB_ADMIN") {
    if (!user.laboratoryId) {
      throw new ApiError(
        403,
        "LAB_ADMIN users must be assigned to a laboratory before managing results.",
      );
    }

    return user.laboratoryId;
  }

  throw new ApiError(403, "You are not authorized to access results.");
}

function buildListWhere(user) {
  const laboratoryId = assertLabAdminScope(user);

  if (laboratoryId) {
    return {
      orderedTestItem: {
        order: {
          laboratoryId,
        },
      },
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

function normalizeResultStatus(value) {
  const normalizedValue = normalizeString(value).toUpperCase();

  if (!normalizedValue) {
    return undefined;
  }

  if (!VALID_RESULT_STATUSES.includes(normalizedValue)) {
    throw new ApiError(400, "status must be a valid result status.", {
      field: "status",
      validValues: VALID_RESULT_STATUSES,
    });
  }

  return normalizedValue;
}

function buildResultData(data) {
  const resultData = {};

  if (data.status !== undefined) {
    resultData.status = normalizeResultStatus(data.status);
  }

  if (data.value !== undefined) {
    resultData.value = data.value;
  }

  if (data.unit !== undefined) {
    const unit = normalizeOptionalString(data.unit);

    if (data.unit !== null && data.unit !== undefined && !unit) {
      throw new ApiError(400, "unit cannot be empty if provided.", {
        field: "unit",
      });
    }

    if (unit !== undefined) {
      resultData.unit = unit;
    }
  }

  if (data.referenceRange !== undefined) {
    const referenceRange = normalizeOptionalString(data.referenceRange);

    if (data.referenceRange !== null && data.referenceRange !== undefined && !referenceRange) {
      throw new ApiError(400, "referenceRange cannot be empty if provided.", {
        field: "referenceRange",
      });
    }

    if (referenceRange !== undefined) {
      resultData.referenceRange = referenceRange;
    }
  }

  if (data.interpretation !== undefined) {
    const interpretation = normalizeOptionalString(data.interpretation);

    if (data.interpretation !== null && data.interpretation !== undefined && !interpretation) {
      throw new ApiError(400, "interpretation cannot be empty if provided.", {
        field: "interpretation",
      });
    }

    if (interpretation !== undefined) {
      resultData.interpretation = interpretation;
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
      resultData.notes = notes;
    }
  }

  return resultData;
}

function handlePrismaError(error) {
  if (error?.code === "P2002") {
    throw new ApiError(409, "A result already exists for this ordered test item.", {
      fields: error.meta?.target ?? null,
    });
  }

  if (error?.code === "P2025") {
    throw new ApiError(404, "Result not found.");
  }

  throw error;
}

async function findAccessibleOrderedTestItem({ user, orderedTestItemId }) {
  assertUuid(orderedTestItemId, "orderedTestItemId");

  const laboratoryId = assertLabAdminScope(user);

  const orderedTestItem = await prisma.orderedTestItem.findFirst({
    where: laboratoryId
      ? {
          id: orderedTestItemId,
          order: {
            laboratoryId,
          },
        }
      : {
          id: orderedTestItemId,
        },
    select: {
      id: true,
      result: {
        select: {
          id: true,
        },
      },
      order: {
        select: {
          id: true,
          laboratoryId: true,
          status: true,
          patient: {
            select: {
              id: true,
              name: true,
              fullName: true,
              cnic: true,
              laboratoryId: true,
            },
          },
        },
      },
      testDefinition: {
        select: {
          id: true,
          code: true,
          name: true,
          laboratoryId: true,
        },
      },
    },
  });

  if (!orderedTestItem) {
    throw new ApiError(404, "Ordered test item not found.");
  }

  return orderedTestItem;
}

async function createResult({ user, data }) {
  const orderedTestItemId = normalizeString(data.orderedTestItemId);

  if (!orderedTestItemId) {
    throw new ApiError(400, "orderedTestItemId is required.", {
      field: "orderedTestItemId",
    });
  }

  const orderedTestItem = await findAccessibleOrderedTestItem({ user, orderedTestItemId });

  if (orderedTestItem.result) {
    throw new ApiError(409, "A result already exists for this ordered test item.");
  }

  const resultData = buildResultData(data);

  try {
    return await prisma.result.create({
      data: {
        orderedTestItemId,
        ...resultData,
      },
      select: RESULT_SELECT,
    });
  } catch (error) {
    handlePrismaError(error);
  }
}

async function listResults({ user, query }) {
  const where = buildListWhere(user);
  const { page, limit } = parsePagination(query);
  const skip = (page - 1) * limit;

  const [results, total] = await prisma.$transaction([
    prisma.result.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
      select: RESULT_SELECT,
    }),
    prisma.result.count({ where }),
  ]);

  return {
    results,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function getResultById({ user, resultId }) {
  assertUuid(resultId, "id");

  const result = await prisma.result.findFirst({
    where: {
      id: resultId,
      ...buildListWhere(user),
    },
    select: RESULT_SELECT,
  });

  if (!result) {
    throw new ApiError(404, "Result not found.");
  }

  return result;
}

async function updateResult({ user, resultId, data }) {
  assertUuid(resultId, "id");

  const existingResult = await prisma.result.findFirst({
    where: {
      id: resultId,
      ...buildListWhere(user),
    },
    select: {
      id: true,
    },
  });

  if (!existingResult) {
    throw new ApiError(404, "Result not found.");
  }

  const resultData = buildResultData(data);

  if (Object.keys(resultData).length === 0) {
    throw new ApiError(400, "At least one editable result field must be provided.");
  }

  try {
    return await prisma.result.update({
      where: { id: resultId },
      data: resultData,
      select: RESULT_SELECT,
    });
  } catch (error) {
    handlePrismaError(error);
  }
}

export { createResult, listResults, getResultById, updateResult };