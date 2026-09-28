import ApiError from "../utils/ApiError.js";

function notFoundMiddleware(req, res, next) {
  const error = new ApiError(404, "The requested resource was not found.", {
    method: req.method,
    path: req.originalUrl,
  });

  next(error);
}

export default notFoundMiddleware;
