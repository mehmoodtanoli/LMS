import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import logger from "../utils/logger.js";

// eslint-disable-next-line no-unused-vars
function errorHandlerMiddleware(err, req, res, next) {
  if (err instanceof ApiError) {
    if (!err.isOperational) {
      logger.error("Non-operational ApiError encountered", {
        message: err.message,
        statusCode: err.statusCode,
        path: req.originalUrl,
        method: req.method,
      });
    }

    const response = new ApiResponse(
      err.statusCode,
      err.message,
      null,
      err.details ? { details: err.details } : null,
    );

    return res.status(err.statusCode).json(response);
  }

  logger.error("Unexpected error occurred", {
    message: err.message,
    path: req.originalUrl,
    method: req.method,
  });

  const response = new ApiResponse(
    500,
    "An unexpected error occurred. Please try again later.",
    null,
    null,
  );

  return res.status(500).json(response);
}

export default errorHandlerMiddleware;
