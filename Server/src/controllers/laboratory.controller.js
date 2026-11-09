import ApiResponse from "../utils/ApiResponse.js";
import {
  createLaboratory,
  listLaboratories,
  getLaboratoryById,
  updateLaboratory,
  getLaboratoryProfile,
  updateLaboratoryProfile,
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

const getProfile = async (req, res) => {
  const laboratory = await getLaboratoryProfile({
    laboratoryId: req.user.laboratoryId,
  });

  return res.status(200).json(
    new ApiResponse(200, "Laboratory settings fetched successfully.", { laboratory })
  );
};

const updateProfile = async (req, res) => {
  const laboratory = await updateLaboratoryProfile({
    user: req.user,
    data: req.body,
  });

  return res.status(200).json(
    new ApiResponse(200, "Laboratory settings updated successfully.", { laboratory })
  );
};

export { create, list, getById, update, setStatus, getProfile, updateProfile };
