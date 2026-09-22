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

function assertUuid(value, fieldName) {
  if (!UUID_PATTERN.test(value)) {
    throw new ApiError(400, `${fieldName} must be a valid UUID.`, {
      field: fieldName,
    });
  }
}

function parsePagination(query) {
  const page = Number(query?.page ?? DEFAULT_PAGE);
  const limit = Number(query?.limit ?? DEFAULT_LIMIT);

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

  return { page, limit: Math.min(limit, MAX_LIMIT) };
}

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

  return prisma.laboratory.create({
    data: { name },
    select: laboratorySelect,
  });
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
    return await prisma.laboratory.update({
      where: { id: laboratoryId },
      data: updateData,
      select: laboratorySelect,
    });
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
    return await prisma.laboratory.update({
      where: { id: laboratoryId },
      data: { isActive },
      select: laboratorySelect,
    });
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
