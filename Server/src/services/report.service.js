import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const VALID_REPORT_STATUSES = ["DRAFT", "FINAL", "AMENDED"];
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

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
        "LAB_ADMIN users must be assigned to a laboratory before managing reports.",
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

    if (data.title !== null && data.title !== undefined && !title) {
      throw new ApiError(400, "title cannot be empty if provided.", {
        field: "title",
      });
    }

    if (title !== undefined) {
      reportData.title = title;
    }
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
      "A report with this unique detail already exists.",
      {
        fields: error.meta?.target ?? null,
      },
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
  return {
    order: {
      id: order.id,
      status: order.status,
      notes: order.notes,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    },

    laboratory: order.laboratory,

    patient: order.patient,

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

  const reportData = buildReportData(data);

  const latestReport = await prisma.report.findFirst({
    where: {
      orderId,
    },

    orderBy: {
      version: "desc",
    },

    select: {
      id: true,
      version: true,
    },
  });

  const snapshot = buildReportSnapshot(order);

  try {
    return await prisma.report.create({
      data: {
        laboratoryId: order.laboratoryId,
        orderId,
        version: latestReport ? latestReport.version + 1 : 1,
        previousReportId: latestReport ? latestReport.id : null,
        snapshot,
        ...reportData,
      },

      select: REPORT_SELECT,
    });
  } catch (error) {
    handlePrismaError(error);
  }
}

async function listReports({ user, query }) {
  const where = buildListWhere(user);
  const { page, limit } = parsePagination(query);
  const skip = (page - 1) * limit;

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
