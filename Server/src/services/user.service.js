import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";
import { hashPassword } from "../utils/password.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = ["SUPERADMIN", "LAB_ADMIN"];
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
  if (error?.code === "P2002") {
    throw new ApiError(409, "A user with this email already exists.", {
      field: "email",
    });
  }

  if (error?.code === "P2025") {
    throw new ApiError(404, "User not found.");
  }

  throw error;
}

const userSelect = {
  id: true,
  email: true,
  role: true,
  isActive: true,
  laboratoryId: true,
  laboratory: { select: { id: true, name: true, isActive: true } },
  createdAt: true,
  updatedAt: true,
};

async function validateRoleAndLaboratory({ role, laboratoryId }) {
  if (!role || !VALID_ROLES.includes(role)) {
    throw new ApiError(400, "role must be one of SUPERADMIN or LAB_ADMIN.", {
      field: "role",
      validValues: VALID_ROLES,
    });
  }

  if (role === "LAB_ADMIN") {
    const normalizedLabId = normalizeString(laboratoryId);

    if (!normalizedLabId) {
      throw new ApiError(400, "laboratoryId is required for LAB_ADMIN users.", {
        field: "laboratoryId",
      });
    }

    assertUuid(normalizedLabId, "laboratoryId");

    const laboratory = await prisma.laboratory.findUnique({
      where: { id: normalizedLabId },
    });

    if (!laboratory) {
      throw new ApiError(404, "Laboratory not found.", {
        field: "laboratoryId",
      });
    }

    return normalizedLabId;
  }

  return null;
}

async function createUser({ data }) {
  const email = normalizeString(data.email).toLowerCase();

  if (!email) {
    throw new ApiError(400, "email is required.", { field: "email" });
  }

  if (!EMAIL_PATTERN.test(email)) {
    throw new ApiError(400, "Please provide a valid email address.", {
      field: "email",
    });
  }

  if (!data.password || String(data.password).length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters long.", {
      field: "password",
    });
  }

  const laboratoryId = await validateRoleAndLaboratory({
    role: data.role,
    laboratoryId: data.laboratoryId,
  });

  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    throw new ApiError(409, "A user with this email already exists.", {
      field: "email",
    });
  }

  const passwordHash = await hashPassword(data.password);

  return prisma.user.create({
    data: {
      email,
      passwordHash,
      role: data.role,
      laboratoryId,
    },
    select: userSelect,
  });
}

async function listUsers({ query }) {
  const { page, limit } = parsePagination(query);
  const where = {};

  const role = normalizeString(query?.role).toUpperCase();
  if (role) {
    if (!VALID_ROLES.includes(role)) {
      throw new ApiError(400, "role must be one of SUPERADMIN or LAB_ADMIN.", {
        field: "role",
        validValues: VALID_ROLES,
      });
    }
    where.role = role;
  }

  const laboratoryId = normalizeString(query?.laboratoryId);
  if (laboratoryId) {
    assertUuid(laboratoryId, "laboratoryId");
    where.laboratoryId = laboratoryId;
  }

  const search = normalizeString(query?.search);
  if (search) {
    where.email = { contains: search, mode: "insensitive" };
  }

  const skip = (page - 1) * limit;

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function getUserById({ userId }) {
  assertUuid(userId, "id");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userSelect,
  });

  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  return user;
}

async function updateUser({ userId, data }) {
  assertUuid(userId, "id");

  const existingUser = await prisma.user.findUnique({ where: { id: userId } });

  if (!existingUser) {
    throw new ApiError(404, "User not found.");
  }

  const updateData = {};

  if (data.email !== undefined) {
    const email = normalizeString(data.email).toLowerCase();

    if (!email || !EMAIL_PATTERN.test(email)) {
      throw new ApiError(400, "Please provide a valid email address.", {
        field: "email",
      });
    }

    updateData.email = email;
  }

  if (data.password !== undefined) {
    if (String(data.password).length < 6) {
      throw new ApiError(400, "Password must be at least 6 characters long.", {
        field: "password",
      });
    }

    updateData.passwordHash = await hashPassword(data.password);
  }

  if (data.role !== undefined || data.laboratoryId !== undefined) {
    const role = data.role ?? existingUser.role;
    const laboratoryId = await validateRoleAndLaboratory({
      role,
      laboratoryId: data.laboratoryId ?? existingUser.laboratoryId,
    });

    updateData.role = role;
    updateData.laboratoryId = laboratoryId;
  }

  if (Object.keys(updateData).length === 0) {
    throw new ApiError(400, "At least one field must be provided.");
  }

  try {
    return await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: userSelect,
    });
  } catch (error) {
    handlePrismaError(error);
  }
}

async function setUserStatus({ userId, isActive }) {
  assertUuid(userId, "id");

  if (typeof isActive !== "boolean") {
    throw new ApiError(400, "isActive must be a boolean.", {
      field: "isActive",
    });
  }

  try {
    return await prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: userSelect,
    });
  } catch (error) {
    handlePrismaError(error);
  }
}

export { createUser, listUsers, getUserById, updateUser, setUserStatus };
