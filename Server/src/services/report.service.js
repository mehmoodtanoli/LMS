import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";
import {
  assertUuid,
  parsePagination,
  normalizeString,
  normalizeOptionalString,
} from "../utils/validators.js";
import { recordAuditLog } from "../utils/audit.js";

const VALID_REPORT_STATUSES = ["DRAFT", "FINAL", "AMENDED", "SUPERSEDED"];

const REPORT_SELECT = {
  id: true,
  laboratoryId: true,
  orderId: true,
  status: true,
  title: true,
  snapshot: true,
  version: true,
  previousReportId: true,
  createdAt: true,
  updatedAt: true,

  laboratory: {
    select: {
      id: true,
      name: true,
    },
  },

  order: {
    select: {
      id: true,
      status: true,
      notes: true,
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
    },
  },

  previousReport: {
    select: {
      id: true,
      status: true,
      title: true,
      version: true,
      createdAt: true,
      updatedAt: true,
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
        "User must be assigned to a laboratory before accessing reports."
      );
    }

    return user.laboratoryId;
  }

  throw new ApiError(403, "You are not authorized to access reports.");
}

function buildListWhere(user) {
  const laboratoryId = assertLabAdminScope(user);

  if (laboratoryId) {
    return {
      order: {
        laboratoryId,
      },
    };
  }

  return {};
}

function normalizeReportStatus(value) {
  const normalizedValue = normalizeString(value).toUpperCase();

  if (!normalizedValue) {
    return undefined;
  }

  if (!VALID_REPORT_STATUSES.includes(normalizedValue)) {
    throw new ApiError(400, "status must be a valid report status.", {
      field: "status",
      validValues: VALID_REPORT_STATUSES,
    });
  }

  return normalizedValue;
}

function buildReportData(data) {
  const reportData = {};

  if (data.title !== undefined) {
    const title = normalizeOptionalString(data.title);
    reportData.title = title ?? null;
  }

  if (data.status !== undefined) {
    reportData.status = normalizeReportStatus(data.status);
  }

  return reportData;
}

function handlePrismaError(error) {
  if (error?.code === "P2002") {
    throw new ApiError(
      409,
      "A report with this unique version already exists for this order.",
      {
        fields: error.meta?.target ?? null,
      }
    );
  }

  if (error?.code === "P2025") {
    throw new ApiError(404, "Report not found.");
  }

  throw error;
}

async function findAccessibleOrder({ user, orderId }) {
  assertUuid(orderId, "orderId");

  const laboratoryId = assertLabAdminScope(user);

  const order = await prisma.testOrder.findFirst({
    where: laboratoryId
      ? {
          id: orderId,
          laboratoryId,
        }
      : {
          id: orderId,
        },

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
    },
  });

  if (!order) {
    throw new ApiError(404, "Test order not found.");
  }

  return order;
}

function buildReportSnapshot(order) {
  // Complete patient demographics included in snapshot (Fixes A2)
  return {
    order: {
      id: order.id,
      status: order.status,
      notes: order.notes,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    },

    laboratory: order.laboratory,

    patient: {
      id: order.patient.id,
      name: order.patient.name,
      fullName: order.patient.fullName,
      cnic: order.patient.cnic,
      phone: order.patient.phone,
      age: order.patient.age,
      ageUnit: order.patient.ageUnit,
      gender: order.patient.gender,
      address: order.patient.address,
      laboratoryId: order.patient.laboratoryId,
    },

    orderedTestItems: order.orderedTestItems,

    generatedAt: new Date().toISOString(),
  };
}

async function createReport({ user, data }) {
  const orderId = normalizeString(data.orderId);

  if (!orderId) {
    throw new ApiError(400, "orderId is required.", {
      field: "orderId",
    });
  }

  const order = await findAccessibleOrder({
    user,
    orderId,
  });

  // Report Integrity Guard 1: Cannot generate report for CANCELLED order (Fixes A5)
  if (order.status === "CANCELLED") {
    throw new ApiError(400, "Cannot generate a diagnostic report for a cancelled order.");
  }

  if (!order.orderedTestItems || order.orderedTestItems.length === 0) {
    throw new ApiError(400, "Test order does not contain any ordered test items.");
  }

  const reportData = buildReportData(data);
  const targetStatus = reportData.status || "DRAFT";

  // Report Integrity Guard 2: For FINAL reports, all test results must be FINALIZED (Fixes A5)
  if (targetStatus === "FINAL") {
    const unfinalizedItems = order.orderedTestItems.filter(
      (item) => !item.result || item.result.status !== "FINALIZED"
    );

    if (unfinalizedItems.length > 0) {
      const names = unfinalizedItems
        .map((i) => i.testDefinition?.code || i.testDefinition?.name)
        .join(", ");
      throw new ApiError(
        400,
        `All test results must be FINALIZED before issuing a FINAL report. Incomplete tests: ${names}`,
        {
          unfinalizedCount: unfinalizedItems.length,
        }
      );
    }
  }

  const snapshot = buildReportSnapshot(order);

  try {
    return await prisma.$transaction(async (tx) => {
      const latestReport = await tx.report.findFirst({
        where: {
          orderId,
        },
        orderBy: {
          version: "desc",
        },
        select: {
          id: true,
          version: true,
          status: true,
        },
      });

      // Report Integrity Guard 3: Version 1 cannot start as AMENDED (Fixes A5)
      if (targetStatus === "AMENDED" && !latestReport) {
        throw new ApiError(
          400,
          "The first report version cannot be created as AMENDED. Please create a DRAFT or FINAL report first."
        );
      }

      const nextVersion = latestReport ? latestReport.version + 1 : 1;

      // Report Integrity Guard 4: Mark previous report as SUPERSEDED (Fixes A5)
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
          status: targetStatus,
          ...(reportData.title ? { title: reportData.title } : {}),
        },
        select: REPORT_SELECT,
      });

      await recordAuditLog({
        laboratoryId: order.laboratoryId,
        userId: user.id,
        action: "REPORT_CREATED",
        entity: "Report",
        entityId: report.id,
        details: {
          orderId,
          version: nextVersion,
          status: targetStatus,
        },
      });

      return report;
    });
  } catch (error) {
    handlePrismaError(error);
  }
}

async function listReports({ user, query }) {
  const accessibleWhere = buildListWhere(user);
  const { page, limit } = parsePagination(query);
  const skip = (page - 1) * limit;

  const where = { ...accessibleWhere };

  if (query?.status) {
    where.status = normalizeReportStatus(query.status);
  }

  if (query?.orderId) {
    assertUuid(query.orderId, "orderId");
    where.orderId = query.orderId;
  }

  if (query?.search) {
    const s = query.search.trim();
    where.order = {
      ...where.order,
      patient: {
        OR: [
          { name: { contains: s, mode: "insensitive" } },
          { fullName: { contains: s, mode: "insensitive" } },
          { cnic: { contains: s } },
        ],
      },
    };
  }

  const [reports, total] = await prisma.$transaction([
    prisma.report.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
      select: REPORT_SELECT,
    }),

    prisma.report.count({
      where,
    }),
  ]);

  return {
    reports,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function getReportById({ user, reportId }) {
  assertUuid(reportId, "id");

  const report = await prisma.report.findFirst({
    where: {
      id: reportId,
      ...buildListWhere(user),
    },

    select: REPORT_SELECT,
  });

  if (!report) {
    throw new ApiError(404, "Report not found.");
  }

  return report;
}

export { createReport, listReports, getReportById };
