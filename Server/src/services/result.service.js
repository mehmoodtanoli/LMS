import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";
import {
  assertUuid,
  parsePagination,
  normalizeString,
  normalizeOptionalString,
} from "../utils/validators.js";
import { recordAuditLog } from "../utils/audit.js";
import { hasCompleteResult, buildReportSnapshot, resolveReportNumber } from "./report.service.js";

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
        "User must be assigned to a laboratory before managing results.",
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

/**
 * Checks whether a result contains all required configured parameter values.
 *
 * If the test has configured parameters, every parameter must have a value.
 * If the test has no configured parameters, the existing single-value
 * validation behavior is retained.
 */
function hasRequiredResultValues(value, parameters = []) {
  if (parameters.length > 0) {
    return hasCompleteResult({
      result: {
        status: "FINALIZED",
        value,
      },
      testDefinition: {
        parameters,
      },
    });
  }

  const hasValues =
    value !== null &&
    value !== undefined &&
    (typeof value === "object"
      ? Object.keys(value).length > 0 &&
        Object.values(value).some(
          (v) => v !== "" && v !== null && v !== undefined,
        )
      : String(value).trim().length > 0);

  return hasValues;
}

/**
 * A parameter whose reference range contains a number (e.g. "13-17",
 * "Up to 200") must get a numeric value. Text ranges ("Negative") take text.
 * ponytail: inferred from the range; add an explicit parameter type if labs need it.
 */
function assertNumericValues(value, parameters = []) {
  if (!value || typeof value !== "object" || parameters.length === 0) return;

  for (const parameter of parameters) {
    if (!/\d/.test(parameter.referenceRange || "")) continue;
    const raw = value[parameter.id] ?? value[parameter.name];
    if (raw === null || raw === undefined || String(raw).trim() === "") continue;
    if (!Number.isFinite(Number(String(raw).trim()))) {
      throw new ApiError(400, `${parameter.name} must be a number.`, {
        field: parameter.name,
      });
    }
  }
}

function handlePrismaError(error) {
  if (error?.code === "P2002") {
    throw new ApiError(
      409,
      "A result already exists for this ordered test item.",
      {
        fields: error.meta?.target ?? null,
      },
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
      "A result already exists for this ordered test item.",
    );
  }

  const resultData = buildResultData(data);

  assertNumericValues(
    resultData.value,
    orderedTestItem.testDefinition?.parameters ?? [],
  );

  if (resultData.status === "FINALIZED") {
    const parameters = orderedTestItem.testDefinition?.parameters ?? [];

    if (!hasRequiredResultValues(resultData.value, parameters)) {
      throw new ApiError(
        400,
        "Result cannot be finalized until all required parameter values are entered.",
      );
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
        await ensureFinalReportForOrder(
          tx,
          user,
          result.orderedTestItem.order.id,
        );
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

async function ensureFinalReportForOrder(tx, user, orderId, { amended = false } = {}) {
  await tx.$queryRaw`
    SELECT id
    FROM "test_orders"
    WHERE id = ${orderId}::uuid
    FOR UPDATE
  `;

  const order = await tx.testOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
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

  if (
    !order ||
    order.status === "CANCELLED" ||
    !order.orderedTestItems?.length
  ) {
    return null;
  }

  const allComplete = order.orderedTestItems.every((item) =>
    hasCompleteResult(item),
  );

  if (!allComplete) return null;

  const latestReport = await tx.report.findFirst({
    where: { orderId },
    orderBy: { version: "desc" },
    select: { id: true, version: true, status: true, reportNumber: true },
  });

  const isIssued = latestReport?.status === "FINAL" || latestReport?.status === "AMENDED";

  // Issued report already matches the results; nothing to do unless a result was amended.
  if (isIssued && !amended) {
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
      reportNumber: await resolveReportNumber(tx, order.laboratoryId, latestReport),
      previousReportId: latestReport ? latestReport.id : null,
      snapshot,
      status: isIssued ? "AMENDED" : "FINAL",
    },
  });

  // All results are final and the report is issued, so the order is complete.
  await tx.testOrder.update({
    where: { id: orderId },
    data: { status: "COMPLETED" },
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
      status: isIssued ? "AMENDED" : "FINAL",
      trigger: isIssued ? "RESULT_AMENDMENT" : "RESULT_FINALIZATION",
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
          testDefinition: {
            select: {
              parameters: {
                orderBy: {
                  order: "asc",
                },
                select: {
                  id: true,
                  name: true,
                },
              },
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
    // Amending changes an issued report, so it is an admin action.
    if (user.role === "LAB_TECH") {
      throw new ApiError(
        403,
        "Only administrators can amend a finalized result.",
      );
    }

    if (!data.isAmendment) {
      throw new ApiError(
        409,
        "This result is finalized and cannot be modified. To amend this result, provide isAmendment: true and an amendmentReason.",
      );
    }

    const reason = normalizeString(data.amendmentReason);

    if (!reason) {
      throw new ApiError(
        400,
        "amendmentReason is required when amending a finalized result.",
        {
          field: "amendmentReason",
        },
      );
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

  assertNumericValues(
    resultData.value,
    existingResult.orderedTestItem.testDefinition?.parameters ?? [],
  );

  // Require all configured parameter values before finalization.
  if (targetStatus === "FINALIZED") {
    const effectiveValue =
      resultData.value !== undefined ? resultData.value : existingResult.value;

    const parameters =
      existingResult.orderedTestItem.testDefinition?.parameters ?? [];

    if (!hasRequiredResultValues(effectiveValue, parameters)) {
      throw new ApiError(
        400,
        "Result cannot be finalized until all required parameter values are entered.",
      );
    }

    resultData.finalizedAt = new Date();
    resultData.finalizedById = user.id;
  }

  // If this was an amendment, record amendment metadata in notes and audit log.
  if (isCurrentlyFinalized && data.isAmendment) {
    const auditStamp = `[Amended on ${new Date().toISOString()} by user ${
      user.email || user.id
    }: ${data.amendmentReason}]`;

    resultData.notes = existingResult.notes
      ? `${existingResult.notes}\n${auditStamp}`
      : auditStamp;

    resultData.finalizedAt = new Date();
    resultData.finalizedById = user.id;
  }

  if (Object.keys(resultData).length === 0) {
    throw new ApiError(
      400,
      "At least one editable result field must be provided.",
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

      if (!current) {
        throw new ApiError(404, "Result not found.");
      }

      if (
        current.status !== existingResult.status ||
        current.updatedAt.getTime() !== existingResult.updatedAt.getTime()
      ) {
        throw new ApiError(
          409,
          "Result changed while it was being edited. Retry the request.",
        );
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
        await ensureFinalReportForOrder(
          tx,
          user,
          updatedResult.orderedTestItem.order.id,
          { amended: isCurrentlyFinalized },
        );
      }

      return updatedResult;
    });

    return updated;
  } catch (error) {
    handlePrismaError(error);
  }
}

export {
  createResult,
  listResults,
  getResultById,
  updateResult,
  ensureFinalReportForOrder,
  assertNumericValues,
};
