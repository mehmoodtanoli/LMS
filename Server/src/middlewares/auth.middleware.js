import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { verifyToken } from "../utils/token.js";
import { readSessionCookie } from "../utils/sessionCookie.js";

const authMiddleware = asyncHandler(async (req, res, next) => {
  // Browser sessions use the httpOnly cookie; API clients can still send a Bearer token.
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : readSessionCookie(req);

  if (!token) {
    throw new ApiError(401, "Authentication token is missing.");
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (error) {
    throw new ApiError(401, "Invalid or expired token.");
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
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

  if (!user.isActive) {
    throw new ApiError(403, "This account has been deactivated.");
  }

  // A password change ends every session started before it.
  if (
    user.passwordChangedAt &&
    decoded.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)
  ) {
    throw new ApiError(401, "Your password was changed. Please log in again.");
  }

  // Reject requests when the laboratory is inactive (SUPERADMIN is exempt) (Fixes A9)
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

  req.user = {
    id: user.id,
    email: user.email,
    role: user.role,
    laboratoryId: user.laboratoryId,
    laboratory: user.laboratory,
  };

  next();
});

const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    throw new ApiError(403, "You are not authorized to perform this action.");
  }

  next();
};

export default authMiddleware;
export { requireRole };
