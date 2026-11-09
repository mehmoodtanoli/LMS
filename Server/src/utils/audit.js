import prisma from "../config/prisma.js";
import logger from "./logger.js";

export async function recordAuditLog({
  laboratoryId = null,
  userId = null,
  action,
  entity,
  entityId = null,
  details = null,
  db = prisma,
}) {
  try {
    return await db.auditLog.create({
      data: {
        laboratoryId,
        actorUserId: userId,
        action,
        entityType: entity,
        entityId: entityId === null ? null : String(entityId),
        details: details ?? undefined,
      },
    });
  } catch (error) {
    logger.error("Failed to record audit log.", {
      action,
      entity,
      entityId,
      message: error.message,
      stack: error.stack,
    });
    throw error;
  }
}
