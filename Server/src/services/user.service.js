import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";
import { hashPassword } from "../utils/password.js";
import {
  assertUuid,
  parsePagination,
  normalizeString,
  EMAIL_PATTERN,
} from "../utils/validators.js";
import { recordAuditLog } from "../utils/audit.js";

const VALID_ROLES = ["SUPERADMIN", "LAB_ADMIN", "LAB_TECH"];

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

async function validateRoleAndLaboratory({ role, laboratoryId }) {
  if (!role || !VALID_ROLES.includes(role)) {
    throw new ApiError(
      400,
      `role must be one of ${VALID_ROLES.join(", ")}.`,
      {
        field: "role",
        validValues: VALID_ROLES,
      }
    );
  }

  if (role === "LAB_ADMIN" || role === "LAB_TECH") {
    const normalizedLabId = normalizeString(laboratoryId);

    if (!normalizedLabId) {
      throw new ApiError(
        400,
        `laboratoryId is required for ${role} users.`,
        {
          field: "laboratoryId",
        }
      );
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

async function createUser({ actor, data }) {
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

  if (String(data.password).length > 128) {
    throw new ApiError(400, "Password cannot exceed 128 characters.", {
      field: "password",
    });
  }

  const role = data.role ? normalizeString(data.role).toUpperCase() : "LAB_ADMIN";

  let laboratoryId = data.laboratoryId;
  if (actor?.role === "LAB_ADMIN") {
    laboratoryId = actor.laboratoryId;
  }

  const validatedLabId = await validateRoleAndLaboratory({
    role,
    laboratoryId,
  });

  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    throw new ApiError(409, "A user with this email already exists.", {
      field: "email",
    });
  }

  const passwordHash = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role,
      laboratoryId: validatedLabId,
    },
    select: userSelect,
  });

  await recordAuditLog({
    laboratoryId: validatedLabId,
    userId: actor?.id,
    action: "USER_CREATED",
    entity: "User",
    entityId: user.id,
    details: { email, role },
  });

  return user;
}

async function listUsers({ query }) {
  const { page, limit } = parsePagination(query);
  const where = {};

  const role = normalizeString(query?.role).toUpperCase();
  if (role) {
    if (!VALID_ROLES.includes(role)) {
      throw new ApiError(
        400,
        `role must be one of ${VALID_ROLES.join(", ")}.`,
        {
          field: "role",
          validValues: VALID_ROLES,
        }
      );
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

async function updateUser({ actor, userId, data }) {
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

  if (data.password !== undefined && data.password !== "") {
    if (String(data.password).length < 6) {
      throw new ApiError(400, "Password must be at least 6 characters long.", {
        field: "password",
      });
    }

    if (String(data.password).length > 128) {
      throw new ApiError(400, "Password cannot exceed 128 characters.", {
        field: "password",
      });
    }

    updateData.passwordHash = await hashPassword(data.password);
  }

  // Handle role / laboratoryId update (Fixes A8: do not reject if LAB_ADMIN keeps same role/lab)
  const isChangingRole = data.role !== undefined && data.role !== existingUser.role;
  const isChangingLab =
    data.laboratoryId !== undefined &&
    data.laboratoryId !== existingUser.laboratoryId;

  if (isChangingRole || isChangingLab) {
    if (actor && actor.role !== "SUPERADMIN") {
      throw new ApiError(
        403,
        "Only SUPERADMIN users can change roles or laboratory assignments."
      );
    }

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
    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: userSelect,
    });

    await recordAuditLog({
      laboratoryId: updated.laboratoryId,
      userId: actor?.id,
      action: "USER_UPDATED",
      entity: "User",
      entityId: userId,
      details: { email: updated.email, role: updated.role },
    });

    return updated;
  } catch (error) {
    handlePrismaError(error);
  }
}

async function setUserStatus({ actor, userId, isActive }) {
  assertUuid(userId, "id");

  if (typeof isActive !== "boolean") {
    throw new ApiError(400, "isActive must be a boolean.", {
      field: "isActive",
    });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: userSelect,
    });

    await recordAuditLog({
      laboratoryId: updated.laboratoryId,
      userId: actor?.id,
      action: isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      entity: "User",
      entityId: userId,
    });

    return updated;
  } catch (error) {
    handlePrismaError(error);
  }
}

export { createUser, listUsers, getUserById, updateUser, setUserStatus };
