import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { signToken } from "../utils/token.js";
import { assertUuid, EMAIL_PATTERN, normalizeString } from "../utils/validators.js";
import { recordAuditLog } from "../utils/audit.js";

const VALID_ROLES = ["SUPERADMIN", "LAB_ADMIN", "LAB_TECH"];
const PUBLIC_REGISTRATION_ROLE = "LAB_ADMIN";

// Dummy bcrypt hash to equalize response timing when user is not found (Fixes S1)
const DUMMY_BCRYPT_HASH =
  "$2a$12$e80yq9gq5wY4aV7Q/3PzCO7g1U0m7G77nS4U70ZgZ.JkP7Yv1fW2u";

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function validatePasswordStrength(password, fieldName = "password") {
  if (!password || typeof password !== "string" || password.length < 6) {
    throw new ApiError(400, `${fieldName} must be at least 6 characters long.`, {
      field: fieldName,
    });
  }

  if (password.length > 128) {
    throw new ApiError(400, `${fieldName} cannot exceed 128 characters.`, {
      field: fieldName,
    });
  }
}

async function registerUser({ actor, email, password, laboratoryId = null }) {
  if (!actor || actor.role !== "SUPERADMIN") {
    throw new ApiError(
      403,
      "Only SUPERADMIN users can register new laboratory accounts."
    );
  }

  const normalizedEmail = normalizeString(email).toLowerCase();

  if (!normalizedEmail) {
    throw new ApiError(400, "Email is required.", { field: "email" });
  }

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    throw new ApiError(400, "Please provide a valid email address.", {
      field: "email",
    });
  }

  validatePasswordStrength(password, "password");

  if (!laboratoryId) {
    throw new ApiError(
      400,
      "Laboratory ID is required for LAB_ADMIN registration.",
      { field: "laboratoryId" }
    );
  }

  assertUuid(laboratoryId, "laboratoryId");

  const laboratory = await prisma.laboratory.findUnique({
    where: { id: laboratoryId },
  });

  if (!laboratory) {
    throw new ApiError(404, "Laboratory not found.", {
      field: "laboratoryId",
    });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    throw new ApiError(409, "A user with this email already exists.", {
      field: "email",
    });
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      role: PUBLIC_REGISTRATION_ROLE,
      laboratoryId,
    },
  });

  await recordAuditLog({
    laboratoryId,
    userId: actor.id,
    action: "USER_REGISTERED",
    entity: "User",
    entityId: user.id,
    details: { email: normalizedEmail, role: PUBLIC_REGISTRATION_ROLE },
  });

  return sanitizeUser(user);
}

async function loginUser({ email, password }) {
  const normalizedEmail = normalizeString(email).toLowerCase();

  if (!normalizedEmail || !password) {
    throw new ApiError(400, "Email and password are required.", {
      fields: ["email", "password"],
    });
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      laboratory: {
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      },
    },
  });

  if (!user) {
    // Timing attack mitigation: always run bcrypt comparison (Fixes S1)
    await comparePassword(password, DUMMY_BCRYPT_HASH);
    throw new ApiError(401, "Invalid email or password.");
  }

  const isPasswordValid = await comparePassword(password, user.passwordHash);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid email or password.");
  }

  if (!user.isActive) {
    throw new ApiError(403, "This account has been deactivated.");
  }

  // Reject login when the laboratory is inactive (SUPERADMIN is exempt) (Fixes A9)
  if (
    user.role !== "SUPERADMIN" &&
    user.laboratory &&
    !user.laboratory.isActive
  ) {
    throw new ApiError(
      403,
      "This laboratory has been suspended or deactivated. Please contact administration."
    );
  }

  const token = signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  await recordAuditLog({
    laboratoryId: user.laboratoryId,
    userId: user.id,
    action: "USER_LOGIN",
    entity: "User",
    entityId: user.id,
  });

  return {
    user: sanitizeUser(user),
    token,
  };
}

async function getCurrentUser(userId) {
  assertUuid(userId, "userId");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      laboratory: {
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      },
    },
  });

  if (!user) {
    throw new ApiError(401, "User not found or token is invalid.");
  }

  return sanitizeUser(user);
}

async function changeUserPassword({ userId, currentPassword, newPassword }) {
  assertUuid(userId, "userId");

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, "Current password and new password are required.", {
      fields: ["currentPassword", "newPassword"],
    });
  }

  validatePasswordStrength(newPassword, "newPassword");

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  const isCurrentValid = await comparePassword(currentPassword, user.passwordHash);
  if (!isCurrentValid) {
    throw new ApiError(400, "Current password is incorrect.", {
      field: "currentPassword",
    });
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  await recordAuditLog({
    laboratoryId: user.laboratoryId,
    userId: user.id,
    action: "PASSWORD_CHANGED",
    entity: "User",
    entityId: user.id,
  });

  return { message: "Password updated successfully." };
}

export {
  VALID_ROLES,
  sanitizeUser,
  registerUser,
  loginUser,
  getCurrentUser,
  changeUserPassword,
};