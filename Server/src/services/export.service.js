import { strToU8, zipSync } from "fflate";
import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import { recordAuditLog } from "../utils/audit.js";
import { parsePagination } from "../utils/validators.js";
import { buildCsv, formatDate } from "../utils/csv.js";

export const EXPORT_ENTITY = "DataExport";
export const EXPORT_ACTIONS = Object.freeze({
  COMPLETED: "DATA_EXPORT_COMPLETED",
  FAILED: "DATA_EXPORT_FAILED",
});

const DEFAULT_MAX_ROWS = 25000;
const BATCH_SIZE = 1000;
const UTC_OFFSET_MINUTES = 300; // Pakistan Standard Time
const DAY_MS = 24 * 60 * 60 * 1000;
const ORDER_BY = [{ createdAt: "asc" }, { id: "asc" }];

function getMaxRows() {
  const value = Number(process.env.EXPORT_MAX_ROWS);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_MAX_ROWS;
}

/* -------------------------------------------------------------------------- */
/* Authorization                                                               */
/* -------------------------------------------------------------------------- */

function assertExportAccess(user) {
  if (!user || user.role !== "LAB_ADMIN") {
    throw new ApiError(403, "Only LAB_ADMIN users can export laboratory data.");
  }
  if (!user.laboratoryId) {
    throw new ApiError(
      403,
      "User must be assigned to a laboratory before exporting data."
    );
  }
  return user.laboratoryId;
}

/* -------------------------------------------------------------------------- */
/* Date range                                                                  */
/* -------------------------------------------------------------------------- */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDateOnly(value, field) {
  if (value === undefined || value === null || value === "") return null;

  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    throw new ApiError(400, `${field} must be a date in YYYY-MM-DD format.`, {
      field,
    });
  }

  const [year, month, day] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw new ApiError(400, `${field} is not a valid calendar date.`, { field });
  }

  // Start of that day in local time, expressed as a UTC instant.
  return new Date(Date.UTC(year, month - 1, day) - UTC_OFFSET_MINUTES * 60 * 1000);
}

/**
 * Converts inclusive from/to dates (local time) into a Prisma createdAt filter.
 * "to" is inclusive: the filter uses "less than the start of the next day".
 */
export function parseDateRange(from, to) {
  const start = parseDateOnly(from, "from");
  const endDayStart = parseDateOnly(to, "to");

  const filter = {};
  if (start) filter.gte = start;
  if (endDayStart) filter.lt = new Date(endDayStart.getTime() + DAY_MS);

  if (filter.gte && filter.lt && filter.gte >= filter.lt) {
    throw new ApiError(400, "from must not be after to.", { field: "from" });
  }

  return {
    filter: Object.keys(filter).length > 0 ? filter : null,
    from: from || null,
    to: to || null,
  };
}

/* -------------------------------------------------------------------------- */
/* Dataset definitions                                                         */
/* -------------------------------------------------------------------------- */

const createdAtFilter = (range) => (range ? { createdAt: range } : {});
const fullName = (patient) =>
  patient ? [patient.name, patient.fullName].filter(Boolean).join(" ") : "";

const DATASETS = {
  patients: {
    label: "Patients",
    description: "Registered patients (soft-deleted patients are excluded).",
    dateFiltered: true,
    model: "patient",
    where: (labId, range) => ({
      laboratoryId: labId,
      isDeleted: false,
      ...createdAtFilter(range),
    }),
    select: {
      id: true,
      name: true,
      fullName: true,
      phone: true,
      age: true,
      ageUnit: true,
      gender: true,
      address: true,
      cnic: true,
      createdAt: true,
      updatedAt: true,
    },
    columns: [
      { header: "Patient ID", value: (r) => r.id },
      { header: "Name", value: (r) => r.name },
      { header: "Full Name", value: (r) => r.fullName },
      { header: "Phone", value: (r) => r.phone, phone: true },
      { header: "Age", value: (r) => r.age },
      { header: "Age Unit", value: (r) => r.ageUnit },
      { header: "Gender", value: (r) => r.gender },
      { header: "Address", value: (r) => r.address },
      { header: "CNIC", value: (r) => r.cnic },
      { header: "Registered At (PKT)", value: (r) => r.createdAt },
      { header: "Updated At (PKT)", value: (r) => r.updatedAt },
    ],
  },

  "test-orders": {
    label: "Test Orders",
    description: "Test orders with status and billing totals.",
    dateFiltered: true,
    model: "testOrder",
    where: (labId, range) => ({ laboratoryId: labId, ...createdAtFilter(range) }),
    select: {
      id: true,
      patientId: true,
      status: true,
      notes: true,
      totalAmount: true,
      billFinalizedAt: true,
      createdAt: true,
      updatedAt: true,
      patient: { select: { name: true, fullName: true } },
    },
    columns: [
      { header: "Order ID", value: (r) => r.id },
      { header: "Patient ID", value: (r) => r.patientId },
      { header: "Patient Name", value: (r) => fullName(r.patient) },
      { header: "Status", value: (r) => r.status },
      { header: "Notes", value: (r) => r.notes },
      { header: "Total Amount", value: (r) => r.totalAmount },
      { header: "Bill Finalized At (PKT)", value: (r) => r.billFinalizedAt },
      { header: "Created At (PKT)", value: (r) => r.createdAt },
      { header: "Updated At (PKT)", value: (r) => r.updatedAt },
    ],
  },

  "order-items": {
    label: "Order Items",
    description: "Individual tests ordered, with the price charged. Filtered by order date.",
    dateFiltered: true,
    model: "orderedTestItem",
    where: (labId, range) => ({
      order: { laboratoryId: labId, ...createdAtFilter(range) },
    }),
    select: {
      id: true,
      orderId: true,
      price: true,
      notes: true,
      createdAt: true,
      testDefinition: { select: { code: true, name: true } },
    },
    columns: [
      { header: "Order Item ID", value: (r) => r.id },
      { header: "Order ID", value: (r) => r.orderId },
      { header: "Test Code", value: (r) => r.testDefinition?.code },
      { header: "Test Name", value: (r) => r.testDefinition?.name },
      { header: "Price", value: (r) => r.price },
      { header: "Notes", value: (r) => r.notes },
      { header: "Created At (PKT)", value: (r) => r.createdAt },
    ],
  },

  results: {
    label: "Test Results",
    description: "Entered and finalized test results.",
    dateFiltered: true,
    model: "result",
    where: (labId, range) => ({
      orderedTestItem: { order: { laboratoryId: labId } },
      ...createdAtFilter(range),
    }),
    select: {
      id: true,
      status: true,
      value: true,
      unit: true,
      referenceRange: true,
      interpretation: true,
      notes: true,
      finalizedAt: true,
      createdAt: true,
      orderedTestItem: {
        select: {
          id: true,
          orderId: true,
          testDefinition: { select: { code: true, name: true } },
        },
      },
    },
    columns: [
      { header: "Result ID", value: (r) => r.id },
      { header: "Order ID", value: (r) => r.orderedTestItem?.orderId },
      { header: "Order Item ID", value: (r) => r.orderedTestItem?.id },
      { header: "Test Code", value: (r) => r.orderedTestItem?.testDefinition?.code },
      { header: "Test Name", value: (r) => r.orderedTestItem?.testDefinition?.name },
      { header: "Status", value: (r) => r.status },
      { header: "Value", value: (r) => r.value },
      { header: "Unit", value: (r) => r.unit },
      { header: "Reference Range", value: (r) => r.referenceRange },
      { header: "Interpretation", value: (r) => r.interpretation },
      { header: "Notes", value: (r) => r.notes },
      { header: "Finalized At (PKT)", value: (r) => r.finalizedAt },
      { header: "Created At (PKT)", value: (r) => r.createdAt },
    ],
  },

  payments: {
    label: "Payments",
    description: "Payments and billing records.",
    dateFiltered: true,
    model: "payment",
    where: (labId, range) => ({ laboratoryId: labId, ...createdAtFilter(range) }),
    select: {
      id: true,
      orderId: true,
      status: true,
      amount: true,
      method: true,
      paidAt: true,
      notes: true,
      createdAt: true,
    },
    columns: [
      { header: "Payment ID", value: (r) => r.id },
      { header: "Order ID", value: (r) => r.orderId },
      { header: "Status", value: (r) => r.status },
      { header: "Amount", value: (r) => r.amount },
      { header: "Method", value: (r) => r.method },
      { header: "Paid At (PKT)", value: (r) => r.paidAt },
      { header: "Notes", value: (r) => r.notes },
      { header: "Created At (PKT)", value: (r) => r.createdAt },
    ],
  },

  reports: {
    label: "Reports",
    description: "Report records and versions (report snapshot content is not included).",
    dateFiltered: true,
    model: "report",
    where: (labId, range) => ({ laboratoryId: labId, ...createdAtFilter(range) }),
    select: {
      id: true,
      orderId: true,
      status: true,
      title: true,
      version: true,
      previousReportId: true,
      createdAt: true,
      updatedAt: true,
    },
    columns: [
      { header: "Report ID", value: (r) => r.id },
      { header: "Order ID", value: (r) => r.orderId },
      { header: "Status", value: (r) => r.status },
      { header: "Title", value: (r) => r.title },
      { header: "Version", value: (r) => r.version },
      { header: "Previous Report ID", value: (r) => r.previousReportId },
      { header: "Created At (PKT)", value: (r) => r.createdAt },
      { header: "Updated At (PKT)", value: (r) => r.updatedAt },
    ],
  },

  "laboratory-profile": {
    label: "Laboratory Profile",
    description: "Your laboratory profile. Date filters do not apply.",
    dateFiltered: false,
    model: "laboratory",
    where: (labId) => ({ id: labId }),
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      email: true,
      logoUrl: true,
      tagline: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
    columns: [
      { header: "Laboratory ID", value: (r) => r.id },
      { header: "Name", value: (r) => r.name },
      { header: "Address", value: (r) => r.address },
      { header: "Phone", value: (r) => r.phone, phone: true },
      { header: "Email", value: (r) => r.email },
      { header: "Logo URL", value: (r) => r.logoUrl },
      { header: "Tagline", value: (r) => r.tagline },
      { header: "Active", value: (r) => r.isActive },
      { header: "Created At (PKT)", value: (r) => r.createdAt },
      { header: "Updated At (PKT)", value: (r) => r.updatedAt },
    ],
  },

  "test-catalogue": {
    label: "Test Catalogue",
    description: "Your laboratory's own test definitions and prices. Date filters do not apply.",
    dateFiltered: false,
    model: "testDefinition",
    where: (labId) => ({ laboratoryId: labId }),
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      price: true,
      createdAt: true,
      updatedAt: true,
    },
    columns: [
      { header: "Test ID", value: (r) => r.id },
      { header: "Code", value: (r) => r.code },
      { header: "Name", value: (r) => r.name },
      { header: "Description", value: (r) => r.description },
      { header: "Price", value: (r) => r.price },
      { header: "Created At (PKT)", value: (r) => r.createdAt },
      { header: "Updated At (PKT)", value: (r) => r.updatedAt },
    ],
  },

  "test-parameters": {
    label: "Test Parameters",
    description: "Parameters, units and reference ranges of your tests. Date filters do not apply.",
    dateFiltered: false,
    model: "testParameter",
    where: (labId) => ({ testDefinition: { laboratoryId: labId } }),
    select: {
      id: true,
      name: true,
      unit: true,
      referenceRange: true,
      order: true,
      createdAt: true,
      testDefinition: { select: { code: true, name: true } },
    },
    columns: [
      { header: "Parameter ID", value: (r) => r.id },
      { header: "Test Code", value: (r) => r.testDefinition?.code },
      { header: "Test Name", value: (r) => r.testDefinition?.name },
      { header: "Parameter Name", value: (r) => r.name },
      { header: "Unit", value: (r) => r.unit },
      { header: "Reference Range", value: (r) => r.referenceRange },
      { header: "Display Order", value: (r) => r.order },
      { header: "Created At (PKT)", value: (r) => r.createdAt },
    ],
  },
};

const DATASET_KEYS = Object.keys(DATASETS);

/* -------------------------------------------------------------------------- */
/* Row collection                                                              */
/* -------------------------------------------------------------------------- */

async function collectRows(db, dataset, where, maxRows) {
  const delegate = db[dataset.model];

  const total = await delegate.count({ where });
  if (total > maxRows) {
    throw new ApiError(
      422,
      `${dataset.label} has ${total} rows, which exceeds the export limit of ${maxRows}. Narrow the date range and try again.`,
      { dataset: dataset.label, rowCount: total, maxRows }
    );
  }
  if (total === 0) return [];

  const rows = [];
  let cursor = null;

  for (;;) {
    const batch = await delegate.findMany({
      where,
      select: dataset.select,
      orderBy: ORDER_BY,
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    rows.push(...batch);

    if (rows.length > maxRows) {
      throw new ApiError(
        422,
        `${dataset.label} exceeds the export limit of ${maxRows} rows. Narrow the date range and try again.`,
        { dataset: dataset.label, maxRows }
      );
    }
    if (batch.length < BATCH_SIZE) break;
    cursor = batch[batch.length - 1].id;
  }

  return rows;
}

async function buildDatasetCsv({ db, key, laboratoryId, range, maxRows }) {
  const dataset = DATASETS[key];
  const where = dataset.where(laboratoryId, dataset.dateFiltered ? range.filter : null);
  const rows = await collectRows(db, dataset, where, maxRows);
  return {
    rowCount: rows.length,
    csv: buildCsv(dataset.columns, rows, { utcOffsetMinutes: UTC_OFFSET_MINUTES }),
  };
}

/* -------------------------------------------------------------------------- */
/* Naming helpers                                                              */
/* -------------------------------------------------------------------------- */

function slugify(value) {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "laboratory";
}

function dateStamp(now) {
  return formatDate(now, UTC_OFFSET_MINUTES).slice(0, 10).replaceAll("-", "");
}

/* -------------------------------------------------------------------------- */
/* Audited execution                                                           */
/* -------------------------------------------------------------------------- */

function safeErrorMessage(error) {
  return error instanceof ApiError && error.statusCode < 500
    ? error.message
    : "Export failed due to an internal error.";
}

async function runAudited({ user, meta, build, audit }) {
  try {
    const result = await build();

    // The audit record is written BEFORE the file is returned.
    // If it cannot be written, the export fails.
    await audit({
      laboratoryId: user.laboratoryId,
      userId: user.id,
      action: EXPORT_ACTIONS.COMPLETED,
      entity: EXPORT_ENTITY,
      details: {
        ...meta,
        status: "COMPLETED",
        rowCount: result.rowCount,
        ...(result.files ? { files: result.files } : {}),
      },
    });

    return result;
  } catch (error) {
    try {
      await audit({
        laboratoryId: user.laboratoryId,
        userId: user.id,
        action: EXPORT_ACTIONS.FAILED,
        entity: EXPORT_ENTITY,
        details: { ...meta, status: "FAILED", error: safeErrorMessage(error) },
      });
    } catch (auditError) {
      logger.error("Failed to record export failure audit log.", {
        message: auditError.message,
      });
    }

    if (error instanceof ApiError && error.statusCode < 500) throw error;

    logger.error("Data export failed.", { message: error.message, stack: error.stack });
    throw new ApiError(500, "Export failed. Please try again.");
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

export function listExportDatasets(user) {
  assertExportAccess(user);
  return DATASET_KEYS.map((key) => ({
    key,
    label: DATASETS[key].label,
    description: DATASETS[key].description,
    dateFiltered: DATASETS[key].dateFiltered,
  }));
}

export async function exportDataset(
  { user, dataset: key, format, from, to },
  deps = {}
) {
  const { db = prisma, audit = recordAuditLog, now = new Date() } = deps;
  const laboratoryId = assertExportAccess(user);

  if (typeof key !== "string" || !Object.hasOwn(DATASETS, key)) {
    throw new ApiError(404, "Unknown export dataset.", { field: "dataset" });
  }
  if (format !== undefined && String(format).toLowerCase() !== "csv") {
    throw new ApiError(400, "Only CSV format is supported.", { field: "format" });
  }

  const range = parseDateRange(from, to);
  const fileName = `${slugify(user.laboratory?.name)}-${key}-${dateStamp(now)}.csv`;
  const maxRows = getMaxRows();

  return runAudited({
    user,
    audit,
    meta: { dataset: key, format: "csv", from: range.from, to: range.to, fileName },
    build: async () => {
      const { csv, rowCount } = await buildDatasetCsv({
        db,
        key,
        laboratoryId,
        range,
        maxRows,
      });
      return {
        fileName,
        contentType: "text/csv; charset=utf-8",
        body: csv,
        rowCount,
      };
    },
  });
}

export async function exportComplete({ user, from, to }, deps = {}) {
  const { db = prisma, audit = recordAuditLog, now = new Date() } = deps;
  const laboratoryId = assertExportAccess(user);

  const range = parseDateRange(from, to);
  const fileName = `${slugify(user.laboratory?.name)}-complete-export-${dateStamp(now)}.zip`;
  const maxRows = getMaxRows();

  return runAudited({
    user,
    audit,
    meta: { dataset: "ALL", format: "zip", from: range.from, to: range.to, fileName },
    build: async () => {
      const entries = {};
      const files = {};
      let totalRows = 0;

      for (const key of DATASET_KEYS) {
        const { csv, rowCount } = await buildDatasetCsv({
          db,
          key,
          laboratoryId,
          range,
          maxRows,
        });
        entries[`${key}.csv`] = strToU8(csv);
        files[key] = rowCount;
        totalRows += rowCount;
      }

      const summary = [
        "LMS data export",
        `Laboratory: ${user.laboratory?.name || laboratoryId}`,
        `Generated at (PKT): ${formatDate(now, UTC_OFFSET_MINUTES)}`,
        `Date range: ${range.from || "start"} to ${range.to || "today"} (applies to dated datasets only)`,
        "",
        ...DATASET_KEYS.map((key) => `${key}.csv: ${files[key]} rows`),
        "",
      ].join("\r\n");
      entries["export-summary.txt"] = strToU8(summary);

      const zipped = zipSync(entries, { level: 6 });

      return {
        fileName,
        contentType: "application/zip",
        body: Buffer.from(zipped),
        rowCount: totalRows,
        files,
      };
    },
  });
}

export async function listExportHistory({ user, query }, deps = {}) {
  const { db = prisma } = deps;
  const laboratoryId = assertExportAccess(user);
  const { page, limit, skip } = parsePagination(query, 1, 10, 50);

  const where = {
    laboratoryId,
    entityType: EXPORT_ENTITY,
    action: { in: Object.values(EXPORT_ACTIONS) },
  };

  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: limit,
      select: { id: true, actorUserId: true, action: true, details: true, createdAt: true },
    }),
  ]);

  const actorIds = [...new Set(rows.map((row) => row.actorUserId).filter(Boolean))];
  const actors = actorIds.length
    ? await db.user.findMany({
        where: { id: { in: actorIds }, laboratoryId },
        select: { id: true, email: true },
      })
    : [];
  const actorById = new Map(actors.map((actor) => [actor.id, actor]));

  const items = rows.map((row) => {
    const details = row.details && typeof row.details === "object" ? row.details : {};
    return {
      id: row.id,
      createdAt: row.createdAt,
      status: row.action === EXPORT_ACTIONS.COMPLETED ? "COMPLETED" : "FAILED",
      dataset: details.dataset ?? null,
      format: details.format ?? null,
      rowCount: details.rowCount ?? null,
      from: details.from ?? null,
      to: details.to ?? null,
      fileName: details.fileName ?? null,
      error: details.error ?? null,
      actor: actorById.get(row.actorUserId) ?? null,
    };
  });

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}