import env from "../config/env.js";
import logger from "../utils/logger.js";

const WEBHOOK_TIMEOUT_MS = 5000;
const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r", "%"];

/**
 * Sanitizes input against Spreadsheet Formula Injection (CSV / Excel / Google Sheets).
 * Applied ONLY when formatting payloads for external spreadsheet delivery.
 * If the string begins with =, +, -, @, tab, CR, or %, prepends a single apostrophe (').
 */
export function sanitizeFormulaInjection(value) {
  if (typeof value !== "string") return value;
  if (!value) return "";
  if (FORMULA_PREFIXES.some((prefix) => value.startsWith(prefix))) {
    return `'${value}`;
  }
  const trimmed = value.trim();
  if (FORMULA_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) {
    return `'${trimmed}`;
  }
  return trimmed;
}

/**
 * Dispatches ticket information to the Google Apps Script webhook.
 * Ensures a strict 5-second timeout, handles HTTP redirects, and applies formula injection sanitization.
 * 
 * @param {Object} ticketData
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function sendToSheetsWebhook(ticketData) {
  const webhookUrl = env.googleSheetsWebhookUrl || process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  const webhookSecret = env.googleSheetsWebhookSecret || process.env.GOOGLE_SHEETS_WEBHOOK_SECRET || "";

  if (!webhookUrl || typeof webhookUrl !== "string" || !webhookUrl.trim()) {
    logger.info("Google Sheets webhook URL is not configured. Skipping webhook sync.", {
      referenceCode: ticketData.referenceCode,
    });
    return { success: false, error: "GOOGLE_SHEETS_WEBHOOK_URL not configured" };
  }

  const payload = {
    secret: webhookSecret,
    timestamp: ticketData.timestamp || new Date().toISOString(),
    referenceNumber: ticketData.referenceCode,
    laboratoryName: sanitizeFormulaInjection(ticketData.laboratoryName || "Independent / Admin"),
    submittedBy: sanitizeFormulaInjection(ticketData.submittedBy || "Unknown"),
    userRole: ticketData.userRole || "USER",
    category: ticketData.category,
    subject: sanitizeFormulaInjection(ticketData.subject),
    description: sanitizeFormulaInjection(ticketData.description),
    contactInfo: sanitizeFormulaInjection(ticketData.contactInfo || "None provided"),
    source: ticketData.source || "Web Form",
    status: ticketData.status || "OPEN",
  };

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort(new Error("Google Sheets webhook request timed out after 5000ms"));
  }, WEBHOOK_TIMEOUT_MS);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: abortController.signal,
      redirect: "follow",
    });

    if (!response.ok) {
      const statusText = response.statusText || "Unknown status";
      const errorMsg = `Google Sheets webhook returned HTTP ${response.status} (${statusText})`;
      logger.warn(errorMsg, { referenceCode: ticketData.referenceCode });
      return { success: false, error: errorMsg };
    }

    let responseData = null;
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }

    if (responseData && responseData.success === false) {
      const errorMsg = responseData.message || responseData.error || "Webhook indicated failure";
      logger.warn("Google Sheets script returned failure payload.", {
        referenceCode: ticketData.referenceCode,
        error: errorMsg,
      });
      return { success: false, error: errorMsg };
    }

    return { success: true };
  } catch (err) {
    const isTimeout = err.name === "AbortError" || err.message?.includes("timed out");
    const errorMsg = isTimeout
      ? "Google Sheets webhook timed out (5s limit exceeded)"
      : (err.message || "Failed to reach Google Sheets webhook");

    logger.warn("Google Sheets webhook dispatch failed.", {
      referenceCode: ticketData.referenceCode,
      error: errorMsg,
    });

    return { success: false, error: errorMsg };
  } finally {
    clearTimeout(timeoutId);
  }
}

export const sheetsService = {
  sanitizeFormulaInjection,
  sendToSheetsWebhook,
};

export default sheetsService;
