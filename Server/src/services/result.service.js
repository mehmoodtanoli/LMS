import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";
import {
  assertUuid,
  parsePagination,
  normalizeString,
  normalizeOptionalString,
} from "../utils/validators.js";
import { recordAuditLog } from "../utils/audit.js";
import { hasCompleteResult, buildReportSnapshot } from "./report.service.js";

const VALID_RESULT_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "FINALIZED",
];

const RESULT_TRANSITIONS = {
  PENDING: ["PENDING", "IN_PROGRESS", "COMPLETED", "FINALIZED"],
  IN_PROGRESS: ["IN_PROGRESS", "COMPLETED", "FINALIZED"],
  COMPLETED: ["COMPLETED", "FINALIZED"],
  FINALIZED: ["FINALIZED"],
};

const RESULT_SELECT = {
  id: true,
  orderedTestItemId: true,
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

  orderedTestItem: {
    select: {
      id: true,
      price: true,
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
              phone: true,
              age: true,
              ageUnit: true,
              gender: true,
              address: true,
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
    },
  },
};

function assertLabAdminScope(user) {
  if (user.role === "SUPERADMIN") {
    return null;
  }

  if (user.role === "LAB_ADMIN" || user.role === "LAB_TECH") {
    if (!user.laboratoryId) {
      throw new ApiError(
        403,
        "User must be assigned to a laboratory before managing results."
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
    resultData.unit = unit ?? null;
  }

  if (data.referenceRange !== undefined) {
    const referenceRange = normalizeOptionalString(data.referenceRange);
    resultData.referenceRange = referenceRange ?? null;
  }

  if (data.interpretation !== undefined) {
    const interpretation = normalizeOptionalString(data.interpretation);
    resultData.interpretation = interpretation ?? null;
  }

  if (data.notes !== undefined) {
    const notes = normalizeOptionalString(data.notes);
    resultData.notes = notes ?? null;
  }

  return resultData;
}

function handlePrismaError(error) {
  if (error?.code === "P2002") {
    throw new ApiError(
      409,
      "A result already exists for this ordered test item.",
      {
        fields: error.meta?.target ?? null,
      }
    );
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
      price: true,

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
              phone: true,
              age: true,
              ageUnit: true,
              gender: true,
              address: true,
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

  const orderedTestItem = await findAccessibleOrderedTestItem({
    user,
    orderedTestItemId,
  });

  if (orderedTestItem.result) {
    throw new ApiError(
      409,
      "A result already exists for this ordered test item."
    );
  }

  const resultData = buildResultData(data);

  if (resultData.status === "FINALIZED") {
    if (!resultData.value || Object.keys(resultData.value).length === 0) {
      throw new ApiError(400, "Cannot finalize result without entering observation values.");
    }
    resultData.finalizedAt = new Date();
    resultData.finalizedById = user.id;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const result = await tx.result.create({
        data: {
          orderedTestItemId,
          ...resultData,
        },
        select: RESULT_SELECT,
      });

      await recordAuditLog({
        db: tx,
        laboratoryId: orderedTestItem.order.laboratoryId,
        userId: user.id,
        action: "RESULT_CREATED",
        entity: "Result",
        entityId: result.id,
        details: { status: result.status },
      });

      if (result.status === "FINALIZED") {
        await ensureFinalReportForOrder(tx, user, result.orderedTestItem.order.id);
      }

      return result;
    });
  } catch (error) {
    handlePrismaError(error);
  }
}

async function listResults({ user, query }) {
  const accessibleWhere = buildListWhere(user);
  const { page, limit } = parsePagination(query);
  const skip = (page - 1) * limit;

  const where = { ...accessibleWhere };

  if (query?.status) {
    where.status = normalizeResultStatus(query.status);
  }

  if (query?.orderId) {
    assertUuid(query.orderId, "orderId");
    where.orderedTestItem = {
      ...where.orderedTestItem,
      orderId: query.orderId,
    };
  }

  if (query?.search) {
    const s = query.search.trim();
    where.orderedTestItem = {
      ...where.orderedTestItem,
      order: {
        patient: {
          OR: [
            { name: { contains: s, mode: "insensitive" } },
            { fullName: { contains: s, mode: "insensitive" } },
            { cnic: { contains: s } },
          ],
        },
      },
    };
  }

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

    prisma.result.count({
      where,
    }),
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

async function ensureFinalReportForOrder(tx, user, orderId) {
  await tx.$queryRaw`SELECT id FROM "test_orders" WHERE id = ${orderId}::uuid FOR UPDATE`;

  const order = await tx.testOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      laboratoryId: true,
      status: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      laboratory: {
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          email: true,
          logoUrl: true,
          tagline: true,
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
                orderBy: { order: "asc" },
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
    },
  });

  if (!order || order.status === "CANCELLED" || !order.orderedTestItems?.length) {
    return null;
  }

  const allComplete = order.orderedTestItems.every((item) => hasCompleteResult(item));
  if (!allComplete) return null;

  const latestReport = await tx.report.findFirst({
    where: { orderId },
    orderBy: { version: "desc" },
    select: { id: true, version: true, status: true },
  });

  if (latestReport?.status === "FINAL") {
    return latestReport;
  }

  if (user.role === "LAB_TECH") {
    // LAB_TECH may finalize individual results, but must not authorize/create FINAL reports.
    // Skip auto FINAL report creation; result finalization remains valid.
    return null;
  }

  const nextVersion = latestReport ? latestReport.version + 1 : 1;
  const snapshot = buildReportSnapshot(order);

  if (latestReport) {
    await tx.report.update({
      where: { id: latestReport.id },
      data: { status: "SUPERSEDED" },
    });
  }

  const report = await tx.report.create({
    data: {
      laboratoryId: order.laboratoryId,
      orderId,
      version: nextVersion,
      previousReportId: latestReport ? latestReport.id : null,
      snapshot,
      status: "FINAL",
    },
  });

  await recordAuditLog({
    db: tx,
    laboratoryId: order.laboratoryId,
    userId: user.id,
    action: "REPORT_CREATED",
    entity: "Report",
    entityId: report.id,
    details: {
      orderId,
      version: nextVersion,
      status: "FINAL",
      trigger: "RESULT_FINALIZATION",
    },
  });

  return report;
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
      status: true,
      value: true,
      notes: true,
      updatedAt: true,
      orderedTestItem: {
        select: {
          order: {
            select: {
              laboratoryId: true,
            },
          },
        },
      },
    },
  });

  if (!existingResult) {
    throw new ApiError(404, "Result not found.");
  }

  // Amend Flow for Finalized Results (Fixes A6)
  const isCurrentlyFinalized = existingResult.status === "FINALIZED";
  if (isCurrentlyFinalized) {
    if (!data.isAmendment) {
      throw new ApiError(
        409,
        "This result is finalized and cannot be modified. To amend this result, provide isAmendment: true and an amendmentReason."
      );
    }

    const reason = normalizeString(data.amendmentReason);
    if (!reason) {
      throw new ApiError(400, "amendmentReason is required when amending a finalized result.", {
        field: "amendmentReason",
      });
    }
  }

  const resultData = buildResultData(data);
  const targetStatus = resultData.status || existingResult.status;
  if (!RESULT_TRANSITIONS[existingResult.status]?.includes(targetStatus)) {
    throw new ApiError(409, "Result status cannot move backward.", {
      field: "status",
      currentStatus: existingResult.status,
      requestedStatus: targetStatus,
    });
  }

  // Require values to finalize (Fixes A6: "Finalize allowed with every value empty")
  if (targetStatus === "FINALIZED") {
    const effectiveValue = resultData.value !== undefined ? resultData.value : existingResult.value;
    const hasValues =
      effectiveValue !== null &&
      effectiveValue !== undefined &&
      (typeof effectiveValue === "object"
        ? Object.keys(effectiveValue).length > 0 &&
          Object.values(effectiveValue).some((v) => v !== "" && v !== null && v !== undefined)
        : String(effectiveValue).trim().length > 0);

    if (!hasValues) {
      throw new ApiError(400, "Result cannot be finalized with empty observation values.");
    }

    resultData.finalizedAt = new Date();
    resultData.finalizedById = user.id;
  }

  // If this was an amendment, record amendment metadata in notes and audit log
  if (isCurrentlyFinalized && data.isAmendment) {
    const auditStamp = `[Amended on ${new Date().toISOString()} by user ${user.email || user.id}: ${data.amendmentReason}]`;
    resultData.notes = existingResult.notes
      ? `${existingResult.notes}\n${auditStamp}`
      : auditStamp;
    resultData.finalizedAt = new Date();
    resultData.finalizedById = user.id;
  }

  if (Object.keys(resultData).length === 0) {
    throw new ApiError(
      400,
      "At least one editable result field must be provided."
    );
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT r.id
        FROM "results" r
        JOIN "ordered_test_items" i ON i.id = r."orderedTestItemId"
        JOIN "test_orders" o ON o.id = i."orderId"
        WHERE r.id = ${resultId}::uuid
        FOR UPDATE
      `;
      const current = await tx.result.findUnique({
        where: { id: resultId },
        select: { status: true, updatedAt: true },
      });
      if (!current) throw new ApiError(404, "Result not found.");
      if (
        current.status !== existingResult.status ||
        current.updatedAt.getTime() !== existingResult.updatedAt.getTime()
      ) {
        throw new ApiError(409, "Result changed while it was being edited. Retry the request.");
      }
      const updatedResult = await tx.result.update({
        where: { id: resultId },
        data: resultData,
        select: RESULT_SELECT,
      });
      await recordAuditLog({
        db: tx,
        laboratoryId: existingResult.orderedTestItem.order.laboratoryId,
        userId: user.id,
        action: isCurrentlyFinalized ? "RESULT_AMENDED" : "RESULT_UPDATED",
        entity: "Result",
        entityId: resultId,
        details: {
          status: updatedResult.status,
          isAmendment: Boolean(data.isAmendment),
          reason: data.amendmentReason || null,
        },
      });

      if (updatedResult.status === "FINALIZED") {
        await ensureFinalReportForOrder(tx, user, updatedResult.orderedTestItem.order.id);
      }

      return updatedResult;
    });

    return updated;
  } catch (error) {
    handlePrismaError(error);
  }
}

export { createResult, listResults, getResultById, updateResult };
