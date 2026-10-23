import ApiError from "./ApiError.js";

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value.trim());
}

export function assertUuid(value, fieldName = "id") {
  if (!isValidUuid(value)) {
    throw new ApiError(400, `${fieldName} must be a valid UUID.`, {
      field: fieldName,
    });
  }
}

export function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeOptionalString(value) {
  const normalizedValue = normalizeString(value);
  return normalizedValue ? normalizedValue : undefined;
}

export function parsePagination(
  query,
  defaultPage = 1,
  defaultLimit = 20,
  maxLimit = 100
) {
  const pageValue = query?.page ?? defaultPage;
  const limitValue = query?.limit ?? defaultLimit;
  const page = Number(pageValue);
  const limit = Number(limitValue);

  if (!Number.isInteger(page) || page < 1) {
    throw new ApiError(400, "page must be a positive integer.", {
      field: "page",
    });
  }

  if (!Number.isInteger(limit) || limit < 1) {
    throw new ApiError(400, "limit must be a positive integer.", {
      field: "limit",
    });
  }

  const finalLimit = Math.min(limit, maxLimit);
  return {
    page,
    limit: finalLimit,
    skip: (page - 1) * finalLimit,
  };
}
