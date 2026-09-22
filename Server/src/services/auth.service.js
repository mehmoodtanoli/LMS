import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { signToken } from "../utils/token.js";

const VALID_ROLES = ["SUPERADMIN", "LAB_ADMIN"];
const PUBLIC_REGISTRATION_ROLE = "LAB_ADMIN";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

async function registerUser({ actor, email, password, laboratoryId = null }) {
  if (!actor || actor.role !== "SUPERADMIN") {
    throw new ApiError(
      403,
      "Only SUPERADMIN users can register new laboratory accounts.",
    );
  }

  const normalizedEmail =
    typeof email === "string" ? email.trim().toLowerCase() : "";

  if (!normalizedEmail) {
    throw new ApiError(400, "Email is required.", { field: "email" });
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(normalizedEmail)) {
    throw new ApiError(400, "Please provide a valid email address.", {
      field: "email",
    });
  }

  if (!password || password.length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters long.", {
      field: "password",
    });
  }

  if (!laboratoryId) {
    throw new ApiError(
      400,
      "Laboratory ID is required for LAB_ADMIN registration.",
      {
        field: "laboratoryId",
      },
    );
  }

  if (!UUID_PATTERN.test(laboratoryId)) {
    throw new ApiError(400, "Laboratory ID must be a valid UUID.", {
      field: "laboratoryId",
    });
  }

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

  return sanitizeUser(user);
}

async function loginUser({ email, password }) {
  const normalizedEmail =
    typeof email === "string" ? email.trim().toLowerCase() : "";

  if (!normalizedEmail || !password) {
    throw new ApiError(400, "Email and password are required.", {
      fields: ["email", "password"],
    });
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw new ApiError(401, "Invalid email or password.");
  }

  const isPasswordValid = await comparePassword(password, user.passwordHash);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid email or password.");
  }

  if (!user.isActive) {
    throw new ApiError(403, "This account has been deactivated.");
  }

  const token = signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    user: sanitizeUser(user),
    token,
  };
}

async function getCurrentUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(401, "User not found or token is invalid.");
  }

  return sanitizeUser(user);
}

export { VALID_ROLES, sanitizeUser, registerUser, loginUser, getCurrentUser };