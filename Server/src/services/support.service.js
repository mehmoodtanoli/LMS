import crypto from "crypto";
import prisma from "../config/prisma.js";
import env from "../config/env.js";
import logger from "../utils/logger.js";
import ApiError from "../utils/ApiError.js";
import { recordAuditLog } from "../utils/audit.js";
import { recordSupportSubmission } from "../middlewares/rateLimiter.middleware.js";
import { validateAndSanitizeSupportTicketPayload } from "../utils/sanitizers.js";
import sheetsService from "./sheets.service.js";

const MAX_REFERENCE_ATTEMPTS = 5;

/**
 * Generates a human-readable support reference code: SUP-YYYYMMDD-XXXX
 */
function generateReferenceCode() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const randomSuffix = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `SUP-${year}${month}${day}-${randomSuffix}`;
}

/**
 * Returns public support configuration for authenticated users.
 */
export async function getSupportConfig(user) {
  const whatsappNumber = env.supportWhatsAppNumber || process.env.SUPPORT_WHATSAPP_NUMBER || "";

  return {
    whatsappNumber,
    supportEmail: "support@lms.example.com",
    operatingHours: "Monday to Saturday, 9:00 AM - 6:00 PM PKT",
  };
}

/**
 * Creates a new support ticket:
 * 1. Sanitizes inputs & enforces length caps / control character rules.
 * 2. Persists ticket to PostgreSQL (store first, with referenceCode retry on conflict).
 * 3. Dispatches to Google Sheets webhook with 5s timeout.
 * 4. Updates syncedToSheets=true on success, or keeps false on error without failing the request.
 * 5. Returns ticket summary with referenceCode.
 */
export async function createSupportTicket({ user, payload }) {
  if (!user || !user.id) {
    throw new ApiError(401, "Authentication required to submit support requests.");
  }

  // 1. Sanitize & validate payload
  const sanitized = validateAndSanitizeSupportTicketPayload(payload);

  // 2. Persist to PostgreSQL (Store First) with retry on referenceCode conflict
  let ticket = null;
  let attempts = 0;

  while (attempts < MAX_REFERENCE_ATTEMPTS) {
    attempts++;
    const referenceCode = generateReferenceCode();

    try {
      ticket = await prisma.supportTicket.create({
        data: {
          referenceCode,
          laboratoryId: user.laboratoryId || null,
          userId: user.id,
          category: sanitized.category,
          status: "OPEN",
          subject: sanitized.subject,
          description: sanitized.description,
          contactInfo: sanitized.contactInfo,
          syncedToSheets: false,
        },
        include: {
          laboratory: {
            select: { id: true, name: true },
          },
          user: {
            select: { id: true, email: true, role: true },
          },
        },
      });
      break;
    } catch (err) {
      const isUniqueConflict =
        err.code === "P2002" &&
        (err.meta?.target?.includes("referenceCode") ||
          JSON.stringify(err.meta || {}).includes("referenceCode"));

      if (isUniqueConflict && attempts < MAX_REFERENCE_ATTEMPTS) {
        logger.warn("Support reference code conflict, retrying...", {
          attempt: attempts,
          referenceCode,
        });
        continue;
      }
      throw err;
    }
  }

  if (!ticket) {
    throw new ApiError(500, "Failed to generate unique ticket reference code. Please try again.");
  }

  // Record successful submission in the in-memory rate limiter bucket
  recordSupportSubmission(user.id);

  // 3. Forward to Google Sheets webhook (5s timeout handled in sheetsService)
  let syncedToSheets = false;
  try {
    const syncResult = await sheetsService.sendToSheetsWebhook({
      referenceCode: ticket.referenceCode,
      timestamp: ticket.createdAt.toISOString(),
      laboratoryName: ticket.laboratory?.name || (user.role === "SUPERADMIN" ? "Superadmin" : "Independent"),
      submittedBy: ticket.user.email,
      userRole: ticket.user.role,
      category: ticket.category,
      subject: ticket.subject,
      description: ticket.description,
      contactInfo: ticket.contactInfo,
      source: "Web Form",
      status: ticket.status,
    });

    if (syncResult.success) {
      syncedToSheets = true;
      await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: { syncedToSheets: true },
      });
    } else {
      logger.warn("Sheets webhook failed; ticket preserved in database.", {
        referenceCode: ticket.referenceCode,
        error: syncResult.error,
      });
    }
  } catch (syncErr) {
    logger.error("Exception during Sheets sync; ticket preserved in database.", {
      referenceCode: ticket.referenceCode,
      error: syncErr.message,
    });
  }

  // 4. Audit Log record (non-blocking)
  try {
    await recordAuditLog({
      laboratoryId: ticket.laboratoryId,
      userId: ticket.userId,
      action: "SUPPORT_TICKET_CREATED",
      entity: "SupportTicket",
      entityId: ticket.referenceCode,
      details: {
        category: ticket.category,
        subject: ticket.subject,
        syncedToSheets,
      },
    });
  } catch (auditErr) {
    logger.warn("Failed to create audit log for support ticket.", {
      referenceCode: ticket.referenceCode,
      error: auditErr.message,
    });
  }

  return {
    id: ticket.id,
    referenceCode: ticket.referenceCode,
    category: ticket.category,
    status: ticket.status,
    subject: ticket.subject,
    description: ticket.description,
    contactInfo: ticket.contactInfo,
    syncedToSheets,
    createdAt: ticket.createdAt,
  };
}

export const supportService = {
  getSupportConfig,
  createSupportTicket,
};

export default supportService;
