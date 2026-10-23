import prisma from "../config/prisma.js";

export async function recordAuditLog({
  laboratoryId = null,
  userId = null,
  action,
  entity,
  entityId,
  details = null,
}) {
  try {
    return await prisma.auditLog.create({
      data: {
        laboratoryId,
        userId,
        action,
        entity,
        entityId: String(entityId),
        details: details ? details : undefined,
      },
    });
  } catch (error) {
    // Audit logging should not crash the main business transaction, but should be reported
    console.error("Failed to record audit log:", error);
    return null;
  }
}
