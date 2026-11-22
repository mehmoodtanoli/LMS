import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";
import { EXPORT_ACTIONS, EXPORT_ENTITY } from "../services/export.service.js";

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_EXPORTS = 10;

/**
 * Limits download requests per user. Two layers:
 * 1. A database count of recent export audit rows (survives serverless restarts).
 * 2. An in-memory counter that blocks rapid parallel requests before their
 *    audit rows exist.
 * Failed exports count too, because they use the same resources.
 */
export function createExportRateLimiter({
  windowMs = WINDOW_MS,
  max = MAX_EXPORTS,
  db = prisma,
} = {}) {
  const buckets = new Map();

  return async function exportRateLimiter(req, res, next) {
    try {
      const user = req.user;
      if (!user?.id) {
        throw new ApiError(401, "Authentication is required.");
      }

      const now = Date.now();
      const bucket = buckets.get(user.id);
      const fresh = Boolean(bucket) && now - bucket.startedAt < windowMs;

      if (fresh && bucket.count >= max) {
        throw new ApiError(
          429,
          "Too many export requests. Please wait a few minutes and try again."
        );
      }

      const recent = await db.auditLog.count({
        where: {
          laboratoryId: user.laboratoryId,
          actorUserId: user.id,
          entityType: EXPORT_ENTITY,
          action: { in: Object.values(EXPORT_ACTIONS) },
          createdAt: { gte: new Date(now - windowMs) },
        },
      });

      if (recent >= max) {
        throw new ApiError(
          429,
          "Too many export requests. Please wait a few minutes and try again."
        );
      }

      if (fresh) {
        bucket.count += 1;
      } else {
        buckets.set(user.id, { count: 1, startedAt: now });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export default createExportRateLimiter();