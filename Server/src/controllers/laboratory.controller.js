import ApiResponse from "../utils/ApiResponse.js";
import {
  createLaboratory,
  listLaboratories,
  getLaboratoryById,
  updateLaboratory,
  setLaboratoryStatus,
} from "../services/laboratory.service.js";

const create = async (req, res) => {
  const laboratory = await createLaboratory({ data: req.body });

  const response = new ApiResponse(201, "Laboratory created successfully.", {
    laboratory,
  });

  return res.status(201).json(response);
};

const list = async (req, res) => {
  const result = await listLaboratories({ query: req.query });

  const response = new ApiResponse(
    200,
    "Laboratories fetched successfully.",
    { laboratories: result.laboratories },
    result.meta,
  );

  return res.status(200).json(response);
};

const getById = async (req, res) => {
  const laboratory = await getLaboratoryById({ laboratoryId: req.params.id });

  const response = new ApiResponse(200, "Laboratory fetched successfully.", {
    laboratory,
  });

  return res.status(200).json(response);
};

const update = async (req, res) => {
  const laboratory = await updateLaboratory({
    laboratoryId: req.params.id,
    data: req.body,
  });

  const response = new ApiResponse(200, "Laboratory updated successfully.", {
    laboratory,
  });

  return res.status(200).json(response);
};

const setStatus = async (req, res) => {
  const laboratory = await setLaboratoryStatus({
    laboratoryId: req.params.id,
    isActive: req.body.isActive,
  });

  const response = new ApiResponse(200, "Laboratory status updated.", {
    laboratory,
  });

  return res.status(200).json(response);
};

export { create, list, getById, update, setStatus };
