import ApiError from "../utils/ApiError.js";
import prisma from "../config/prisma.js";

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

const SUPPORT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const SUPPORT_MAX_TICKETS = 5;

// In-memory buckets for tracking failed attempts
const ipAttempts = new Map();
const emailAttempts = new Map();
const supportAttempts = new Map();

function cleanOldEntries(map, windowMs = WINDOW_MS) {
  const now = Date.now();
  for (const [key, record] of map.entries()) {
    if (now - record.firstAttemptAt > windowMs) {
      map.delete(key);
    }
  }
}

// Periodically purge expired rate limit entries every 5 minutes
setInterval(() => {
  cleanOldEntries(ipAttempts, WINDOW_MS);
  cleanOldEntries(emailAttempts, WINDOW_MS);
  cleanOldEntries(supportAttempts, SUPPORT_WINDOW_MS);
}, 5 * 60 * 1000).unref();

export function loginRateLimiter(req, res, next) {
  const ip = req.ip || req.connection?.remoteAddress || "unknown_ip";
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";

  const now = Date.now();

  const ipRecord = ipAttempts.get(ip);
  if (ipRecord && ipRecord.count >= MAX_ATTEMPTS && now - ipRecord.firstAttemptAt < WINDOW_MS) {
    const remainingSecs = Math.ceil((WINDOW_MS - (now - ipRecord.firstAttemptAt)) / 1000);
    throw new ApiError(429, `Too many login attempts from this IP. Please try again in ${remainingSecs} seconds.`);
  }

  if (email) {
    const emailRecord = emailAttempts.get(email);
    if (emailRecord && emailRecord.count >= MAX_ATTEMPTS && now - emailRecord.firstAttemptAt < WINDOW_MS) {
      const remainingSecs = Math.ceil((WINDOW_MS - (now - emailRecord.firstAttemptAt)) / 1000);
      throw new ApiError(429, `Too many login attempts for this account. Please try again in ${remainingSecs} seconds.`);
    }
  }

  next();
}

export function recordFailedLogin(req, email) {
  const ip = req.ip || req.connection?.remoteAddress || "unknown_ip";
  const now = Date.now();

  const ipRecord = ipAttempts.get(ip) || { count: 0, firstAttemptAt: now };
  if (now - ipRecord.firstAttemptAt > WINDOW_MS) {
    ipRecord.count = 0;
    ipRecord.firstAttemptAt = now;
  }
  ipRecord.count += 1;
  ipAttempts.set(ip, ipRecord);

  if (email && typeof email === "string") {
    const normEmail = email.trim().toLowerCase();
    const emailRecord = emailAttempts.get(normEmail) || { count: 0, firstAttemptAt: now };
    if (now - emailRecord.firstAttemptAt > WINDOW_MS) {
      emailRecord.count = 0;
      emailRecord.firstAttemptAt = now;
    }
    emailRecord.count += 1;
    emailAttempts.set(normEmail, emailRecord);
  }
}

export function recordSuccessfulLogin(req, email) {
  const ip = req.ip || req.connection?.remoteAddress || "unknown_ip";
  ipAttempts.delete(ip);
  if (email && typeof email === "string") {
    emailAttempts.delete(email.trim().toLowerCase());
  }
}

export async function supportRateLimiter(req, res, next) {
  try {
    const userId = req.user?.id || req.ip || "unknown_user";
    const now = Date.now();

    // 1. Fast in-memory check keyed by user id (or ip)
    const userRecord = supportAttempts.get(userId);
    if (
      userRecord &&
      userRecord.count >= SUPPORT_MAX_TICKETS &&
      now - userRecord.firstAttemptAt < SUPPORT_WINDOW_MS
    ) {
      const remainingSecs = Math.ceil(
        (SUPPORT_WINDOW_MS - (now - userRecord.firstAttemptAt)) / 1000
      );
      throw new ApiError(
        429,
        `Too many support requests. Please try again in ${remainingSecs} seconds.`
      );
    }

    // 2. Database count check for authenticated user in the last 15 minutes
    if (req.user?.id) {
      const fifteenMinutesAgo = new Date(now - SUPPORT_WINDOW_MS);
      const recentTicketCount = await prisma.supportTicket.count({
        where: {
          userId: req.user.id,
          createdAt: {
            gte: fifteenMinutesAgo,
          },
        },
      });

      if (recentTicketCount >= SUPPORT_MAX_TICKETS) {
        supportAttempts.set(userId, {
          count: recentTicketCount,
          firstAttemptAt: now - Math.floor(SUPPORT_WINDOW_MS / 2),
        });

        throw new ApiError(
          429,
          "Too many support requests submitted recently. You may submit up to 5 tickets every 15 minutes."
        );
      }
    }

    next();
  } catch (error) {
    next(error);
  }
}

export function recordSupportSubmission(userId) {
  if (!userId) return;
  const now = Date.now();
  const record = supportAttempts.get(userId) || { count: 0, firstAttemptAt: now };
  if (now - record.firstAttemptAt > SUPPORT_WINDOW_MS) {
    record.count = 0;
    record.firstAttemptAt = now;
  }
  record.count += 1;
  supportAttempts.set(userId, record);
}
