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
const PRIVILEGED_ROLES = ["SUPERADMIN", "LAB_ADMIN"];

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

function assertUserManagementAccess(actor) {
  if (actor?.role === "SUPERADMIN") return;
  if (actor?.role === "LAB_ADMIN" && actor.laboratoryId) return;
  throw new ApiError(403, "You are not authorized to manage users.");
}

function laboratoryStaffWhere(actor) {
  return {
    laboratoryId: actor.laboratoryId,
    id: { not: actor.id },
    role: { notIn: PRIVILEGED_ROLES },
  };
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
  assertUserManagementAccess(actor);
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
    if (role !== "LAB_TECH") {
      throw new ApiError(
        403,
        "LAB_ADMIN users may only create LAB_TECH accounts."
      );
    }
    if (!actor.laboratoryId) {
      throw new ApiError(403, "User must be assigned to a laboratory.");
    }
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

async function listUsers({ actor, query }) {
  assertUserManagementAccess(actor);
  const { page, limit } = parsePagination(query);
  const where = {};

  if (actor?.role === "LAB_ADMIN") {
    if (!actor.laboratoryId) {
      throw new ApiError(403, "User must be assigned to a laboratory.");
    }
    Object.assign(where, laboratoryStaffWhere(actor));
  }

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
    if (actor?.role === "LAB_ADMIN") {
      where.role = { equals: role, notIn: PRIVILEGED_ROLES };
    } else {
      where.role = role;
    }
  }

  const laboratoryId = normalizeString(query?.laboratoryId);
  if (laboratoryId) {
    assertUuid(laboratoryId, "laboratoryId");
    if (actor?.role === "LAB_ADMIN" && laboratoryId !== actor.laboratoryId) {
      throw new ApiError(403, "You may only access users in your assigned laboratory.");
    }
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

async function getUserById({ actor, userId }) {
  assertUuid(userId, "id");

  assertUserManagementAccess(actor);
  if (actor.role === "LAB_ADMIN" && !actor.laboratoryId) {
    throw new ApiError(403, "User must be assigned to a laboratory.");
  }
  const user = await prisma.user.findFirst({
    where: actor.role === "LAB_ADMIN"
      ? { AND: [laboratoryStaffWhere(actor), { id: userId }] }
      : { id: userId },
    select: userSelect,
  });

  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  return user;
}

async function updateUser({ actor, userId, data }) {
  assertUuid(userId, "id");

  assertUserManagementAccess(actor);

  const existingUser = await prisma.user.findFirst({
    where: actor.role === "LAB_ADMIN"
      ? { AND: [laboratoryStaffWhere(actor), { id: userId }] }
      : { id: userId },
  });

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
    if (actor?.role !== "SUPERADMIN") {
      throw new ApiError(
        403,
        "LAB_ADMIN users cannot change roles or laboratory assignments."
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

  assertUserManagementAccess(actor);

  try {
    const target = await prisma.user.findFirst({
      where: actor.role === "LAB_ADMIN"
        ? { AND: [laboratoryStaffWhere(actor), { id: userId }] }
        : { id: userId },
      select: { id: true },
    });
    if (!target) {
      throw new ApiError(404, "User not found.");
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
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
