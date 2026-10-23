import ApiError from "../utils/ApiError.js";

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

// In-memory buckets for tracking failed attempts
const ipAttempts = new Map();
const emailAttempts = new Map();

function cleanOldEntries(map) {
  const now = Date.now();
  for (const [key, record] of map.entries()) {
    if (now - record.firstAttemptAt > WINDOW_MS) {
      map.delete(key);
    }
  }
}

// Periodically purge expired rate limit entries every 5 minutes
setInterval(() => {
  cleanOldEntries(ipAttempts);
  cleanOldEntries(emailAttempts);
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
