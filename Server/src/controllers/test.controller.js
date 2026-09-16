import ApiResponse from "../utils/ApiResponse.js";
import {
  createTestDefinition,
  listTestDefinitions,
  getTestDefinitionById,
  updateTestDefinition,
  deleteTestDefinition,
} from "../services/test.service.js";

const create = async (req, res) => {
  const testDefinition = await createTestDefinition({ user: req.user, data: req.body });

  const response = new ApiResponse(201, "Test definition created successfully.", {
    testDefinition,
  });

  return res.status(201).json(response);
};

const list = async (req, res) => {
  const result = await listTestDefinitions({ user: req.user, query: req.query });

  const response = new ApiResponse(
    200,
    "Test definitions fetched successfully.",
    {
      tests: result.tests,
    },
    result.meta,
  );

  return res.status(200).json(response);
};

const getById = async (req, res) => {
  const testDefinition = await getTestDefinitionById({
    user: req.user,
    testId: req.params.id,
  });

  const response = new ApiResponse(200, "Test definition fetched successfully.", {
    testDefinition,
  });

  return res.status(200).json(response);
};

const update = async (req, res) => {
  const testDefinition = await updateTestDefinition({
    user: req.user,
    testId: req.params.id,
    data: req.body,
  });

  const response = new ApiResponse(200, "Test definition updated successfully.", {
    testDefinition,
  });

  return res.status(200).json(response);
};

const remove = async (req, res) => {
  const testDefinition = await deleteTestDefinition({
    user: req.user,
    testId: req.params.id,
  });

  const response = new ApiResponse(200, "Test definition deleted successfully.", {
    testDefinition,
  });

  return res.status(200).json(response);
};

export { create, list, getById, update, remove };