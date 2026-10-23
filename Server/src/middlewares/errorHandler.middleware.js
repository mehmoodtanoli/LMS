import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import logger from "../utils/logger.js";

// eslint-disable-next-line no-unused-vars
function errorHandlerMiddleware(err, req, res, next) {
  // Handle Body-Parser Errors (Fixes M8)
  if (err.type === "entity.parse.failed") {
    return res.status(400).json(
      new ApiResponse(400, "Malformed JSON in request body.", null, {
        field: "body",
      })
    );
  }

  if (err.type === "entity.too.large") {
    return res.status(413).json(
      new ApiResponse(413, "Request body is too large.", null, {
        limit: err.limit,
      })
    );
  }

  // Handle Prisma Known Request Errors (Fixes M8)
  if (err?.code === "P2002") {
    return res.status(409).json(
      new ApiResponse(
        409,
        "A record with unique constraint already exists.",
        null,
        { target: err.meta?.target || null }
      )
    );
  }

  if (err?.code === "P2003") {
    return res.status(409).json(
      new ApiResponse(
        409,
        "Cannot perform operation because related records exist.",
        null,
        { field: err.meta?.field_name || null }
      )
    );
  }

  if (err?.code === "P2025") {
    return res.status(404).json(
      new ApiResponse(404, "Requested record was not found.", null)
    );
  }

  if (err instanceof ApiError) {
    if (!err.isOperational) {
      logger.error("Non-operational ApiError encountered", {
        message: err.message,
        statusCode: err.statusCode,
        path: req.originalUrl,
        method: req.method,
        stack: err.stack,
      });
    }

    const response = new ApiResponse(
      err.statusCode,
      err.message,
      null,
      err.details ? { details: err.details } : null
    );

    return res.status(err.statusCode).json(response);
  }

  logger.error("Unexpected error occurred", {
    message: err.message,
    path: req.originalUrl,
    method: req.method,
    stack: err.stack,
  });

  const response = new ApiResponse(
    500,
    process.env.NODE_ENV === "production"
      ? "An unexpected error occurred. Please try again later."
      : err.message || "An unexpected error occurred.",
    null,
    process.env.NODE_ENV === "development" ? { stack: err.stack } : null
  );

  return res.status(500).json(response);
}

export default errorHandlerMiddleware;
