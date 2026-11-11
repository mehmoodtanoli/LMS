import ApiError from "./ApiError.js";

const ALLOWED_SUPPORT_CATEGORIES = new Set([
  "TECHNICAL_ISSUE",
  "COMPLAINT",
  "FEATURE_REQUEST",
  "GENERAL_INQUIRY",
  "OTHER",
]);

/**
 * Strips ASCII control characters while preserving standard whitespace/newlines (\n, \r, \t).
 * Removes 0x00-0x08, 0x0B-0x0C, 0x0E-0x1F, and 0x7F.
 */
export function stripControlCharacters(value) {
  if (typeof value !== "string") return "";
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

/**
 * Validates, trims, strips control characters, and enforces length caps on a support ticket payload.
 * Stores raw, stripped plain-text content without spreadsheet formula prefixes.
 */
export function validateAndSanitizeSupportTicketPayload(body) {
  if (!body || typeof body !== "object") {
    throw new ApiError(400, "Request payload must be a JSON object.");
  }

  // 1. Category validation
  const rawCategory = typeof body.category === "string" ? body.category.trim().toUpperCase() : "";
  if (!rawCategory || !ALLOWED_SUPPORT_CATEGORIES.has(rawCategory)) {
    throw new ApiError(
      400,
      `Invalid category. Must be one of: ${Array.from(ALLOWED_SUPPORT_CATEGORIES).join(", ")}.`,
      { field: "category" }
    );
  }

  // 2. Subject validation & sanitization
  const rawSubject = typeof body.subject === "string" ? body.subject : "";
  const cleanedSubject = stripControlCharacters(rawSubject).trim();

  if (cleanedSubject.length < 4) {
    throw new ApiError(400, "Subject must be at least 4 characters long.", {
      field: "subject",
    });
  }
  if (cleanedSubject.length > 150) {
    throw new ApiError(400, "Subject cannot exceed 150 characters.", {
      field: "subject",
    });
  }

  // 3. Description validation & sanitization
  const rawDescription = typeof body.description === "string" ? body.description : "";
  const cleanedDescription = stripControlCharacters(rawDescription).trim();

  if (cleanedDescription.length < 10) {
    throw new ApiError(400, "Description must be at least 10 characters long.", {
      field: "description",
    });
  }
  if (cleanedDescription.length > 2000) {
    throw new ApiError(400, "Description cannot exceed 2000 characters.", {
      field: "description",
    });
  }

  // 4. Contact info validation & sanitization (optional)
  let cleanedContactInfo = null;
  if (body.contactInfo !== undefined && body.contactInfo !== null && body.contactInfo !== "") {
    if (typeof body.contactInfo !== "string") {
      throw new ApiError(400, "contactInfo must be a string.", {
        field: "contactInfo",
      });
    }
    const strippedContact = stripControlCharacters(body.contactInfo).trim();
    if (strippedContact.length > 100) {
      throw new ApiError(400, "contactInfo cannot exceed 100 characters.", {
        field: "contactInfo",
      });
    }
    cleanedContactInfo = strippedContact || null;
  }

  return {
    category: rawCategory,
    subject: cleanedSubject,
    description: cleanedDescription,
    contactInfo: cleanedContactInfo,
  };
}
