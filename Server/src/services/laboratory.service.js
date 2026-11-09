import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";
import {
  assertUuid,
  EMAIL_PATTERN,
  parsePagination,
  normalizeString,
  normalizeOptionalString,
} from "../utils/validators.js";
import { recordAuditLog } from "../utils/audit.js";

const PROFILE_FIELDS = ["name", "address", "phone", "email", "logoUrl", "tagline"];
const PROFILE_OPTIONAL_FIELDS = PROFILE_FIELDS.filter((field) => field !== "name");

function handlePrismaError(error) {
  if (error?.code === "P2025") {
    throw new ApiError(404, "Laboratory not found.");
  }

  throw error;
}

function validateProfileData(data, { requireName = false } = {}) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new ApiError(400, "A laboratory profile object is required.");
  }

  const unknownFields = Object.keys(data).filter(
    (field) => !PROFILE_FIELDS.includes(field)
  );
  if (unknownFields.length > 0) {
    throw new ApiError(400, `Unsupported laboratory profile field: ${unknownFields[0]}.`, {
      field: unknownFields[0],
    });
  }

  const profile = {};
  for (const field of PROFILE_FIELDS) {
    if (data[field] === undefined) continue;
    if (typeof data[field] !== "string") {
      throw new ApiError(400, `${field} must be a string.`, { field });
    }

    const value = normalizeString(data[field]);
    if (!value) {
      if (field === "name" || requireName && field === "name") {
        throw new ApiError(400, "name cannot be empty.", { field: "name" });
      }
      profile[field] = null;
      continue;
    }

    const maxLength = field === "tagline" ? 160 : field === "address" ? 500 : 255;
    if (value.length > maxLength) {
      throw new ApiError(400, `${field} must be ${maxLength} characters or fewer.`, {
        field,
      });
    }

    if (field === "email" && !EMAIL_PATTERN.test(value)) {
      throw new ApiError(400, "email must be a valid email address.", { field });
    }

    if (field === "logoUrl") {
      let parsedUrl;
      try {
        parsedUrl = new URL(value);
      } catch {
        throw new ApiError(400, "logoUrl must be a valid HTTP or HTTPS URL.", { field });
      }
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new ApiError(400, "logoUrl must be a valid HTTP or HTTPS URL.", { field });
      }
    }

    profile[field] = value;
  }

  if (requireName && !profile.name) {
    throw new ApiError(400, "name is required.", { field: "name" });
  }

  return profile;
}

function buildLaboratoryData(data, name) {
  const profile = { name };

  for (const field of PROFILE_OPTIONAL_FIELDS) {
    if (data[field] !== undefined) {
      profile[field] = normalizeOptionalString(data[field]) ?? null;
    }
  }

  return profile;
}

const laboratorySelect = {
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
  _count: { select: { users: true, patients: true } },
};

async function createLaboratory({ data }) {
  const name = normalizeString(data.name);

  if (!name) {
    throw new ApiError(400, "name is required.", { field: "name" });
  }

  const lab = await prisma.laboratory.create({
    data: buildLaboratoryData(data, name),
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

  const updateData = validateProfileData(data);

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

async function getLaboratoryProfile({ laboratoryId }) {
  assertUuid(laboratoryId, "laboratoryId");

  try {
    return await prisma.laboratory.findUniqueOrThrow({
      where: { id: laboratoryId },
      select: laboratorySelect,
    });
  } catch (error) {
    handlePrismaError(error);
  }
}

async function updateLaboratoryProfile({ user, data }) {
  if (user.role !== "LAB_ADMIN") {
    throw new ApiError(403, "Only laboratory administrators can update settings.");
  }
  if (!user.laboratoryId) {
    throw new ApiError(403, "User must be assigned to a laboratory before updating settings.");
  }

  return updateLaboratory({
    laboratoryId: user.laboratoryId,
    data: validateProfileData(data),
  });
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
  getLaboratoryProfile,
  updateLaboratoryProfile,
  setLaboratoryStatus,
  validateProfileData,
};
