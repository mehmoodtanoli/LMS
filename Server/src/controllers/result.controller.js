import ApiResponse from "../utils/ApiResponse.js";
import { createResult, listResults, getResultById, updateResult } from "../services/result.service.js";

const create = async (req, res) => {
  const result = await createResult({ user: req.user, data: req.body });

  const response = new ApiResponse(201, "Result created successfully.", {
    result,
  });

  return res.status(201).json(response);
};

const list = async (req, res) => {
  const result = await listResults({ user: req.user, query: req.query });

  const response = new ApiResponse(200, "Results fetched successfully.", {
    results: result.results,
  }, result.meta);

  return res.status(200).json(response);
};

const getById = async (req, res) => {
  const result = await getResultById({ user: req.user, resultId: req.params.id });

  const response = new ApiResponse(200, "Result fetched successfully.", {
    result,
  });

  return res.status(200).json(response);
};

const update = async (req, res) => {
  const result = await updateResult({
    user: req.user,
    resultId: req.params.id,
    data: req.body,
  });

  const response = new ApiResponse(200, "Result updated successfully.", {
    result,
  });

  return res.status(200).json(response);
};

export { create, list, getById, update };