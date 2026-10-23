import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";
import {
  assertUuid,
  parsePagination,
  normalizeString,
} from "../utils/validators.js";
import { recordAuditLog } from "../utils/audit.js";

function handlePrismaError(error) {
  if (error?.code === "P2025") {
    throw new ApiError(404, "Laboratory not found.");
  }

  throw error;
}

const laboratorySelect = {
  id: true,
  name: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { users: true, patients: true } },
};

async function createLaboratory({ data }) {
  const name = normalizeString(data.name);

  if (!name) {
    throw new ApiError(400, "name is required.", { field: "name" });
  }

  const lab = await prisma.laboratory.create({
    data: { name },
    select: laboratorySelect,
  });

  await recordAuditLog({
    laboratoryId: lab.id,
    action: "LABORATORY_CREATED",
    entity: "Laboratory",
    entityId: lab.id,
    details: { name },
  });

  return lab;
}

async function listLaboratories({ query }) {
  const { page, limit } = parsePagination(query);
  const search = normalizeString(query?.search);
  const where = search
    ? { name: { contains: search, mode: "insensitive" } }
    : {};
  const skip = (page - 1) * limit;

  const [laboratories, total] = await prisma.$transaction([
    prisma.laboratory.findMany({
      where,
      select: laboratorySelect,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.laboratory.count({ where }),
  ]);

  return {
    laboratories,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function getLaboratoryById({ laboratoryId }) {
  assertUuid(laboratoryId, "id");

  const laboratory = await prisma.laboratory.findUnique({
    where: { id: laboratoryId },
    select: {
      ...laboratorySelect,
      users: {
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!laboratory) {
    throw new ApiError(404, "Laboratory not found.");
  }

  return laboratory;
}

async function updateLaboratory({ laboratoryId, data }) {
  assertUuid(laboratoryId, "id");

  const updateData = {};

  if (data.name !== undefined) {
    const name = normalizeString(data.name);

    if (!name) {
      throw new ApiError(400, "name cannot be empty.", { field: "name" });
    }

    updateData.name = name;
  }

  if (Object.keys(updateData).length === 0) {
    throw new ApiError(400, "At least one field must be provided.");
  }

  try {
    const updated = await prisma.laboratory.update({
      where: { id: laboratoryId },
      data: updateData,
      select: laboratorySelect,
    });

    await recordAuditLog({
      laboratoryId,
      action: "LABORATORY_UPDATED",
      entity: "Laboratory",
      entityId: laboratoryId,
      details: updateData,
    });

    return updated;
  } catch (error) {
    handlePrismaError(error);
  }
}

async function setLaboratoryStatus({ laboratoryId, isActive }) {
  assertUuid(laboratoryId, "id");

  if (typeof isActive !== "boolean") {
    throw new ApiError(400, "isActive must be a boolean.", {
      field: "isActive",
    });
  }

  try {
    const updated = await prisma.laboratory.update({
      where: { id: laboratoryId },
      data: { isActive },
      select: laboratorySelect,
    });

    await recordAuditLog({
      laboratoryId,
      action: isActive ? "LABORATORY_ACTIVATED" : "LABORATORY_DEACTIVATED",
      entity: "Laboratory",
      entityId: laboratoryId,
    });

    return updated;
  } catch (error) {
    handlePrismaError(error);
  }
}

export {
  createLaboratory,
  listLaboratories,
  getLaboratoryById,
  updateLaboratory,
  setLaboratoryStatus,
};
