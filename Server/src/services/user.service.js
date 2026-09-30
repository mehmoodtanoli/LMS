import prisma from "../config/prisma.js";

import ApiError from "../utils/ApiError.js";

import { hashPassword } from "../utils/password.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VALID_ROLES = ["SUPERADMIN", "LAB_ADMIN", "LAB_TECH"];

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
  laboratory: {
    select: {
      id: true,
      name: true,
      isActive: true,
    },
  },
  createdAt: true,
  updatedAt: true,
};

function assertActor(actor) {
  if (!actor || !actor.role) {
    throw new ApiError(401, "Authentication information is missing.");
  }
}

function assertLabAdminOwnLab(actor) {
  if (actor.role === "LAB_ADMIN" && !actor.laboratoryId) {
    throw new ApiError(403, "LAB_ADMIN must be associated with a laboratory.");
  }
}

function assertCanManageTarget({ actor, targetUser }) {
  assertActor(actor);

  if (actor.role === "SUPERADMIN") {
    return;
  }

  if (actor.role !== "LAB_ADMIN") {
    throw new ApiError(403, "You are not authorized to manage users.");
  }

  assertLabAdminOwnLab(actor);

  if (targetUser.role !== "LAB_TECH") {
    throw new ApiError(403, "LAB_ADMIN can only manage LAB_TECH users.");
  }

  if (targetUser.laboratoryId !== actor.laboratoryId) {
    throw new ApiError(
      403,
      "You are not authorized to manage users from another laboratory.",
    );
  }
}

async function validateRoleAndLaboratory({ role, laboratoryId }) {
  if (!role || !VALID_ROLES.includes(role)) {
    throw new ApiError(
      400,
      "role must be one of SUPERADMIN, LAB_ADMIN, or LAB_TECH.",
      {
        field: "role",
        validValues: VALID_ROLES,
      },
    );
  }

  if (role === "LAB_ADMIN" || role === "LAB_TECH") {
    const normalizedLabId = normalizeString(laboratoryId);

    if (!normalizedLabId) {
      throw new ApiError(400, `laboratoryId is required for ${role} users.`, {
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

async function createUser({ data, actor }) {
  assertActor(actor);

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

  let role = data.role;
  let laboratoryId = data.laboratoryId;

  if (actor.role === "LAB_ADMIN") {
    assertLabAdminOwnLab(actor);

    role = "LAB_TECH";
    laboratoryId = actor.laboratoryId;
  }

  laboratoryId = await validateRoleAndLaboratory({
    role,
    laboratoryId,
  });

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

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
      role,
      laboratoryId,
    },
    select: userSelect,
  });
}

async function listUsers({ query, actor }) {
  assertActor(actor);

  const { page, limit } = parsePagination(query);

  const where = {};

  const role = normalizeString(query?.role).toUpperCase();

  if (actor.role === "LAB_ADMIN") {
    assertLabAdminOwnLab(actor);

    where.role = "LAB_TECH";
    where.laboratoryId = actor.laboratoryId;
  } else {
    if (role) {
      if (!VALID_ROLES.includes(role)) {
        throw new ApiError(
          400,
          "role must be one of SUPERADMIN, LAB_ADMIN, or LAB_TECH.",
          {
            field: "role",
            validValues: VALID_ROLES,
          },
        );
      }

      where.role = role;
    }

    const laboratoryId = normalizeString(query?.laboratoryId);

    if (laboratoryId) {
      assertUuid(laboratoryId, "laboratoryId");
      where.laboratoryId = laboratoryId;
    }
  }

  const search = normalizeString(query?.search);

  if (search) {
    where.email = {
      contains: search,
      mode: "insensitive",
    };
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

async function getUserById({ userId, actor }) {
  assertUuid(userId, "id");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userSelect,
  });

  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  assertCanManageTarget({
    actor,
    targetUser: user,
  });

  return user;
}

async function updateUser({ userId, data, actor }) {
  assertUuid(userId, "id");

  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!existingUser) {
    throw new ApiError(404, "User not found.");
  }

  assertCanManageTarget({
    actor,
    targetUser: existingUser,
  });

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

  if (actor.role === "SUPERADMIN") {
    if (data.role !== undefined || data.laboratoryId !== undefined) {
      const role = data.role ?? existingUser.role;

      const laboratoryId = await validateRoleAndLaboratory({
        role,
        laboratoryId: data.laboratoryId ?? existingUser.laboratoryId,
      });

      updateData.role = role;
      updateData.laboratoryId = laboratoryId;
    }
  } else if (data.role !== undefined || data.laboratoryId !== undefined) {
    throw new ApiError(
      403,
      "LAB_ADMIN cannot change a LAB_TECH user's role or laboratory.",
    );
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

async function setUserStatus({ userId, isActive, actor }) {
  assertUuid(userId, "id");

  if (typeof isActive !== "boolean") {
    throw new ApiError(400, "isActive must be a boolean.", {
      field: "isActive",
    });
  }

  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!existingUser) {
    throw new ApiError(404, "User not found.");
  }

  assertCanManageTarget({
    actor,
    targetUser: existingUser,
  });

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
